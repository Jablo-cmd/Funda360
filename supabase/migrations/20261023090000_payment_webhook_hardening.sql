-- Payment webhook hardening (forensic audit 2026-10-23, findings S-1 and S-2).
--
-- S-1  Netcash Pay Now callbacks are "verified" by comparing the M1 field to
--      the school's service key, but that key is part of the payment form
--      every payer's browser receives. Anyone who started a Netcash payment
--      could forge an accepted callback for their own intent. Until Netcash
--      callbacks are confirmed server-side with Netcash, a Netcash gateway
--      cannot be enabled, and settle_payment_intent() never settles a
--      Netcash callback.
--
-- S-2  settle_payment_intent() recorded every callback, verified or not,
--      under the (provider, provider_event_id) unique constraint before
--      checking the signature. A forged callback carrying the id of a
--      genuine future event (Ozow shows TransactionId to the payer's browser)
--      made the genuine callback a "duplicate", so the payment never settled.
--      De-duplication now covers verified events only; unverified callbacks
--      are still kept as an attack signal.

-- S-1: no enabled Netcash gateway (production has no gateway rows at all).
alter table public.payment_gateway_configs
  add constraint payment_gateway_configs_netcash_not_enabled
  check (provider <> 'netcash' or not enabled);

comment on constraint payment_gateway_configs_netcash_not_enabled on public.payment_gateway_configs is
  'Netcash Pay Now callbacks cannot be authenticated (the service key is visible to every payer), so a Netcash gateway may be saved but not enabled until server-side confirmation exists. Audit 2026-10-23 S-1.';

-- S-2: de-duplicate verified events only.
alter table public.payment_webhook_events
  drop constraint payment_webhook_events_provider_provider_event_id_key;

create unique index payment_webhook_events_verified_event_key
  on public.payment_webhook_events (provider, provider_event_id)
  where signature_valid;

comment on table public.payment_webhook_events is 'Every inbound provider webhook. The partial unique index on (provider, provider_event_id) where signature_valid is the duplicate-delivery guard for verified callbacks. Unverified callbacks (signature_valid=false) are retained as an attack signal but never take part in de-duplication, so they cannot pre-empt a genuine callback.';

create or replace function public.settle_payment_intent(
  p_provider          public.payment_provider,
  p_mode              public.payment_mode,
  p_provider_event_id text,
  p_reference         text,
  p_provider_reference text,
  p_amount            numeric,
  p_outcome           text,
  p_signature_valid   boolean,
  p_payload           jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_intent public.payment_intents;
  v_amount numeric(12, 2) := round(p_amount, 2);
  v_payment_id uuid;
  v_invoice record;
  v_allocated numeric(12, 2);
  v_alloc_amount numeric(12, 2);
  v_guardian record;
  v_learner record;
begin
  -- An unverified callback is logged and never takes part in
  -- de-duplication, so it cannot claim an event id ahead of the provider's
  -- genuine callback (audit 2026-10-23, S-2). Netcash callbacks are never
  -- treated as verified (S-1): their only check is a value every payer sees.
  if not p_signature_valid or p_provider = 'netcash' then
    insert into public.payment_webhook_events
      (provider, mode, provider_event_id, signature_valid, status_reported, payload, processed_at, processing_error)
    values
      (p_provider, p_mode, p_provider_event_id, false, p_outcome, p_payload, now(),
       case when p_provider = 'netcash' then 'provider_not_verifiable' else 'signature_invalid' end);
    return jsonb_build_object('result', 'signature_invalid');
  end if;

  insert into public.payment_webhook_events (provider, mode, provider_event_id, signature_valid, status_reported, payload)
  values (p_provider, p_mode, p_provider_event_id, true, p_outcome, p_payload)
  on conflict (provider, provider_event_id) where signature_valid do nothing
  returning id into v_event_id;

  if v_event_id is null then
    return jsonb_build_object('result', 'duplicate_ignored');
  end if;

  select * into v_intent from public.payment_intents where reference = p_reference for update;
  if not found then
    update public.payment_webhook_events
      set processed_at = now(), processing_error = 'unknown_reference'
      where id = v_event_id;
    return jsonb_build_object('result', 'unknown_reference');
  end if;

  update public.payment_webhook_events
    set school_id = v_intent.school_id, intent_id = v_intent.id
    where id = v_event_id;

  if v_intent.status in ('succeeded', 'failed', 'cancelled', 'expired') then
    update public.payment_webhook_events set processed_at = now(), processing_error = 'intent_already_terminal' where id = v_event_id;
    return jsonb_build_object('result', 'already_' || v_intent.status);
  end if;

  if p_outcome <> 'succeeded' then
    update public.payment_intents
      set status = case p_outcome when 'cancelled' then 'cancelled'::public.payment_intent_status
                                  when 'expired' then 'expired'::public.payment_intent_status
                                  else 'failed'::public.payment_intent_status end,
          failure_reason = p_outcome,
          provider_reference = p_provider_reference,
          raw_result = p_payload,
          completed_at = now()
      where id = v_intent.id;
    update public.payment_webhook_events set processed_at = now() where id = v_event_id;
    perform public.write_audit_log(v_intent.school_id, null, 'payment_intent_' || p_outcome, 'payment_intents', v_intent.id, null, p_payload);
    return jsonb_build_object('result', p_outcome);
  end if;

  if v_amount <> v_intent.amount then
    update public.payment_intents
      set status = 'failed', failure_reason = 'amount_mismatch', provider_reference = p_provider_reference, raw_result = p_payload, completed_at = now()
      where id = v_intent.id;
    update public.payment_webhook_events set processed_at = now(), processing_error = 'amount_mismatch' where id = v_event_id;
    perform public.write_audit_log(
      v_intent.school_id, null, 'payment_amount_mismatch', 'payment_intents', v_intent.id,
      jsonb_build_object('expected', v_intent.amount), jsonb_build_object('reported', v_amount)
    );
    return jsonb_build_object('result', 'amount_mismatch');
  end if;

  insert into public.learner_fee_payments (school_id, learner_id, academic_year_id, amount, payment_date, method, reference, notes)
  select v_intent.school_id, v_intent.learner_id,
         coalesce(
           (select academic_year_id from public.invoices where id = v_intent.invoice_id),
           (select id from public.academic_years where school_id = v_intent.school_id and is_active order by start_date desc limit 1),
           (select id from public.academic_years where school_id = v_intent.school_id order by start_date desc limit 1)
         ),
         v_intent.amount, current_date, 'card',
         coalesce(p_provider_reference, p_reference),
         'Online payment via ' || p_provider::text || ' (' || p_mode::text || ')'
  returning id into v_payment_id;

  if v_intent.invoice_id is not null then
    -- Lock the invoice before measuring existing allocations — serialises
    -- against a concurrent settle / allocate_fee_payment on the same invoice.
    perform 1 from public.invoices where id = v_intent.invoice_id for update;
    select total into v_invoice from public.invoices where id = v_intent.invoice_id;
    select coalesce(sum(amount), 0) into v_allocated
      from public.learner_fee_payment_allocations where invoice_id = v_intent.invoice_id;
    v_alloc_amount := least(v_intent.amount, v_invoice.total - v_allocated);
    if v_alloc_amount > 0 then
      insert into public.learner_fee_payment_allocations (school_id, payment_id, invoice_id, amount)
      values (v_intent.school_id, v_payment_id, v_intent.invoice_id, v_alloc_amount);
    end if;
  end if;

  insert into public.fee_receipts (school_id, learner_id, payment_id, receipt_number, issued_by)
  values (v_intent.school_id, v_intent.learner_id, v_payment_id,
          public.next_fee_document_number(v_intent.school_id, 'receipt'), null);

  update public.payment_intents
    set status = 'succeeded', payment_id = v_payment_id, provider_reference = p_provider_reference, raw_result = p_payload, completed_at = now()
    where id = v_intent.id;
  update public.payment_webhook_events set processed_at = now() where id = v_event_id;

  perform public.write_audit_log(
    v_intent.school_id, null, 'gateway_payment_settled', 'payment_intents', v_intent.id,
    null, jsonb_build_object('payment_id', v_payment_id, 'amount', v_intent.amount, 'provider', p_provider)
  );

  select first_name, last_name into v_learner from public.learners where id = v_intent.learner_id;
  for v_guardian in select guardian_profile_id from public.learner_guardians where learner_id = v_intent.learner_id
  loop
    perform public.create_notification(
      v_guardian.guardian_profile_id, 'payment_received', 'Payment received',
      'We received your payment of R' || to_char(v_intent.amount, 'FM999999990.00') || ' for '
        || coalesce(v_learner.first_name, '') || ' ' || coalesce(v_learner.last_name, '') || '. A receipt is available.',
      v_intent.school_id, 'payment_intents', v_intent.id, '/parent/fees'
    );
  end loop;

  return jsonb_build_object('result', 'succeeded', 'payment_id', v_payment_id);
end;
$$;

revoke execute on function public.settle_payment_intent(public.payment_provider, public.payment_mode, text, text, text, numeric, text, boolean, jsonb) from public, anon, authenticated;
grant execute on function public.settle_payment_intent(public.payment_provider, public.payment_mode, text, text, text, numeric, text, boolean, jsonb) to service_role;

comment on function public.settle_payment_intent(public.payment_provider, public.payment_mode, text, text, text, numeric, text, boolean, jsonb) is
  'The webhook Edge Function''s only write path. service_role only. Unverified and Netcash callbacks are logged and never settle or de-duplicate. Verified callbacks de-duplicate on (provider, provider_event_id) and on an already-terminal intent, require an exact amount match, then book a card payment into learner_fee_payments, allocate it to the invoice, issue a receipt, and notify guardians.';

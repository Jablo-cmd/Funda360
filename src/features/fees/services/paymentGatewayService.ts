import { supabase } from '@/lib/supabase';
import type { PaymentGatewayConfigRow, PaymentIntentRow } from '@/lib/database.types';
import type {
  PaymentGatewayConfig,
  CreatePaymentGatewayConfigInput,
  PaymentIntent,
  PaymentRedirect,
} from '@/features/fees/types/paymentGateway.types';

function toConfig(row: PaymentGatewayConfigRow): PaymentGatewayConfig {
  return {
    id: row.id,
    schoolId: row.school_id,
    provider: row.provider,
    mode: row.mode,
    enabled: row.enabled,
    merchantConfig: (row.merchant_config ?? {}) as Record<string, string>,
    secretLastSetAt: row.secret_last_set_at,
    updatedAt: row.updated_at,
  };
}

function toIntent(row: PaymentIntentRow): PaymentIntent {
  return {
    id: row.id,
    schoolId: row.school_id,
    learnerId: row.learner_id,
    invoiceId: row.invoice_id,
    provider: row.provider,
    mode: row.mode,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    reference: row.reference,
    providerReference: row.provider_reference,
    returnUrl: row.return_url,
    cancelUrl: row.cancel_url,
    paymentId: row.payment_id,
    failureReason: row.failure_reason,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

async function getConfig(schoolId: string): Promise<PaymentGatewayConfig | null> {
  const { data, error } = await supabase
    .from('payment_gateway_configs')
    .select('*')
    .eq('school_id', schoolId)
    .maybeSingle();
  if (error) throw error;
  return data ? toConfig(data) : null;
}

async function upsertConfig(
  schoolId: string,
  input: CreatePaymentGatewayConfigInput,
): Promise<PaymentGatewayConfig> {
  const existing = await getConfig(schoolId);
  if (existing) {
    const { data, error } = await supabase
      .from('payment_gateway_configs')
      .update({
        provider: input.provider,
        mode: input.mode,
        enabled: input.enabled,
        merchant_config: input.merchantConfig,
      })
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) throw error;
    return toConfig(data);
  }
  const { data, error } = await supabase
    .from('payment_gateway_configs')
    .insert({
      school_id: schoolId,
      provider: input.provider,
      mode: input.mode,
      enabled: input.enabled,
      merchant_config: input.merchantConfig,
    })
    .select('*')
    .single();
  if (error) throw error;
  return toConfig(data);
}

async function createIntent(params: {
  learnerId: string;
  amount: number;
  invoiceId?: string | null;
  returnUrl: string;
  cancelUrl: string;
}): Promise<PaymentIntent> {
  const { data, error } = await supabase.rpc('create_payment_intent', {
    p_learner_id: params.learnerId,
    p_amount: params.amount,
    p_invoice_id: params.invoiceId ?? null,
    p_return_url: params.returnUrl,
    p_cancel_url: params.cancelUrl,
  });
  if (error) throw error;
  return toIntent(data as PaymentIntentRow);
}

/**
 * Asks the initiate Edge Function to build the provider redirect for an
 * intent. The function reads the provider secrets from its own environment
 * — they never touch the browser. Throws a friendly error when the
 * function is not deployed / not configured yet.
 */
async function getRedirect(intentId: string): Promise<PaymentRedirect> {
  const { data, error } = await supabase.functions.invoke<PaymentRedirect>('payments-initiate', {
    body: { intentId },
  });
  if (error || !data) {
    throw new Error(
      'Online payment could not be started. The school may not have finished configuring its payment provider.',
    );
  }
  return data;
}

async function markProcessing(intentId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_payment_intent_processing', { p_intent_id: intentId });
  if (error) throw error;
}

async function getIntent(intentId: string): Promise<PaymentIntent | null> {
  const { data, error } = await supabase.from('payment_intents').select('*').eq('id', intentId).maybeSingle();
  if (error) throw error;
  return data ? toIntent(data) : null;
}

export const paymentGatewayService = {
  getConfig,
  upsertConfig,
  createIntent,
  getRedirect,
  markProcessing,
  getIntent,
};

import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { paymentGatewayService } from '@/features/fees/services/paymentGatewayService';
import type { PaymentIntent } from '@/features/fees/types/paymentGateway.types';

const TERMINAL: PaymentIntent['status'][] = ['succeeded', 'failed', 'cancelled', 'expired'];
const POLL_MS = 2500;
const MAX_POLLS = 24; // ~1 minute

/**
 * Landing page after the provider redirects the guardian back. It does NOT
 * trust any success flag in the URL — it polls the payment_intents row
 * until the webhook has settled it server-side, or a timeout.
 */
export function PaymentReturnPage() {
  const [params] = useSearchParams();
  const [intent, setIntent] = useState<PaymentIntent | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const pollCount = useRef(0);

  const intentId = params.get('intent') ?? readPending();

  useEffect(() => {
    if (!intentId) return;
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      pollCount.current += 1;
      try {
        const latest = await paymentGatewayService.getIntent(intentId);
        if (cancelled) return;
        if (latest) setIntent(latest);
        if (latest && TERMINAL.includes(latest.status)) {
          clearPending();
          return;
        }
      } catch {
        /* keep polling */
      }
      if (pollCount.current >= MAX_POLLS) {
        setTimedOut(true);
        return;
      }
      window.setTimeout(() => void tick(), POLL_MS);
    };

    void tick();
    return () => {
      cancelled = true;
    };
  }, [intentId]);

  const status = intent?.status;
  const settled = status && TERMINAL.includes(status);

  return (
    <PageContainer>
      <PageHeader title="Payment" description="Confirming your payment with the bank." />

      {!intentId ? (
        <p className="rounded-card border border-border bg-surface-raised px-4 py-10 text-center text-sm text-content-tertiary">
          No payment to confirm. <Link to="/parent/fees" className="text-brand-600 hover:underline">Back to fees</Link>.
        </p>
      ) : !settled && !timedOut ? (
        <LoadingBlock label="Waiting for confirmation from the payment provider…" />
      ) : (
        <div className="rounded-card border border-border bg-surface-raised p-6 text-sm">
          {status === 'succeeded' && (
            <div className="flex flex-col gap-2">
              <p className="text-base font-semibold text-success-600">Payment received — thank you.</p>
              <p className="text-content-secondary">
                We received R{intent?.amount.toFixed(2)}. A receipt is available on your fees page.
              </p>
              <Link to="/parent/fees" className="mt-2 text-brand-600 hover:underline">
                View fees &amp; receipts
              </Link>
            </div>
          )}
          {(status === 'failed' || status === 'expired') && (
            <div className="flex flex-col gap-2">
              <p className="text-base font-semibold text-danger-600">Payment was not completed.</p>
              <p className="text-content-secondary">
                {intent?.failureReason === 'amount_mismatch'
                  ? 'The amount confirmed by the bank did not match. Nothing has been charged — please try again.'
                  : 'Nothing has been charged. You can try again from your fees page.'}
              </p>
              <Link to="/parent/fees" className="mt-2 text-brand-600 hover:underline">
                Back to fees
              </Link>
            </div>
          )}
          {status === 'cancelled' && (
            <div className="flex flex-col gap-2">
              <p className="text-base font-semibold text-content-primary">Payment cancelled.</p>
              <Link to="/parent/fees" className="mt-2 text-brand-600 hover:underline">
                Back to fees
              </Link>
            </div>
          )}
          {timedOut && !settled && (
            <div className="flex flex-col gap-2">
              <p className="text-base font-semibold text-content-primary">Still confirming.</p>
              <p className="text-content-secondary">
                Your bank has not confirmed the payment yet. This can take a few minutes — check your fees page shortly.
                If money left your account and no receipt appears within an hour, contact the school finance office.
              </p>
              <Link to="/parent/fees" className="mt-2 text-brand-600 hover:underline">
                Back to fees
              </Link>
            </div>
          )}
        </div>
      )}
    </PageContainer>
  );
}

function readPending(): string | null {
  try {
    return sessionStorage.getItem('funda360-pending-payment-intent');
  } catch {
    return null;
  }
}

function clearPending() {
  try {
    sessionStorage.removeItem('funda360-pending-payment-intent');
  } catch {
    /* ignore */
  }
}

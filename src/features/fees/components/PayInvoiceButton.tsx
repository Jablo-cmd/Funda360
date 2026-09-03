import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { paymentGatewayService } from '@/features/fees/services/paymentGatewayService';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface PayInvoiceButtonProps {
  learnerId: string;
  invoiceId: string;
  amount: number;
  label?: string;
}

/**
 * Starts an online payment: creates a server-side payment intent, asks the
 * initiate Edge Function to build the provider redirect (secrets stay
 * server-side), marks the intent as processing, then POSTs the browser to
 * the provider. The return page (/parent/payment-return) polls the intent
 * — client-side "success" is never trusted; only the webhook settles it.
 */
export function PayInvoiceButton({ learnerId, invoiceId, amount, label = 'Pay now' }: PayInvoiceButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const origin = window.location.origin;
      const intent = await paymentGatewayService.createIntent({
        learnerId,
        invoiceId,
        amount,
        returnUrl: `${origin}/parent/payment-return`,
        cancelUrl: `${origin}/parent/payment-return`,
      });

      const redirect = await paymentGatewayService.getRedirect(intent.id);
      await paymentGatewayService.markProcessing(intent.id);

      // Remember which intent we are waiting on for the return page.
      try {
        sessionStorage.setItem('funda360-pending-payment-intent', intent.id);
      } catch {
        /* private mode — the return page also accepts ?intent= */
      }

      const form = document.createElement('form');
      form.method = redirect.method;
      form.action = redirect.url;
      for (const [key, value] of Object.entries(redirect.fields)) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = value;
        form.appendChild(input);
      }
      document.body.appendChild(form);
      form.submit();
    } catch (err) {
      setError(getDbErrorMessage(err, 'Online payment is not available right now.'));
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="w-full sm:w-32">
        <Button type="button" onClick={() => void start()} isLoading={busy}>
          {label}
        </Button>
      </div>
      {error && <p className="text-xs text-danger-600">{error}</p>}
    </div>
  );
}

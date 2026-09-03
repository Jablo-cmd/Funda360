import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { invoiceService } from '@/features/fees/services/invoiceService';
import { getDbErrorMessage } from '@/lib/dbErrors';
import type { InvoiceWithDetail } from '@/features/fees/types/invoice.types';

export interface VoidInvoiceModalProps {
  invoice: InvoiceWithDetail | null;
  onClose: () => void;
  onVoided: () => void;
}

export function VoidInvoiceModal({ invoice, onClose, onVoided }: VoidInvoiceModalProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (invoice) {
      setReason('');
      setError(null);
    }
  }, [invoice]);

  const handleVoid = async () => {
    if (!invoice) return;
    if (reason.trim().length === 0) {
      setError('A reason is required to void an invoice.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await invoiceService.voidInvoice(invoice.id, reason.trim());
      onVoided();
      onClose();
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to void the invoice.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={invoice !== null}
      onClose={onClose}
      title={`Void invoice ${invoice?.invoiceNumber ?? ''}`.trim()}
      footer={
        <Button
          type="button"
          onClick={() => void handleVoid()}
          isLoading={isSubmitting}
          className="!bg-danger-600 hover:!bg-danger-500"
        >
          {isSubmitting ? 'Voiding…' : 'Void invoice'}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        {error && (
          <div role="alert" className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600">
            {error}
          </div>
        )}
        <p className="text-sm text-content-secondary">
          Voiding removes this invoice&apos;s line-item charges from the learner&apos;s balance and clears any payments
          allocated to it. The invoice record and its number are kept permanently for audit.
        </p>
        <TextField
          label="Reason"
          required
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="e.g. Issued in error, superseded by a corrected invoice"
        />
      </div>
    </Modal>
  );
}

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useTransfers } from '@/features/learners/hooks/useTransfers';
import { TransferFormModal } from '@/features/learners/components/TransferFormModal';
import { generateTransferLetterPdf } from '@/features/learners/utils/generateTransferLetterPdf';
import type { Learner, LearnerTransfer } from '@/features/learners/types/learner.types';

export interface LearnerTransfersSectionProps {
  schoolId: string;
  learner: Learner;
  canManage: boolean;
  /** Only supplied when the caller has everything needed to offer a transfer-letter download for an outgoing record — omit to show history without that action. */
  letterContext?: {
    schoolName: string;
    schoolAddress?: string | null;
    learnerNumber: string;
    admissionNumber: string;
    gradeName?: string;
  };
}

const DIRECTION_LABELS: Record<LearnerTransfer['direction'], string> = {
  outgoing: 'Outgoing',
  incoming: 'Incoming',
};

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** The learner's inter-school transfer history — outgoing (leaving for another school) and incoming (arrived from a prior school) records, both captured by the same learner_transfers table (FND-SIS-007). */
export function LearnerTransfersSection({ schoolId, learner, canManage, letterContext }: LearnerTransfersSectionProps) {
  const { transfers, isLoading, error, refetch } = useTransfers(learner.id);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const handleDownloadLetter = async (transfer: LearnerTransfer) => {
    if (!letterContext) return;
    setGeneratingId(transfer.id);
    try {
      const doc = await generateTransferLetterPdf({
        schoolName: letterContext.schoolName,
        schoolAddress: letterContext.schoolAddress,
        learnerName: `${learner.firstName} ${learner.lastName}`,
        learnerNumber: letterContext.learnerNumber,
        admissionNumber: letterContext.admissionNumber,
        gradeName: letterContext.gradeName,
        transfer,
      });
      doc.save(`${letterContext.learnerNumber}-transfer-letter.pdf`);
    } finally {
      setGeneratingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {canManage && (
        <div className="flex justify-end">
          <div className="w-full sm:w-auto sm:min-w-[9rem]">
            <Button type="button" onClick={() => setIsFormOpen(true)}>
              Record transfer
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <span
            aria-hidden="true"
            className="h-8 w-8 animate-spin-smooth rounded-full border-2 border-brand-600 border-t-transparent"
          />
          <span className="sr-only">Loading transfer history…</span>
        </div>
      ) : transfers.length === 0 ? (
        <p className="rounded-card border border-border bg-surface-raised p-6 text-sm text-content-tertiary">
          No transfer history recorded for this learner.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {transfers.map((transfer) => (
            <li key={transfer.id} className="rounded-card border border-border bg-surface-raised p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-content-primary">
                    {DIRECTION_LABELS[transfer.direction]} · {transfer.otherSchoolName}
                  </p>
                  <p className="mt-0.5 text-xs text-content-tertiary">{formatDate(transfer.transferDate)}</p>
                  {transfer.reason && <p className="mt-2 text-sm text-content-secondary">{transfer.reason}</p>}
                  {transfer.otherSchoolContact && (
                    <p className="mt-1 text-xs text-content-tertiary">Contact: {transfer.otherSchoolContact}</p>
                  )}
                </div>
                {transfer.direction === 'outgoing' && letterContext && (
                  <div className="w-full sm:w-auto sm:min-w-[10rem]">
                    <Button
                      type="button"
                      variant="secondary"
                      isLoading={generatingId === transfer.id}
                      onClick={() => void handleDownloadLetter(transfer)}
                    >
                      {generatingId === transfer.id ? 'Generating…' : 'Download letter'}
                    </Button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <TransferFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        schoolId={schoolId}
        learner={learner}
        onSaved={() => void refetch()}
      />
    </div>
  );
}

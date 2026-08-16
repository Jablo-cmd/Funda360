import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useDocuments } from '@/features/learners/hooks/useDocuments';
import { documentService } from '@/features/learners/services/documentService';
import { DocumentsTable } from '@/features/learners/components/DocumentsTable';
import { DocumentFormModal } from '@/features/learners/components/DocumentFormModal';
import type { LearnerDocument } from '@/features/learners/types/learner.types';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface LearnerDocumentsSectionProps {
  schoolId: string;
  learnerId: string;
  canManage: boolean;
}

export function LearnerDocumentsSection({
  schoolId,
  learnerId,
  canManage,
}: LearnerDocumentsSectionProps) {
  const { documents, isLoading, error, refetch } = useDocuments(learnerId);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleToggleActive = async (document: LearnerDocument) => {
    setActionError(null);
    try {
      if (document.active) {
        await documentService.archiveDocument(document.id);
      } else {
        await documentService.restoreDocument(document.id);
      }
      await refetch();
    } catch (err) {
      setActionError(getDbErrorMessage(err, 'Failed to update document.'));
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {canManage && (
        <div className="flex justify-end">
          <div className="w-full sm:w-auto sm:min-w-[9rem]">
            <Button type="button" onClick={() => setIsFormOpen(true)}>
              Add document
            </Button>
          </div>
        </div>
      )}

      {(error ?? actionError) && (
        <div
          role="alert"
          className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600"
        >
          {error ?? actionError}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-10">
          <span
            aria-hidden="true"
            className="h-6 w-6 animate-spin-smooth rounded-full border-2 border-brand-600 border-t-transparent"
          />
        </div>
      ) : (
        <DocumentsTable
          documents={documents}
          canManage={canManage}
          onToggleActive={(document) => void handleToggleActive(document)}
        />
      )}

      <DocumentFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        schoolId={schoolId}
        learnerId={learnerId}
        onSaved={() => void refetch()}
      />
    </div>
  );
}

import { TableScrollContainer } from '@/components/ui/TableScrollContainer';
import type { LearnerDocument } from '@/features/learners/types/learner.types';

export interface DocumentsTableProps {
  documents: LearnerDocument[];
  canManage: boolean;
  onToggleActive: (document: LearnerDocument) => void;
}

const DOCUMENT_TYPE_LABELS: Record<LearnerDocument['documentType'], string> = {
  birth_certificate: 'Birth certificate',
  id_copy: 'ID copy',
  passport: 'Passport',
  permit: 'Permit',
  transfer_letter: 'Transfer letter',
  medical_certificate: 'Medical certificate',
  report_card: 'Report card',
  other: 'Other',
};

export function DocumentsTable({ documents, canManage, onToggleActive }: DocumentsTableProps) {
  if (documents.length === 0) {
    return (
      <div className="rounded-card border border-border bg-surface-raised px-4 py-10 text-center text-sm text-content-tertiary">
        No documents uploaded yet.
      </div>
    );
  }

  return (
    <TableScrollContainer>
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-content-tertiary">
            <th scope="col" className="px-4 py-3 font-medium">
              Type
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              File
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Uploaded
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Status
            </th>
            {canManage && (
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {documents.map((document) => (
            <tr key={document.id} className="border-b border-border last:border-0">
              <td className="px-4 py-3 font-medium text-content-primary">
                {DOCUMENT_TYPE_LABELS[document.documentType]}
              </td>
              <td className="px-4 py-3 text-content-secondary">
                <a
                  href={document.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="focus-ring rounded text-brand-600 hover:underline dark:text-brand-400"
                >
                  {document.fileName ?? document.fileUrl}
                </a>
              </td>
              <td className="px-4 py-3 text-content-secondary">{document.uploadedAt}</td>
              <td className="px-4 py-3">
                <span
                  className={
                    document.active
                      ? 'inline-flex items-center rounded-full bg-success-500/10 px-2.5 py-1 text-xs font-medium text-success-500'
                      : 'inline-flex items-center rounded-full bg-surface-sunken px-2.5 py-1 text-xs font-medium text-content-tertiary'
                  }
                >
                  {document.active ? 'Active' : 'Archived'}
                </span>
              </td>
              {canManage && (
                <td className="px-4 py-3">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => onToggleActive(document)}
                      className={
                        document.active
                          ? 'focus-ring rounded-md px-2 py-1 text-xs font-medium text-danger-600 hover:bg-danger-50'
                          : 'focus-ring rounded-md px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/10'
                      }
                    >
                      {document.active ? 'Archive' : 'Restore'}
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </TableScrollContainer>
  );
}

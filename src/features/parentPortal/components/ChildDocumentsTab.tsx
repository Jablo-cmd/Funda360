import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { DocumentsTable } from '@/features/learners/components/DocumentsTable';
import { useDocuments } from '@/features/learners/hooks/useDocuments';

export interface ChildDocumentsTabProps {
  learnerId: string;
}

/**
 * Read-only reuse of the staff-facing DocumentsTable (canManage={false}
 * hides the archive/restore column). Authorization is entirely RLS-driven
 * — learner_documents_select_for_guardians / learner_documents_storage_
 * select_for_guardians (see 20260829120000_parent_portal_timetable_and_
 * documents.sql) — this component does no additional filtering, exactly
 * like ChildAttendanceTab/ChildAcademicsTab before it. Archived documents
 * are included, same as the staff view: a guardian seeing "Archived" next
 * to an old document is more honest than silently hiding it.
 */
export function ChildDocumentsTab({ learnerId }: ChildDocumentsTabProps) {
  const { documents, isLoading, error } = useDocuments(learnerId);

  if (isLoading) {
    return <LoadingBlock label="Loading documents…" />;
  }

  return (
    <div className="flex flex-col gap-4">
      <ErrorAlert message={error} />
      <DocumentsTable documents={documents} canManage={false} onToggleActive={() => undefined} />
    </div>
  );
}

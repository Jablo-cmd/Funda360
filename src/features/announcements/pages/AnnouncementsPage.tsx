import { useState } from 'react';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { NoActiveSchoolNotice } from '@/components/ui/NoActiveSchoolNotice';
import { useSchool } from '@/features/school/hooks/useSchool';
import { usePermissions } from '@/hooks/usePermissions';
import { useAnnouncements } from '@/features/announcements/hooks/useAnnouncements';
import { announcementService } from '@/features/announcements/services/announcementService';
import { AnnouncementFormModal } from '@/features/announcements/components/AnnouncementFormModal';
import { getDbErrorMessage } from '@/lib/dbErrors';

const AUDIENCE_LABELS: Record<string, string> = {
  everyone: 'Everyone',
  all_staff: 'Staff only',
  all_guardians: 'Guardians only',
};

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/**
 * Same page component renders at both /announcements (staff layout) and
 * /parent/announcements (Parent Portal layout) — exactly like
 * NotificationsPage already does for /notifications vs
 * /parent/notifications. RLS (announcements_select) is what actually
 * scopes which rows a caller sees by audience; canPost (school.manage)
 * just hides the posting affordance from anyone who'd get an RLS rejection
 * trying to use it — the real enforcement is server-side either way.
 */
export function AnnouncementsPage() {
  const { school } = useSchool();
  const { can } = usePermissions();
  const canPost = can('school.manage');
  const { announcements, isLoading, error, refetch } = useAnnouncements(school?.id);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleArchive = async (id: string) => {
    setActionError(null);
    try {
      await announcementService.archiveAnnouncement(id);
      await refetch();
    } catch (err) {
      setActionError(getDbErrorMessage(err, 'Failed to remove announcement.'));
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Announcements"
        description="School-wide updates."
        action={
          canPost && school ? (
            <div className="w-full sm:w-auto sm:min-w-[10rem]">
              <Button type="button" onClick={() => setIsFormOpen(true)}>
                Post announcement
              </Button>
            </div>
          ) : undefined
        }
      />

      <ErrorAlert message={error ?? actionError} />

      {!school ? (
        <NoActiveSchoolNotice resource="announcements" />
      ) : isLoading ? (
        <LoadingBlock label="Loading announcements…" />
      ) : announcements.length === 0 ? (
        <div className="rounded-card border border-border bg-surface-raised px-4 py-10 text-center text-sm text-content-tertiary">
          No announcements yet.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {announcements.map((announcement) => (
            <div key={announcement.id} className="rounded-card border border-border bg-surface-raised p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-content-primary">{announcement.title}</h3>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-surface-sunken px-2 py-0.5 text-xs font-medium text-content-tertiary">
                    {AUDIENCE_LABELS[announcement.audience]}
                  </span>
                  {canPost && (
                    <button
                      type="button"
                      onClick={() => void handleArchive(announcement.id)}
                      className="focus-ring rounded-md px-2 py-1 text-xs font-medium text-danger-600 hover:bg-danger-50"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-content-secondary">{announcement.body}</p>
              <p className="mt-2 text-xs text-content-tertiary">{formatDateTime(announcement.createdAt)}</p>
            </div>
          ))}
        </div>
      )}

      {school && (
        <AnnouncementFormModal
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          schoolId={school.id}
          onSaved={() => void refetch()}
        />
      )}
    </PageContainer>
  );
}

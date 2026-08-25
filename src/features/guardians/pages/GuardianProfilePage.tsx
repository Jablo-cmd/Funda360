import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { FullScreenSpinner } from '@/components/ui/FullScreenSpinner';
import { FullScreenNotice } from '@/components/ui/FullScreenNotice';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { usePermissions } from '@/hooks/usePermissions';
import { useSchool } from '@/features/school/hooks/useSchool';
import { useGuardianProfile } from '@/features/guardians/hooks/useGuardianProfile';
import { guardianDirectoryService } from '@/features/guardians/services/guardianDirectoryService';
import { guardianService } from '@/features/learners/services/guardianService';
import { GuardianRelationshipsTable } from '@/features/guardians/components/GuardianRelationshipsTable';
import { EditRelationshipModal } from '@/features/guardians/components/EditRelationshipModal';
import { LinkLearnerModal } from '@/features/guardians/components/LinkLearnerModal';
import { GuardianInvitationCard } from '@/features/guardians/components/GuardianInvitationCard';
import { getDbErrorMessage } from '@/lib/dbErrors';
import type { GuardianLearnerLink } from '@/features/guardians/types/guardian.types';

interface DetailsFormValues {
  address: string;
  idNumber: string;
}

export function GuardianProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can } = usePermissions();
  const canManage = can('guardian.manage');
  const { school } = useSchool();
  const { guardian, isLoading, error, refetch } = useGuardianProfile(id);

  const [editingLink, setEditingLink] = useState<GuardianLearnerLink | null>(null);
  const [isLinkOpen, setIsLinkOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting: isSavingDetails },
  } = useForm<DetailsFormValues>({ defaultValues: { address: '', idNumber: '' } });

  useEffect(() => {
    if (guardian) reset({ address: guardian.address ?? '', idNumber: guardian.idNumber ?? '' });
  }, [guardian, reset]);

  const handleArchive = async (link: GuardianLearnerLink) => {
    setActionError(null);
    try {
      await guardianService.archiveGuardian(link.relationshipId);
      await refetch();
    } catch (err) {
      setActionError(getDbErrorMessage(err, 'Failed to deactivate relationship.'));
    }
  };

  const handleRestore = async (link: GuardianLearnerLink) => {
    setActionError(null);
    try {
      await guardianService.restoreGuardian(link.relationshipId);
      await refetch();
    } catch (err) {
      setActionError(getDbErrorMessage(err, 'Failed to restore relationship.'));
    }
  };

  const onSaveDetails = async (values: DetailsFormValues) => {
    if (!school || !guardian) return;
    setActionError(null);
    try {
      await guardianDirectoryService.updateGuardianDetails(school.id, guardian.guardianProfileId, {
        address: values.address.trim() || null,
        idNumber: values.idNumber.trim() || null,
      });
      await refetch();
    } catch (err) {
      setActionError(getDbErrorMessage(err, 'Failed to save guardian details.'));
    }
  };

  if (isLoading) return <FullScreenSpinner label="Loading guardian…" />;
  if (error) return <FullScreenNotice title="Something went wrong" message={error} />;
  if (!guardian || !school) {
    return (
      <FullScreenNotice
        title="Guardian not found"
        message="This guardian doesn't exist, or you don't have access to view them."
      />
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <button
        type="button"
        onClick={() => navigate('/guardians')}
        className="focus-ring self-start rounded text-sm font-medium text-content-secondary hover:text-content-primary"
      >
        ← Back to Guardians
      </button>

      <div className="rounded-card border border-border bg-surface-raised p-6 shadow-card dark:shadow-card-dark">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-600 text-lg font-semibold text-white">
            {guardian.firstName[0]}
            {guardian.lastName[0]}
          </span>
          <div>
            <h1 className="text-xl font-bold text-content-primary">
              {guardian.firstName} {guardian.lastName}
            </h1>
            <p className="text-sm text-content-secondary">
              {[guardian.phone, guardian.email].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
      </div>

      <ErrorAlert message={actionError} />

      <GuardianInvitationCard
        guardianProfileId={guardian.guardianProfileId}
        guardianEmail={guardian.email}
        invitation={guardian.invitation}
        canManage={canManage}
        onChanged={() => void refetch()}
      />

      <div className="rounded-card border border-border bg-surface-raised p-6 shadow-card dark:shadow-card-dark">
        <h2 className="mb-4 text-sm font-semibold text-content-primary">Contact details</h2>
        <form onSubmit={handleSubmit(onSaveDetails)} className="flex flex-col gap-4">
          <TextField label="Address" disabled={!canManage} {...register('address')} />
          <TextField label="ID / reference number" disabled={!canManage} {...register('idNumber')} />
          {canManage && (
            <div className="w-full sm:w-auto sm:min-w-[9rem]">
              <Button type="submit" isLoading={isSavingDetails}>
                {isSavingDetails ? 'Saving…' : 'Save details'}
              </Button>
            </div>
          )}
        </form>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-content-primary">Linked learners</h2>
          {canManage && (
            <div className="w-full sm:w-auto sm:min-w-[10rem]">
              <Button type="button" variant="secondary" onClick={() => setIsLinkOpen(true)}>
                Link to another learner
              </Button>
            </div>
          )}
        </div>
        <GuardianRelationshipsTable
          links={guardian.links}
          canManage={canManage}
          onEdit={setEditingLink}
          onArchive={(link) => void handleArchive(link)}
          onRestore={(link) => void handleRestore(link)}
        />
      </div>

      <EditRelationshipModal
        isOpen={editingLink !== null}
        onClose={() => setEditingLink(null)}
        link={editingLink}
        onSaved={() => void refetch()}
      />
      <LinkLearnerModal
        isOpen={isLinkOpen}
        onClose={() => setIsLinkOpen(false)}
        schoolId={school.id}
        guardianProfileId={guardian.guardianProfileId}
        onSaved={() => void refetch()}
      />
    </div>
  );
}

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useEmergencyContacts } from '@/features/learners/hooks/useEmergencyContacts';
import { emergencyContactService } from '@/features/learners/services/emergencyContactService';
import { EmergencyContactsTable } from '@/features/learners/components/EmergencyContactsTable';
import { EmergencyContactFormModal } from '@/features/learners/components/EmergencyContactFormModal';
import { RemoveEmergencyContactDialog } from '@/features/learners/components/RemoveEmergencyContactDialog';
import type { LearnerEmergencyContact } from '@/features/learners/types/learner.types';

export interface LearnerEmergencyContactsSectionProps {
  schoolId: string;
  learnerId: string;
  canManage: boolean;
}

export function LearnerEmergencyContactsSection({
  schoolId,
  learnerId,
  canManage,
}: LearnerEmergencyContactsSectionProps) {
  const { emergencyContacts, isLoading, error, refetch } = useEmergencyContacts(learnerId);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<LearnerEmergencyContact | null>(null);
  const [removingContact, setRemovingContact] = useState<LearnerEmergencyContact | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const openCreate = () => {
    setEditingContact(null);
    setIsFormOpen(true);
  };

  const openEdit = (contact: LearnerEmergencyContact) => {
    setEditingContact(contact);
    setIsFormOpen(true);
  };

  const handleRestore = async (contact: LearnerEmergencyContact) => {
    setActionError(null);
    try {
      await emergencyContactService.restoreEmergencyContact(contact.id);
      await refetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to restore emergency contact.');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {canManage && (
        <div className="flex justify-end">
          <div className="w-full sm:w-auto sm:min-w-[9rem]">
            <Button type="button" onClick={openCreate}>
              Add contact
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
        <EmergencyContactsTable
          contacts={emergencyContacts}
          canManage={canManage}
          onEdit={openEdit}
          onRemove={setRemovingContact}
          onRestore={(contact) => void handleRestore(contact)}
        />
      )}

      <EmergencyContactFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        schoolId={schoolId}
        learnerId={learnerId}
        contact={editingContact}
        onSaved={() => void refetch()}
      />

      {removingContact && (
        <RemoveEmergencyContactDialog
          isOpen={removingContact !== null}
          onClose={() => setRemovingContact(null)}
          contact={removingContact}
          onRemoved={() => void refetch()}
        />
      )}
    </div>
  );
}

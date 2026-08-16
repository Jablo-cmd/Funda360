import type { LearnerEmergencyContact } from '@/features/learners/types/learner.types';

export interface EmergencyContactsTableProps {
  contacts: LearnerEmergencyContact[];
  canManage: boolean;
  onEdit: (contact: LearnerEmergencyContact) => void;
  onRemove: (contact: LearnerEmergencyContact) => void;
  onRestore: (contact: LearnerEmergencyContact) => void;
}

export function EmergencyContactsTable({ contacts, canManage, onEdit, onRemove, onRestore }: EmergencyContactsTableProps) {
  if (contacts.length === 0) {
    return (
      <div className="rounded-card border border-border bg-surface-raised px-4 py-10 text-center text-sm text-content-tertiary">
        No emergency contacts added yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface-raised">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-content-tertiary">
            <th scope="col" className="px-4 py-3 font-medium">
              Name
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Relationship
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              Phone
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
          {contacts.map((contact) => (
            <tr key={contact.id} className="border-b border-border last:border-0">
              <td className="px-4 py-3 font-medium text-content-primary">{contact.name}</td>
              <td className="px-4 py-3 text-content-secondary">{contact.relationship ?? '—'}</td>
              <td className="px-4 py-3 text-content-secondary">{contact.phone}</td>
              <td className="px-4 py-3">
                <span
                  className={
                    contact.active
                      ? 'inline-flex items-center rounded-full bg-success-500/10 px-2.5 py-1 text-xs font-medium text-success-500'
                      : 'inline-flex items-center rounded-full bg-surface-sunken px-2.5 py-1 text-xs font-medium text-content-tertiary'
                  }
                >
                  {contact.active ? 'Active' : 'Removed'}
                </span>
              </td>
              {canManage && (
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => onEdit(contact)}
                      className="focus-ring rounded-md px-2 py-1 text-xs font-medium text-content-secondary hover:bg-surface-sunken hover:text-content-primary"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => (contact.active ? onRemove(contact) : onRestore(contact))}
                      className={
                        contact.active
                          ? 'focus-ring rounded-md px-2 py-1 text-xs font-medium text-danger-600 hover:bg-danger-50'
                          : 'focus-ring rounded-md px-2 py-1 text-xs font-medium text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-500/10'
                      }
                    >
                      {contact.active ? 'Remove' : 'Restore'}
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

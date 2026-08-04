import type { LearnerEmergencyContact } from '@/features/learners/types/learner.types';

export interface EmergencyContactsTableProps {
  contacts: LearnerEmergencyContact[];
  canManage: boolean;
  onEdit: (contact: LearnerEmergencyContact) => void;
}

export function EmergencyContactsTable({ contacts, canManage, onEdit }: EmergencyContactsTableProps) {
  if (contacts.length === 0) {
    return (
      <div className="rounded-card border border-border bg-surface-raised px-4 py-10 text-center text-sm text-content-tertiary">
        No emergency contacts added yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface-raised">
      <table className="w-full min-w-[560px] text-left text-sm">
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
              {canManage && (
                <td className="px-4 py-3">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => onEdit(contact)}
                      className="focus-ring rounded-md px-2 py-1 text-xs font-medium text-content-secondary hover:bg-surface-sunken hover:text-content-primary"
                    >
                      Edit
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

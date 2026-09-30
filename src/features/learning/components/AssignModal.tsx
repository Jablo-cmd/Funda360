import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { ErrorAlert } from '@/components/ui/ErrorAlert';

export interface AssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** What is being assigned, shown in the heading. */
  itemTitle: string;
  className: string;
  onAssign: (input: { instructions: string; dueAt: string | null }) => Promise<void>;
}

export function AssignModal({ isOpen, onClose, itemTitle, className, onAssign }: AssignModalProps) {
  const [dueDate, setDueDate] = useState('');
  const [instructions, setInstructions] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setIsSaving(true);
    setError(null);
    try {
      await onAssign({
        instructions: instructions.trim(),
        // End of the chosen day in the teacher's own time zone.
        dueAt: dueDate ? new Date(`${dueDate}T17:00:00`).toISOString() : null,
      });
      setDueDate('');
      setInstructions('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not assign this. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Assign to ${className}`}
      footer={
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <div className="sm:w-auto sm:min-w-[8rem]">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          </div>
          <div className="sm:w-auto sm:min-w-[8rem]">
            <Button type="button" onClick={() => void submit()} isLoading={isSaving}>
              Assign
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <ErrorAlert message={error} />
        <p className="break-words text-sm text-content-primary">
          <span className="text-content-secondary">Assigning: </span>
          <strong>{itemTitle}</strong>
        </p>
        <TextField
          label="Due date (optional)"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
        <TextField
          label="Note for the class (optional)"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          maxLength={300}
        />
      </div>
    </Modal>
  );
}

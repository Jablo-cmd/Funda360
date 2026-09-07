import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { Checkbox } from '@/components/ui/Checkbox';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import type { Class, Subject } from '@/features/academic/types/academic.types';
import { homeworkService } from '@/features/homework/services/homeworkService';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface CreateAssignmentModalProps {
  schoolId: string;
  academicYearId: string | null;
  classes: Class[];
  subjects: Subject[];
  onClose: () => void;
  onCreated: (assignmentId: string) => void;
}

export function CreateAssignmentModal({
  schoolId,
  academicYearId,
  classes,
  subjects,
  onClose,
  onCreated,
}: CreateAssignmentModalProps) {
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [maxPoints, setMaxPoints] = useState('');
  const [allowResubmission, setAllowResubmission] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async () => {
    if (!academicYearId) {
      setError('No active academic year — set one before creating homework.');
      return;
    }
    if (!classId || !subjectId || title.trim().length === 0) {
      setError('Class, subject and a title are required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const id = await homeworkService.createAssignment(schoolId, academicYearId, {
        classId,
        subjectId,
        title: title.trim(),
        instructions: instructions.trim() || undefined,
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        maxPoints: maxPoints ? Number(maxPoints) : null,
        allowResubmission,
      });
      onCreated(id);
    } catch (err) {
      setError(getDbErrorMessage(err, 'Could not create this assignment.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="New assignment"
      footer={
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleSubmit()} isLoading={busy}>
            Create draft
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <ErrorAlert message={error} />
        <label className="text-sm font-medium text-content-primary">
          Class
          <select
            className="mt-1 h-11 w-full rounded-md border border-border-strong bg-surface-raised px-3 text-sm"
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
          >
            <option value="">Select a class</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-content-primary">
          Subject
          <select
            className="mt-1 h-11 w-full rounded-md border border-border-strong bg-surface-raised px-3 text-sm"
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
          >
            <option value="">Select a subject</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <label className="text-sm font-medium text-content-primary">
          Instructions
          <textarea
            className="mt-1 min-h-[5rem] w-full rounded-md border border-border-strong bg-surface-raised p-2 text-sm"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />
        </label>
        <div className="flex gap-3">
          <TextField
            label="Due"
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            containerClassName="flex-1"
          />
          <TextField
            label="Max points"
            type="number"
            min={1}
            value={maxPoints}
            onChange={(e) => setMaxPoints(e.target.value)}
            containerClassName="w-32"
          />
        </div>
        <Checkbox
          label="Allow resubmission"
          checked={allowResubmission}
          onChange={(e) => setAllowResubmission(e.target.checked)}
        />
      </div>
    </Modal>
  );
}

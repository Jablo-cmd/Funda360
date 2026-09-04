import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { getDbErrorMessage } from '@/lib/dbErrors';
import { admissionService } from '@/features/admissions/services/admissionService';
import { useClasses } from '@/features/academic/hooks/useClasses';
import { useGrades } from '@/features/academic/hooks/useGrades';
import type { AdmissionApplication } from '@/features/admissions/types/admission.types';

export interface ConvertApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  application: AdmissionApplication;
  onConverted: () => void;
}

export function ConvertApplicationModal({ isOpen, onClose, application, onConverted }: ConvertApplicationModalProps) {
  const { classes } = useClasses(application.schoolId);
  const { grades } = useGrades(application.schoolId);
  const [classId, setClassId] = useState('');
  const [provisionAccount, setProvisionAccount] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setClassId('');
      setProvisionAccount(true);
      setError(null);
    }
  }, [isOpen]);

  const gradeName = grades.find((g) => g.id === application.requestedGradeId)?.name;
  const eligibleClasses = useMemo(
    () => classes.filter((c) => !application.requestedGradeId || c.gradeId === application.requestedGradeId),
    [classes, application.requestedGradeId],
  );

  const convert = async () => {
    setBusy(true);
    setError(null);
    try {
      await admissionService.convert(application.id, classId || null, provisionAccount);
      onConverted();
      onClose();
    } catch (err) {
      setError(getDbErrorMessage(err, 'Conversion failed.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Convert to learner"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button onClick={convert} isLoading={busy} disabled={!application.requestedGradeId}>
            Create learner &amp; enrol
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 text-sm">
        {error && (
          <p role="alert" className="rounded-md bg-danger-50 px-3 py-2 text-danger-600">
            {error}
          </p>
        )}
        {!application.requestedGradeId ? (
          <p className="rounded-md bg-warning-50 px-3 py-2 text-warning-600 dark:bg-warning-500/15 dark:text-warning-500">
            Set the requested grade on the application before converting.
          </p>
        ) : (
          <p className="text-content-secondary">
            This creates a learner record ({gradeName}), links{' '}
            <strong>
              {application.applicantFirstName} {application.applicantLastName}
            </strong>{' '}
            ({application.applicantEmail}) as the guardian, and creates an enrolment for the application&apos;s academic year. An existing
            guardian with the same email is reused, not duplicated.
          </p>
        )}

        <div>
          <label htmlFor="convert-class" className="mb-1.5 block font-medium text-content-primary">
            Class (optional)
          </label>
          <select
            id="convert-class"
            className="focus-ring h-11 w-full rounded-md border border-border-strong bg-surface-raised px-3 text-sm"
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
          >
            <option value="">Assign later</option>
            {eligibleClasses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 text-content-secondary">
          <input type="checkbox" checked={provisionAccount} onChange={(e) => setProvisionAccount(e.target.checked)} className="h-4 w-4 rounded border-border-strong" />
          Send the guardian a portal activation invitation
        </label>
      </div>
    </Modal>
  );
}

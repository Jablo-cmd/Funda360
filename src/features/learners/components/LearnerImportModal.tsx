import { useRef, useState, type ChangeEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TableScrollContainer } from '@/components/ui/TableScrollContainer';
import { learnerService } from '@/features/learners/services/learnerService';
import {
  importGuardians,
  type GuardianImportResult,
} from '@/features/learners/services/guardianImportService';
import {
  parseLearnerImportCsv,
  LEARNER_IMPORT_HEADERS,
  GUARDIAN_IMPORT_HEADERS,
} from '@/features/learners/utils/csvImport';
import type { LearnerImportSummary } from '@/features/learners/utils/csvImport';
import { toCsv } from '@/lib/csv';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface LearnerImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
  onImported: () => void;
}

const TEMPLATE_ROW = {
  learnerNumber: 'LRN-0101',
  admissionNumber: 'ADM-0101',
  firstName: 'Naledi',
  lastName: 'Dube',
  dateOfBirth: '2013-05-01',
  admissionDate: '2026-01-15',
  gender: 'female',
  homeLanguage: 'English',
  guardianFirstName: 'Thandi',
  guardianLastName: 'Dube',
  guardianEmail: 'thandi.dube@example.com',
  guardianPhone: '0821234567',
  guardianRelationship: 'mother',
};

const TEMPLATE_HEADERS = [...LEARNER_IMPORT_HEADERS, ...GUARDIAN_IMPORT_HEADERS];

function downloadTemplate() {
  const csv = toCsv(
    [TEMPLATE_ROW],
    TEMPLATE_HEADERS.map((key) => ({ key, header: key })),
  );
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'learner-import-template.csv';
  link.click();
  URL.revokeObjectURL(url);
}

export function LearnerImportModal({
  isOpen,
  onClose,
  schoolId,
  onImported,
}: LearnerImportModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [summary, setSummary] = useState<LearnerImportSummary | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState<number | null>(null);
  const [inviteGuardians, setInviteGuardians] = useState(true);
  const [guardianResult, setGuardianResult] = useState<GuardianImportResult | null>(null);

  const reset = () => {
    setFileName(null);
    setSummary(null);
    setError(null);
    setImportedCount(null);
    setGuardianResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError(null);
    setImportedCount(null);
    setIsParsing(true);
    try {
      const text = await file.text();
      const { learnerNumbers, admissionNumbers } =
        await learnerService.getExistingNumbers(schoolId);
      setSummary(parseLearnerImportCsv(text, learnerNumbers, admissionNumbers));
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to read the file.'));
    } finally {
      setIsParsing(false);
    }
  };

  const handleImport = async () => {
    if (!summary || summary.validRows.length === 0) return;
    setError(null);
    setIsImporting(true);
    try {
      const created = await learnerService.bulkCreateLearners(schoolId, summary.validRows);
      setImportedCount(created.length);
      onImported();

      const idByNumber = new Map(created.map((learner) => [learner.learnerNumber, learner.id]));
      const links = summary.validRows.flatMap((row, index) => {
        const guardian = summary.validGuardians[index];
        const learnerId = idByNumber.get(row.learnerNumber);
        return guardian && learnerId
          ? [{ learnerId, learnerLabel: `${row.firstName} ${row.lastName}`, guardian }]
          : [];
      });
      if (links.length > 0) {
        setGuardianResult(await importGuardians(schoolId, links, { invite: inviteGuardians }));
      }
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to import learners.'));
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Import learners from CSV"
      footer={
        summary &&
        summary.validRows.length > 0 &&
        importedCount === null && (
          <Button type="button" onClick={() => void handleImport()} isLoading={isImporting}>
            {isImporting
              ? 'Importing…'
              : `Import ${summary.validRows.length} learner${summary.validRows.length === 1 ? '' : 's'}`}
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-4">
        {error && (
          <div
            role="alert"
            className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600"
          >
            {error}
          </div>
        )}

        {importedCount !== null ? (
          <>
            <div
              role="status"
              className="rounded-lg border border-success-500/30 bg-success-500/10 px-3.5 py-2.5 text-sm font-medium text-success-500"
            >
              {importedCount} learner{importedCount === 1 ? '' : 's'} imported successfully.
              {guardianResult && (
                <span className="mt-1 block">
                  Guardians: {guardianResult.created} added, {guardianResult.reused} already on
                  file, {guardianResult.linked} link{guardianResult.linked === 1 ? '' : 's'} made
                  {inviteGuardians
                    ? `, ${guardianResult.invited} invitation${guardianResult.invited === 1 ? '' : 's'} sent`
                    : ''}
                  .
                </span>
              )}
            </div>
            {guardianResult && guardianResult.errors.length > 0 && (
              <div
                role="alert"
                className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm text-danger-600"
              >
                <p className="font-medium">
                  Some guardians need attention (the learners were saved):
                </p>
                <ul className="mt-1 list-disc pl-5">
                  {guardianResult.errors.map((message) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="text-sm text-content-secondary">
              Upload a CSV with the columns{' '}
              <code className="rounded bg-surface-sunken px-1.5 py-0.5 font-mono text-xs">
                {LEARNER_IMPORT_HEADERS.join(', ')}
              </code>
              . Rows are checked against your existing roster and against each other for duplicate
              learner/admission numbers before anything is saved. Optionally add a guardian per row
              with{' '}
              <code className="rounded bg-surface-sunken px-1.5 py-0.5 font-mono text-xs">
                {GUARDIAN_IMPORT_HEADERS.join(', ')}
              </code>
              ; siblings who share a guardian email are linked to one guardian.
            </p>

            <button
              type="button"
              onClick={downloadTemplate}
              className="focus-ring w-fit rounded text-sm font-medium text-brand-600 hover:underline dark:text-brand-300"
            >
              Download a template CSV
            </button>

            <div>
              <label
                htmlFor="learner-import-file"
                className="mb-1.5 block text-sm font-medium text-content-primary"
              >
                CSV file
              </label>
              <input
                ref={fileInputRef}
                id="learner-import-file"
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => void handleFileChange(event)}
                className="focus-ring block w-full text-sm text-content-secondary file:mr-3 file:rounded-md file:border-0 file:bg-brand-600 file:px-3.5 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-brand-500"
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-content-secondary">
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand-600"
                checked={inviteGuardians}
                onChange={(event) => setInviteGuardians(event.target.checked)}
              />
              Email new guardians an invitation to the parent portal
            </label>

            {isParsing && <p className="text-sm text-content-tertiary">Reading {fileName}…</p>}

            {summary && (
              <div className="flex flex-col gap-3">
                <p className="text-sm font-medium text-content-primary">
                  {summary.validRows.length} valid, {summary.invalidCount} with errors.
                </p>
                {summary.results.length > 0 && (
                  <TableScrollContainer>
                    <table className="w-full min-w-[560px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-border text-xs uppercase tracking-wide text-content-tertiary">
                          <th scope="col" className="px-3 py-2 font-medium">
                            Row
                          </th>
                          <th scope="col" className="px-3 py-2 font-medium">
                            Learner
                          </th>
                          <th scope="col" className="px-3 py-2 font-medium">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.results.map((result) => (
                          <tr
                            key={result.rowNumber}
                            className="border-b border-border last:border-0"
                          >
                            <td className="px-3 py-2 font-mono text-content-tertiary">
                              {result.rowNumber || '—'}
                            </td>
                            <td className="px-3 py-2 text-content-primary">
                              {result.raw.firstName || result.raw.lastName
                                ? `${result.raw.firstName} ${result.raw.lastName}`
                                : '—'}
                            </td>
                            <td className="px-3 py-2">
                              {result.errors.length === 0 ? (
                                <span className="text-success-500">Ready to import</span>
                              ) : (
                                <span className="text-danger-600">{result.errors.join(' ')}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </TableScrollContainer>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

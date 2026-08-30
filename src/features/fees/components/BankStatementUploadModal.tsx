import { useRef, useState, type ChangeEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { bankReconciliationService } from '@/features/fees/services/bankReconciliationService';
import { parseBankStatementCsv, BANK_STATEMENT_IMPORT_HEADERS } from '@/features/fees/utils/bankStatementImport';
import type { BankStatementImportSummary } from '@/features/fees/utils/bankStatementImport';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface BankStatementUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolId: string;
  onUploaded: () => void;
}

export function BankStatementUploadModal({ isOpen, onClose, schoolId, onUploaded }: BankStatementUploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [summary, setSummary] = useState<BankStatementImportSummary | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedCount, setUploadedCount] = useState<number | null>(null);

  const reset = () => {
    setFileName(null);
    setSummary(null);
    setError(null);
    setUploadedCount(null);
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
    setUploadedCount(null);
    try {
      const text = await file.text();
      setSummary(parseBankStatementCsv(text));
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to read the file.'));
    }
  };

  const handleUpload = async () => {
    if (!summary || summary.validRows.length === 0 || !fileName) return;
    setError(null);
    setIsUploading(true);
    try {
      await bankReconciliationService.uploadStatement(schoolId, fileName, summary.validRows);
      setUploadedCount(summary.validRows.length);
      onUploaded();
    } catch (err) {
      setError(getDbErrorMessage(err, 'Failed to upload the statement.'));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Upload bank statement"
      footer={
        summary &&
        summary.validRows.length > 0 &&
        uploadedCount === null && (
          <Button type="button" onClick={() => void handleUpload()} isLoading={isUploading}>
            {isUploading ? 'Uploading…' : `Upload ${summary.validRows.length} line${summary.validRows.length === 1 ? '' : 's'}`}
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-4">
        {error && (
          <div role="alert" className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-600">
            {error}
          </div>
        )}

        {uploadedCount !== null ? (
          <div role="status" className="rounded-lg border border-success-500/30 bg-success-500/10 px-3.5 py-2.5 text-sm font-medium text-success-500">
            {uploadedCount} line{uploadedCount === 1 ? '' : 's'} uploaded. Match them against existing payments from the reconciliation workspace.
          </div>
        ) : (
          <>
            <p className="text-sm text-content-secondary">
              Upload a CSV with the columns{' '}
              <code className="rounded bg-surface-sunken px-1.5 py-0.5 font-mono text-xs">{BANK_STATEMENT_IMPORT_HEADERS.join(', ')}</code>. Only
              incoming payments (credits) — filter your bank export to deposits before uploading. Nothing is matched automatically; you confirm
              each match afterward.
            </p>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="focus-ring rounded-lg border border-dashed border-border-strong px-4 py-6 text-center text-sm text-content-secondary hover:border-brand-500 hover:text-brand-600"
            >
              {fileName ?? 'Click to choose a CSV file'}
            </button>
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => void handleFileChange(e)} />

            {summary && (
              <div className="rounded-card border border-border bg-surface-raised p-3.5 text-sm">
                <p className="font-medium text-content-primary">
                  {summary.validRows.length} valid line{summary.validRows.length === 1 ? '' : 's'}
                  {summary.invalidCount > 0 && `, ${summary.invalidCount} with errors`}
                </p>
                {summary.invalidCount > 0 && (
                  <ul className="mt-2 flex flex-col gap-1 text-xs text-danger-600">
                    {summary.results
                      .filter((r) => r.errors.length > 0)
                      .slice(0, 10)
                      .map((r) => (
                        <li key={r.rowNumber}>
                          Row {r.rowNumber}: {r.errors.join(' ')}
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

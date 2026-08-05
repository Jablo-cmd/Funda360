import { Button } from '@/components/ui/Button';
import { usePermissions } from '@/hooks/usePermissions';
import { toCsv } from '@/lib/csv';
import type { CsvColumn } from '@/lib/csv';
import { downloadCsv } from '@/features/reports/utils/downloadCsv';

export interface ExportCsvButtonProps<T extends object> {
  rows: T[];
  columns: readonly CsvColumn<T>[];
  filename: string;
  label?: string;
}

/** Renders nothing unless the signed-in user holds `reports.export`. */
export function ExportCsvButton<T extends object>({
  rows,
  columns,
  filename,
  label = 'Export CSV',
}: ExportCsvButtonProps<T>) {
  const { can } = usePermissions();
  if (!can('reports.export')) return null;

  return (
    <Button type="button" variant="secondary" className="w-auto" onClick={() => downloadCsv(filename, toCsv(rows, columns))}>
      {label}
    </Button>
  );
}

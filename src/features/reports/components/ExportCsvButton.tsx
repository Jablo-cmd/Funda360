import { Button } from '@/components/ui/Button';
import { usePermissions } from '@/hooks/usePermissions';
import { toCsv } from '@/lib/csv';
import type { CsvColumn } from '@/lib/csv';
import type { Permission } from '@/features/rbac/types/permission.types';
import { downloadCsv } from '@/features/reports/utils/downloadCsv';

export interface ExportCsvButtonProps<T extends object> {
  rows: T[];
  columns: readonly CsvColumn<T>[];
  filename: string;
  label?: string;
  /**
   * Defaults to `reports.export` (every Reports-module page). Finance's
   * export actions live outside the Reports module and are correctly
   * gated on its own permission tier instead — `learner.manage_financial`
   * is deliberately not one of the `.manage`-tier permissions that grant
   * `reports.export` (see rolePermissions.ts's own documented rule), so
   * reusing the default here would silently hide the button from
   * finance_manager/accountant, the exact roles it's for.
   */
  permission?: Permission;
}

/** Renders nothing unless the signed-in user holds the required permission (`reports.export` by default). */
export function ExportCsvButton<T extends object>({
  rows,
  columns,
  filename,
  label = 'Export CSV',
  permission = 'reports.export',
}: ExportCsvButtonProps<T>) {
  const { can } = usePermissions();
  if (!can(permission)) return null;

  return (
    <Button type="button" variant="secondary" className="w-auto" onClick={() => downloadCsv(filename, toCsv(rows, columns))}>
      {label}
    </Button>
  );
}

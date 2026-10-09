// The only way AI tools read Funda360 data: a narrow, read-only query
// interface. The production implementation wraps a supabase-js client that
// carries the signed-in user's JWT, so every query runs under the same RLS
// policies as the user's own screens. Tools never receive a service-role
// client, and there is no write method.

import type { SupabaseClient } from '@supabase/supabase-js';

export type Filter =
  | { op: 'eq'; column: string; value: string | number | boolean }
  | { op: 'gte' | 'lte'; column: string; value: string | number }
  | { op: 'or'; expression: string };

export interface QuerySpec {
  table: string;
  select: string;
  filters?: Filter[];
  order?: { column: string; ascending: boolean };
  limit: number;
}

export interface DataError {
  code: string;
  message: string;
}

export interface ReadOnlyData {
  query(spec: QuerySpec): Promise<{ rows: Record<string, unknown>[]; error: DataError | null }>;
  rpc(fn: string, args: Record<string, unknown>): Promise<{ data: unknown; error: DataError | null }>;
}

/** Read-only data access as the user whose JWT the client carries. */
export function userScopedData(client: SupabaseClient): ReadOnlyData {
  return {
    async query(spec) {
      let q = client.from(spec.table).select(spec.select);
      for (const f of spec.filters ?? []) {
        if (f.op === 'or') q = q.or(f.expression);
        else if (f.op === 'eq') q = q.eq(f.column, f.value);
        else if (f.op === 'gte') q = q.gte(f.column, f.value);
        else q = q.lte(f.column, f.value);
      }
      if (spec.order) q = q.order(spec.order.column, { ascending: spec.order.ascending });
      const { data, error } = await q.limit(spec.limit);
      return {
        rows: (data ?? []) as unknown as Record<string, unknown>[],
        error: error ? { code: error.code ?? 'unknown', message: error.message } : null,
      };
    },
    async rpc(fn, args) {
      const { data, error } = await client.rpc(fn, args);
      return { data, error: error ? { code: error.code ?? 'unknown', message: error.message } : null };
    },
  };
}

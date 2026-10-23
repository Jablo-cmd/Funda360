// Tool registry: the complete list of things Funda AI can look up.
//
// Every tool is read-only and declares its schemas, the roles that may use
// it and the scope it reads. The registry checks, in order: the feature
// policy allows the tool, the caller's role is allowed, the input matches
// the schema. The tool then runs through ReadOnlyData as the user, so RLS
// decides which rows exist; the output is validated before the model sees
// it. Database errors are reduced to a generic code so no internals reach
// the model.

import type { ReadOnlyData } from './data.ts';
import { type JsonSchema, validate } from './schema.ts';

export interface Principal {
  userId: string;
  schoolId: string | null;
  role: string;
}

export interface ToolContext {
  data: ReadOnlyData;
  principal: Principal;
  /** YYYY-MM-DD, Africa/Johannesburg. */
  today: string;
}

export interface ToolOutput {
  result: Record<string, unknown>;
  resultCount: number;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  outputSchema: JsonSchema;
  allowedRoles: string[];
  /** The existing Funda360 permission the underlying RLS policy implements. */
  requiredCapability: string;
  scope: 'school' | 'learner' | 'reporting';
  /** Returns personal information about a learner. */
  sensitive: boolean;
  run(input: Record<string, unknown>, ctx: ToolContext): Promise<ToolOutput>;
}

export type ToolStatus = 'ok' | 'empty' | 'denied' | 'invalid_input' | 'invalid_output' | 'error';

export interface ToolExecution {
  status: ToolStatus;
  /** What the model receives. */
  payload: Record<string, unknown>;
  resultCount: number;
  errorCode: string | null;
  durationMs: number;
}

/** Thrown by tools; the code is safe to show to the model. */
export class ToolFailure extends Error {
  constructor(readonly status: 'denied' | 'error', readonly code: string) {
    super(code);
  }
}

const STAFF_ACADEMIC = ['school_owner', 'principal', 'teacher', 'class_teacher', 'subject_teacher'];
const STAFF_LEARNERS = ['school_owner', 'principal', 'vice_principal', 'department_head', 'teacher', 'class_teacher', 'subject_teacher'];
const STAFF_FINANCE = ['school_owner', 'principal', 'finance_manager'];

const LEARNER_ID: JsonSchema = { type: 'string', format: 'uuid', description: 'learner_id returned by find_learners.' };
const DATE: JsonSchema = { type: 'string', format: 'date', description: 'YYYY-MM-DD' };
const NUM_OR_NULL: JsonSchema = { type: ['number', 'null'] };

function checkData(error: { code: string } | null) {
  if (!error) return;
  // 42501 / PGRST301: the database refused; anything else is a generic failure.
  if (error.code === '42501' || error.code === 'PGRST301') throw new ToolFailure('denied', 'out_of_scope');
  throw new ToolFailure('error', 'data_unavailable');
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function period(input: Record<string, unknown>, today: string, defaultDays: number): { from: string; to: string } {
  const to = (input.to as string | undefined) ?? today;
  const from = (input.from as string | undefined) ?? addDays(to, -defaultDays);
  if (from > to) throw new ToolFailure('error', 'invalid_period');
  if (Date.parse(to) - Date.parse(from) > 400 * 86_400_000) throw new ToolFailure('error', 'period_too_long');
  return { from, to };
}

const toCents = (value: unknown) => Math.round(Number(value ?? 0) * 100);
const rands = (cents: number) => Math.round(cents) / 100;

// ---------------------------------------------------------------------------

const findLearners: ToolDefinition = {
  name: 'find_learners',
  description:
    'Find learners you can access by name or learner number. Returns learner_id values for the other tools. Returns nothing for learners outside your access.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['query'],
    properties: {
      query: { type: 'string', minLength: 2, maxLength: 60, description: 'Part of a first name, surname or learner number.' },
      limit: { type: 'integer', minimum: 1, maximum: 20 },
    },
  },
  outputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['learners', 'count', 'truncated'],
    properties: {
      learners: {
        type: 'array',
        maxItems: 20,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['learner_id', 'name', 'learner_number', 'status'],
          properties: {
            learner_id: { type: 'string', format: 'uuid' },
            name: { type: 'string', maxLength: 200 },
            learner_number: { type: ['string', 'null'], maxLength: 60 },
            status: { type: ['string', 'null'], maxLength: 40 },
          },
        },
      },
      count: { type: 'integer' },
      truncated: { type: 'boolean' },
    },
  },
  allowedRoles: STAFF_LEARNERS,
  requiredCapability: 'can_view_learners',
  scope: 'school',
  sensitive: true,
  async run(input, ctx) {
    // Only letters, digits, spaces and hyphens reach the filter: PostgREST
    // filter syntax (commas, dots, brackets, asterisks) cannot be injected.
    const tokens = String(input.query)
      .normalize('NFKC')
      .replace(/[^\p{L}\p{N} -]/gu, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 2)
      .slice(0, 3);
    if (tokens.length === 0) throw new ToolFailure('error', 'query_too_short');
    const limit = (input.limit as number | undefined) ?? 10;
    const { rows, error } = await ctx.data.query({
      table: 'learners',
      select: 'id, first_name, last_name, preferred_name, learner_number, status',
      filters: tokens.map((t) => ({
        op: 'or' as const,
        expression: `first_name.ilike.*${t}*,last_name.ilike.*${t}*,preferred_name.ilike.*${t}*,learner_number.ilike.*${t}*`,
      })),
      order: { column: 'last_name', ascending: true },
      limit: limit + 1,
    });
    checkData(error);
    const learners = rows.slice(0, limit).map((r) => ({
      learner_id: String(r.id),
      name: [r.preferred_name || r.first_name, r.last_name].filter(Boolean).join(' '),
      learner_number: (r.learner_number as string | null) ?? null,
      status: (r.status as string | null) ?? null,
    }));
    return { result: { learners, count: learners.length, truncated: rows.length > limit }, resultCount: learners.length };
  },
};

// Attendance rate: (present + late) / (present + late + absent); excused days
// do not count. Same definition as src/features/attendance/utils/calculations.ts.
const attendanceSummary: ToolDefinition = {
  name: 'get_learner_attendance_summary',
  description:
    'Attendance counts and rate for one learner over a period (default: the last 90 days). Rate = (present + late) / (present + late + absent); excused days are excluded.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['learner_id'],
    properties: { learner_id: LEARNER_ID, from: DATE, to: DATE },
  },
  outputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['learner_id', 'period_from', 'period_to', 'data_available', 'records', 'present', 'late', 'absent', 'excused', 'qualifying_days', 'attendance_rate_percent', 'truncated'],
    properties: {
      learner_id: { type: 'string', format: 'uuid' },
      period_from: { type: 'string', format: 'date' },
      period_to: { type: 'string', format: 'date' },
      data_available: { type: 'boolean' },
      records: { type: 'integer' },
      present: { type: 'integer' },
      late: { type: 'integer' },
      absent: { type: 'integer' },
      excused: { type: 'integer' },
      qualifying_days: { type: 'integer' },
      attendance_rate_percent: NUM_OR_NULL,
      truncated: { type: 'boolean' },
    },
  },
  allowedRoles: STAFF_ACADEMIC,
  requiredCapability: 'can_view_academic',
  scope: 'learner',
  sensitive: true,
  async run(input, ctx) {
    const { from, to } = period(input, ctx.today, 90);
    const max = 1000;
    const { rows, error } = await ctx.data.query({
      table: 'attendance_records',
      select: 'status, attendance_date',
      filters: [
        { op: 'eq', column: 'learner_id', value: String(input.learner_id) },
        { op: 'gte', column: 'attendance_date', value: from },
        { op: 'lte', column: 'attendance_date', value: to },
      ],
      order: { column: 'attendance_date', ascending: false },
      limit: max + 1,
    });
    checkData(error);
    const counted = rows.slice(0, max);
    const counts = { present: 0, late: 0, absent: 0, excused: 0 };
    for (const r of counted) {
      const s = r.status as keyof typeof counts;
      if (s in counts) counts[s] += 1;
    }
    const qualifying = counts.present + counts.late + counts.absent;
    return {
      result: {
        learner_id: String(input.learner_id),
        period_from: from,
        period_to: to,
        data_available: counted.length > 0,
        records: counted.length,
        ...counts,
        qualifying_days: qualifying,
        attendance_rate_percent: qualifying === 0 ? null : Math.round(((counts.present + counts.late) / qualifying) * 100),
        truncated: rows.length > max,
      },
      resultCount: counted.length,
    };
  },
};

// Percentages per result are rounded to whole numbers and averaged without
// weighting, as in src/features/assessments/utils/reportCard.ts.
const assessmentSummary: ToolDefinition = {
  name: 'get_learner_assessment_summary',
  description:
    'Marked assessment results for one learner over a period (default: the last 365 days): unweighted average percentage per subject and overall, and the most recent results.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['learner_id'],
    properties: { learner_id: LEARNER_ID, from: DATE, to: DATE },
  },
  outputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['learner_id', 'period_from', 'period_to', 'data_available', 'results', 'overall_average_percent', 'subjects', 'recent', 'truncated'],
    properties: {
      learner_id: { type: 'string', format: 'uuid' },
      period_from: { type: 'string', format: 'date' },
      period_to: { type: 'string', format: 'date' },
      data_available: { type: 'boolean' },
      results: { type: 'integer' },
      overall_average_percent: NUM_OR_NULL,
      subjects: {
        type: 'array',
        maxItems: 40,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['subject', 'results', 'average_percent'],
          properties: { subject: { type: 'string', maxLength: 120 }, results: { type: 'integer' }, average_percent: { type: 'number' } },
        },
      },
      recent: {
        type: 'array',
        maxItems: 5,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['title', 'subject', 'date', 'percent'],
          properties: {
            title: { type: 'string', maxLength: 200 },
            subject: { type: 'string', maxLength: 120 },
            date: { type: 'string', format: 'date' },
            percent: { type: 'number' },
          },
        },
      },
      truncated: { type: 'boolean' },
    },
  },
  allowedRoles: STAFF_ACADEMIC,
  requiredCapability: 'can_view_academic',
  scope: 'learner',
  sensitive: true,
  async run(input, ctx) {
    const { from, to } = period(input, ctx.today, 365);
    const max = 1000;
    const { rows, error } = await ctx.data.query({
      table: 'assessment_results',
      select: 'mark, assessments!inner(title, assessment_date, max_mark, active, subjects(name))',
      filters: [
        { op: 'eq', column: 'learner_id', value: String(input.learner_id) },
        { op: 'eq', column: 'assessments.active', value: true },
        { op: 'gte', column: 'assessments.assessment_date', value: from },
        { op: 'lte', column: 'assessments.assessment_date', value: to },
      ],
      limit: max + 1,
    });
    checkData(error);
    const results = rows.slice(0, max).flatMap((r) => {
      const a = r.assessments as { title?: string; assessment_date?: string; max_mark?: number; active?: boolean; subjects?: { name?: string } | null } | null;
      if (!a || a.active === false || !a.max_mark || a.max_mark <= 0) return [];
      return [{
        title: String(a.title ?? '').slice(0, 200),
        subject: String(a.subjects?.name ?? 'Unknown subject').slice(0, 120),
        date: String(a.assessment_date),
        percent: Math.round((Number(r.mark) / Number(a.max_mark)) * 100),
      }];
    });
    const bySubject = new Map<string, number[]>();
    for (const r of results) bySubject.set(r.subject, [...(bySubject.get(r.subject) ?? []), r.percent]);
    const subjects = [...bySubject.entries()]
      .map(([subject, ps]) => ({ subject, results: ps.length, average_percent: Math.round(ps.reduce((s, p) => s + p, 0) / ps.length) }))
      .sort((a, b) => a.subject.localeCompare(b.subject))
      .slice(0, 40);
    const overall = subjects.length === 0 ? null : Math.round(subjects.reduce((s, x) => s + x.average_percent, 0) / subjects.length);
    const recent = [...results].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
    return {
      result: {
        learner_id: String(input.learner_id),
        period_from: from,
        period_to: to,
        data_available: results.length > 0,
        results: results.length,
        overall_average_percent: overall,
        subjects,
        recent,
        truncated: rows.length > max,
      },
      resultCount: results.length,
    };
  },
};

// Ledger arithmetic as in src/features/fees/utils/calculations.ts (in cents):
// outstanding = max(0, charged - adjustments - (paid - completed refunds)).
const feeSummary: ToolDefinition = {
  name: 'get_learner_fee_summary',
  description:
    'Fee account position for one learner in rand: charged, adjustments, paid, refunded, outstanding balance and status (paid, overdue, partially_paid, outstanding).',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['learner_id'],
    properties: { learner_id: LEARNER_ID },
  },
  outputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['learner_id', 'currency', 'data_available', 'total_charged', 'total_adjustments', 'total_paid', 'total_refunded', 'net_paid', 'outstanding_balance', 'status', 'overdue_charges', 'last_payment_date', 'truncated'],
    properties: {
      learner_id: { type: 'string', format: 'uuid' },
      currency: { type: 'string', enum: ['ZAR'] },
      data_available: { type: 'boolean' },
      total_charged: { type: 'number' },
      total_adjustments: { type: 'number' },
      total_paid: { type: 'number' },
      total_refunded: { type: 'number' },
      net_paid: { type: 'number' },
      outstanding_balance: { type: 'number' },
      status: { type: ['string', 'null'], enum: ['paid', 'overdue', 'partially_paid', 'outstanding', null] },
      overdue_charges: { type: 'integer' },
      last_payment_date: { type: ['string', 'null'], format: 'date' },
      truncated: { type: 'boolean' },
    },
  },
  allowedRoles: STAFF_FINANCE,
  requiredCapability: 'can_view_learner_financial',
  scope: 'learner',
  sensitive: true,
  async run(input, ctx) {
    const learner = String(input.learner_id);
    const max = 500;
    const base = (table: string, select: string, order: string) =>
      ctx.data.query({
        table,
        select,
        filters: [
          { op: 'eq', column: 'learner_id', value: learner },
          { op: 'eq', column: 'active', value: true },
        ],
        order: { column: order, ascending: false },
        limit: max + 1,
      });
    const [charges, payments, adjustments, refunds] = await Promise.all([
      base('learner_fee_charges', 'amount, due_date', 'created_at'),
      base('learner_fee_payments', 'amount, payment_date', 'payment_date'),
      base('learner_fee_adjustments', 'amount', 'created_at'),
      base('learner_fee_refunds', 'amount, status', 'refund_date'),
    ]);
    for (const r of [charges, payments, adjustments, refunds]) checkData(r.error);
    const truncated = [charges, payments, adjustments, refunds].some((r) => r.rows.length > max);
    const sum = (rows: Record<string, unknown>[]) => rows.slice(0, max).reduce((s, r) => s + toCents(r.amount), 0);

    const charged = sum(charges.rows);
    const adjusted = sum(adjustments.rows);
    const paid = sum(payments.rows);
    const refunded = sum(refunds.rows.filter((r) => r.status === 'completed'));
    const netPaid = paid - refunded;
    const outstanding = Math.max(0, charged - adjusted - netPaid);
    const overdue = outstanding > 0
      ? charges.rows.slice(0, max).filter((c) => typeof c.due_date === 'string' && c.due_date < ctx.today).length
      : 0;
    const hasData = charges.rows.length + payments.rows.length + adjustments.rows.length + refunds.rows.length > 0;
    const status = !hasData
      ? null
      : outstanding <= 0 && charged > 0
        ? 'paid'
        : overdue > 0
          ? 'overdue'
          : netPaid > 0
            ? 'partially_paid'
            : 'outstanding';
    return {
      result: {
        learner_id: learner,
        currency: 'ZAR',
        data_available: hasData,
        total_charged: rands(charged),
        total_adjustments: rands(adjusted),
        total_paid: rands(paid),
        total_refunded: rands(refunded),
        net_paid: rands(netPaid),
        outstanding_balance: rands(outstanding),
        status,
        overdue_charges: overdue,
        last_payment_date: (payments.rows[0]?.payment_date as string | undefined) ?? null,
        truncated,
      },
      resultCount: hasData ? 1 : 0,
    };
  },
};

// The government report RPC already scopes to reporting_school_ids(): a
// school owner or principal sees their own school, officials their areas
// (MFA required). Small groups are suppressed by the RPC.
const reportingSummary: ToolDefinition = {
  name: 'get_reporting_summary',
  description:
    'Aggregate attendance, performance and data-quality indicators for the schools in your reporting scope (your own school for school leaders), for the current academic year.',
  inputSchema: { type: 'object', additionalProperties: false, properties: {} },
  outputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['data_available', 'summary', 'schools', 'grades', 'subjects', 'schools_truncated'],
    properties: {
      data_available: { type: 'boolean' },
      summary: { type: 'object' },
      schools: { type: 'array', maxItems: 20, items: { type: 'object' } },
      grades: { type: 'array', maxItems: 20, items: { type: 'object' } },
      subjects: { type: 'array', maxItems: 40, items: { type: 'object' } },
      schools_truncated: { type: 'boolean' },
    },
  },
  allowedRoles: ['school_owner', 'principal'],
  requiredCapability: 'reporting_school_ids',
  scope: 'reporting',
  sensitive: false,
  async run(_input, ctx) {
    const { data, error } = await ctx.data.rpc('get_government_report', { p_filters: {} });
    checkData(error);
    const report = (data ?? {}) as Record<string, unknown>;
    const schools = Array.isArray(report.schools) ? (report.schools as Record<string, unknown>[]) : [];
    const pick = (o: Record<string, unknown>, keys: string[]) => Object.fromEntries(keys.filter((k) => k in o).map((k) => [k, o[k]]));
    return {
      result: {
        data_available: schools.length > 0,
        summary: (report.summary as Record<string, unknown>) ?? {},
        schools: schools.slice(0, 20).map((s) =>
          pick(s, ['name', 'academic_year', 'period_start', 'period_end', 'learners_enrolled', 'educators', 'attendance_rate', 'average_percent', 'pass_rate', 'learners_requiring_intervention', 'attention'])
        ),
        grades: Array.isArray(report.grades) ? (report.grades as unknown[]).slice(0, 20) : [],
        subjects: Array.isArray(report.subjects) ? (report.subjects as unknown[]).slice(0, 40) : [],
        schools_truncated: schools.length > 20,
      },
      resultCount: schools.length,
    };
  },
};

export const TOOLS: ToolDefinition[] = [findLearners, attendanceSummary, assessmentSummary, feeSummary, reportingSummary];

export class ToolRegistry {
  private readonly byName: Map<string, ToolDefinition>;

  constructor(tools: ToolDefinition[] = TOOLS) {
    this.byName = new Map(tools.map((t) => [t.name, t]));
  }

  /** Tools offered to the model: allowed by the feature policy and by the caller's role. */
  available(allowedByPolicy: string[], role: string): ToolDefinition[] {
    return allowedByPolicy
      .map((name) => this.byName.get(name))
      .filter((t): t is ToolDefinition => t !== undefined && t.allowedRoles.includes(role));
  }

  async execute(name: string, input: unknown, allowedByPolicy: string[], ctx: ToolContext): Promise<ToolExecution> {
    const started = Date.now();
    const done = (status: ToolStatus, payload: Record<string, unknown>, resultCount = 0, errorCode: string | null = null): ToolExecution => ({
      status,
      payload,
      resultCount,
      errorCode,
      durationMs: Date.now() - started,
    });

    const tool = this.byName.get(name);
    if (!tool || !allowedByPolicy.includes(name)) return done('denied', { error: 'tool_not_allowed' }, 0, 'tool_not_allowed');
    if (!tool.allowedRoles.includes(ctx.principal.role)) return done('denied', { error: 'role_not_allowed' }, 0, 'role_not_allowed');

    const inputErrors = validate(tool.inputSchema, input ?? {});
    if (inputErrors.length > 0) return done('invalid_input', { error: 'invalid_input', details: inputErrors.slice(0, 5) }, 0, 'invalid_input');

    let output: ToolOutput;
    try {
      output = await tool.run((input ?? {}) as Record<string, unknown>, ctx);
    } catch (error) {
      if (error instanceof ToolFailure) return done(error.status, { error: error.code }, 0, error.code);
      return done('error', { error: 'tool_failed' }, 0, 'tool_failed');
    }

    if (validate(tool.outputSchema, output.result).length > 0) {
      return done('invalid_output', { error: 'tool_output_invalid' }, 0, 'invalid_output');
    }
    return done(output.resultCount === 0 ? 'empty' : 'ok', output.result, output.resultCount);
  }
}

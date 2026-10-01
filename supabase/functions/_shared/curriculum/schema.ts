// Strict schema for AI-drafted lesson packs. This is the first gate: model output that does not match
// is rejected before anything touches the database. The same limits are enforced again in SQL
// (ai_payload_problems), so neither layer trusts the other.
//
// Nothing here repairs, trims or "fixes" output. It either passes unchanged or it is rejected with reasons.

export const SCHEMA_VERSION = '1';

export const STAGES = ['explain', 'show', 'try', 'practise', 'check', 'support', 'challenge', 'print'] as const;
export const KINDS = [
  'teacher_explanation', 'simplified_explanation', 'worked_example', 'diagram', 'illustration', 'animation', 'video',
  'classroom_activity', 'group_activity', 'practical_activity', 'exercise', 'differentiated_exercise', 'quick_assessment',
  'formative_questions', 'remediation', 'extension', 'worksheet', 'teacher_resource',
] as const;
export const DIFFICULTIES = ['foundational', 'standard', 'advanced'] as const;
const FORMATS = ['visual', 'text', 'interactive', 'practical', 'teacher_led', 'printable', 'video_audio'] as const;
const CONNECTIVITY = ['none', 'low', 'online'] as const;
const DEVICES = ['none', 'teacher_device', 'shared_device', 'learner_device'] as const;
const ACTIVITY_TYPES = [
  'individual_practice', 'pair_work', 'group_work', 'practical', 'game', 'discussion', 'worksheet', 'teacher_led',
] as const;
const GROUPINGS = ['individual', 'pair', 'small_group', 'whole_class'] as const;
const PURPOSES = ['diagnostic', 'formative', 'summative_check'] as const;
const QUESTION_TYPES = ['multiple_choice', 'true_false', 'numeric', 'short_answer'] as const;

export const MAX_PAYLOAD_BYTES = 200_000;

type Obj = Record<string, unknown>;

export type DraftValidation = { ok: true; value: Obj } | { ok: false; problems: string[] };

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown, min: number, max: number): v is string =>
  typeof v === 'string' && v.length >= min && v.length <= max;
const isInt = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const oneOf = <T extends readonly string[]>(v: unknown, list: T): v is T[number] =>
  typeof v === 'string' && (list as readonly string[]).includes(v);

function extraKeys(o: Obj, allowed: readonly string[]): string[] {
  return Object.keys(o).filter((k) => !allowed.includes(k));
}

/** Resource body: only whitelisted block types, mirrored from the database and the renderer. */
export function bodyProblems(body: unknown): string[] {
  if (!isObj(body)) return ['body must be an object'];
  const out: string[] = [];
  if (extraKeys(body, ['blocks', 'alt_text', 'transcript']).length) out.push('body has keys outside blocks, alt_text and transcript');
  if (body.alt_text !== undefined && !isStr(body.alt_text, 0, 500)) out.push('body.alt_text must be text of at most 500 characters');
  if (body.transcript !== undefined && !isStr(body.transcript, 0, 8000)) out.push('body.transcript must be text of at most 8000 characters');
  if (!Array.isArray(body.blocks)) return [...out, 'body.blocks must be an array'];
  if (body.blocks.length === 0) out.push('body.blocks is empty');
  if (body.blocks.length > 40) return [...out, 'body has more than 40 blocks'];
  body.blocks.forEach((b, i) => {
    const n = i + 1;
    if (!isObj(b)) return void out.push(`block ${n} is not an object`);
    const t = b.type;
    if (t === 'heading' || t === 'paragraph' || t === 'tip') {
      if (extraKeys(b, ['type', 'text']).length) out.push(`block ${n} has unsupported keys`);
      if (!isStr(b.text, 1, 4000) || b.text.trim() === '') out.push(`block ${n} needs text of 1 to 4000 characters`);
    } else if (t === 'steps' || t === 'numbered') {
      if (extraKeys(b, ['type', 'items']).length) out.push(`block ${n} has unsupported keys`);
      const items = b.items;
      if (!Array.isArray(items) || items.length < 1 || items.length > 30) out.push(`block ${n} needs 1 to 30 items`);
      else if (items.some((x) => !isStr(x, 1, 1000) || x.trim() === '')) out.push(`block ${n} has items that are empty, too long or not text`);
    } else if (t === 'table') {
      if (extraKeys(b, ['type', 'headers', 'rows']).length) out.push(`block ${n} has unsupported keys`);
      const { headers, rows } = b;
      if (!Array.isArray(headers) || headers.length < 1 || headers.length > 8) out.push(`block ${n} needs 1 to 8 headers`);
      else if (!Array.isArray(rows) || rows.length > 30) out.push(`block ${n} needs at most 30 rows`);
      else {
        if (headers.some((h) => !isStr(h, 0, 200))) out.push(`block ${n} has headers that are not short text`);
        if (rows.some((r) => !Array.isArray(r) || r.some((c) => !isStr(c, 0, 200)))) out.push(`block ${n} has rows that are not lists of short text`);
      }
    } else {
      out.push(`block ${n} has unsupported type`);
    }
  });
  return out;
}

export function draftProblems(payload: unknown, objectiveCodes: readonly string[]): string[] {
  if (!isObj(payload)) return ['payload must be an object'];
  const out: string[] = [];
  let size = 0;
  try {
    size = new TextEncoder().encode(JSON.stringify(payload)).length;
  } catch {
    return ['payload cannot be serialised'];
  }
  if (size > MAX_PAYLOAD_BYTES) return ['payload is larger than 200 KB'];
  if (extraKeys(payload, ['schema_version', 'lesson', 'resources', 'activities', 'assessment']).length) out.push('payload has unsupported top-level keys');
  if (payload.schema_version !== SCHEMA_VERSION) out.push(`schema_version must be "${SCHEMA_VERSION}"`);

  const lesson = payload.lesson;
  if (!isObj(lesson)) out.push('lesson is required');
  else {
    if (extraKeys(lesson, ['title', 'description', 'estimated_minutes', 'difficulty', 'teacher_notes', 'learner_instructions']).length) out.push('lesson has unsupported keys');
    if (!isStr(lesson.title, 3, 200)) out.push('lesson.title must be 3 to 200 characters');
    if (!isStr(lesson.description, 10, 2000)) out.push('lesson.description must be 10 to 2000 characters');
    if (!isStr(lesson.teacher_notes, 20, 4000)) out.push('lesson.teacher_notes must be 20 to 4000 characters');
    if (lesson.learner_instructions !== undefined && !isStr(lesson.learner_instructions, 0, 2000)) out.push('lesson.learner_instructions must be text of at most 2000 characters');
    if (lesson.difficulty !== undefined && !oneOf(lesson.difficulty, DIFFICULTIES)) out.push('lesson.difficulty is not recognised');
    if (lesson.estimated_minutes !== undefined && !isInt(lesson.estimated_minutes, 5, 180)) out.push('lesson.estimated_minutes must be a whole number from 5 to 180');
  }

  const keys: string[] = [];
  const resources = payload.resources;
  if (!Array.isArray(resources) || resources.length < 1 || resources.length > 20) out.push('resources must be a list of 1 to 20');
  else {
    resources.forEach((r, i) => {
      const n = i + 1;
      if (!isObj(r)) return void out.push(`resource ${n} is not an object`);
      if (extraKeys(r, ['key', 'stage', 'resource_kind', 'title', 'summary', 'difficulty', 'estimated_minutes', 'delivery_formats', 'connectivity', 'device', 'projector_required', 'printable', 'body']).length) out.push(`resource ${n} has unsupported keys`);
      if (typeof r.key !== 'string' || !/^[a-z0-9_]{1,40}$/.test(r.key)) out.push(`resource ${n} needs a key of lowercase letters, digits and underscores`);
      else if (keys.includes(r.key)) out.push(`resource key ${r.key} is repeated`);
      else keys.push(r.key);
      if (!oneOf(r.stage, STAGES)) out.push(`resource ${n} has an unknown stage`);
      if (!oneOf(r.resource_kind, KINDS)) out.push(`resource ${n} has an unknown kind`);
      if (!isStr(r.title, 3, 200)) out.push(`resource ${n} needs a title of 3 to 200 characters`);
      if (r.summary !== undefined && !isStr(r.summary, 0, 1000)) out.push(`resource ${n} summary is too long`);
      if (r.difficulty !== undefined && !oneOf(r.difficulty, DIFFICULTIES)) out.push(`resource ${n} has an unknown difficulty`);
      if (r.connectivity !== undefined && !oneOf(r.connectivity, CONNECTIVITY)) out.push(`resource ${n} has an unknown connectivity`);
      if (r.device !== undefined && !oneOf(r.device, DEVICES)) out.push(`resource ${n} has an unknown device`);
      if (r.projector_required !== undefined && typeof r.projector_required !== 'boolean') out.push(`resource ${n} projector_required must be true or false`);
      if (r.printable !== undefined && typeof r.printable !== 'boolean') out.push(`resource ${n} printable must be true or false`);
      if (r.estimated_minutes !== undefined && !isInt(r.estimated_minutes, 1, 180)) out.push(`resource ${n} estimated_minutes must be a whole number from 1 to 180`);
      if (r.delivery_formats !== undefined) {
        const f = r.delivery_formats;
        if (!Array.isArray(f) || f.length < 1 || f.length > 7 || f.some((x) => !oneOf(x, FORMATS))) out.push(`resource ${n} has unknown delivery formats`);
      }
      if (r.stage === 'print' && r.printable !== true) out.push(`resource ${n} is a print resource and must be printable`);
      out.push(...bodyProblems(r.body).map((p) => `resource ${n}: ${p}`));
    });
  }

  if (payload.activities !== undefined) {
    const acts = payload.activities;
    if (!Array.isArray(acts) || acts.length > 12) out.push('activities must be a list of at most 12');
    else {
      acts.forEach((a, i) => {
        const n = i + 1;
        if (!isObj(a)) return void out.push(`activity ${n} is not an object`);
        if (extraKeys(a, ['title', 'instructions', 'activity_type', 'grouping', 'difficulty', 'estimated_minutes', 'resource_key']).length) out.push(`activity ${n} has unsupported keys`);
        if (!isStr(a.title, 3, 200)) out.push(`activity ${n} needs a title`);
        if (!isStr(a.instructions, 10, 3000)) out.push(`activity ${n} needs instructions of 10 to 3000 characters`);
        if (!oneOf(a.activity_type, ACTIVITY_TYPES)) out.push(`activity ${n} has an unknown type`);
        if (a.grouping !== undefined && !oneOf(a.grouping, GROUPINGS)) out.push(`activity ${n} has an unknown grouping`);
        if (a.difficulty !== undefined && !oneOf(a.difficulty, DIFFICULTIES)) out.push(`activity ${n} has an unknown difficulty`);
        if (a.estimated_minutes !== undefined && !isInt(a.estimated_minutes, 1, 180)) out.push(`activity ${n} estimated_minutes must be a whole number from 1 to 180`);
        if (a.resource_key !== undefined && (typeof a.resource_key !== 'string' || !keys.includes(a.resource_key))) out.push(`activity ${n} points at a resource that does not exist`);
      });
    }
  }

  if (payload.assessment !== undefined && payload.assessment !== null) {
    const a = payload.assessment;
    if (!isObj(a)) out.push('assessment must be an object');
    else {
      if (extraKeys(a, ['title', 'purpose', 'difficulty', 'estimated_minutes', 'questions']).length) out.push('assessment has unsupported keys');
      if (!isStr(a.title, 3, 200)) out.push('assessment.title must be 3 to 200 characters');
      if (a.purpose !== undefined && !oneOf(a.purpose, PURPOSES)) out.push('assessment.purpose is not recognised');
      if (a.difficulty !== undefined && !oneOf(a.difficulty, DIFFICULTIES)) out.push('assessment.difficulty is not recognised');
      if (a.estimated_minutes !== undefined && !isInt(a.estimated_minutes, 1, 180)) out.push('assessment.estimated_minutes must be a whole number from 1 to 180');
      const qs = a.questions;
      if (!Array.isArray(qs) || qs.length < 3 || qs.length > 20) out.push('assessment.questions must be a list of 3 to 20');
      else qs.forEach((q, i) => questionProblems(q, i + 1, objectiveCodes, out));
    }
  }
  return out;
}

function questionProblems(q: unknown, n: number, codes: readonly string[], out: string[]): void {
  if (!isObj(q)) return void out.push(`question ${n} is not an object`);
  if (extraKeys(q, ['question_type', 'prompt', 'options', 'marks', 'objective_code', 'difficulty', 'answer', 'feedback', 'marking_notes']).length) out.push(`question ${n} has unsupported keys`);
  if (!oneOf(q.question_type, QUESTION_TYPES)) return void out.push(`question ${n} has an unknown type`);
  if (!isStr(q.prompt, 5, 1000)) out.push(`question ${n} needs a prompt of 5 to 1000 characters`);
  if (!isInt(q.marks, 1, 10)) out.push(`question ${n} marks must be a whole number from 1 to 10`);
  if (typeof q.objective_code !== 'string' || !codes.includes(q.objective_code)) out.push(`question ${n} must map to one of the requested objectives`);
  if (q.difficulty !== undefined && !oneOf(q.difficulty, DIFFICULTIES)) out.push(`question ${n} has an unknown difficulty`);
  if (q.feedback !== undefined && !isStr(q.feedback, 0, 1000)) out.push(`question ${n} feedback is too long`);
  if (q.marking_notes !== undefined && !isStr(q.marking_notes, 0, 1000)) out.push(`question ${n} marking_notes is too long`);
  const ans = q.answer;
  if (ans === undefined) return void out.push(`question ${n} needs an answer`);
  switch (q.question_type) {
    case 'multiple_choice': {
      const o = q.options;
      if (!Array.isArray(o) || o.length < 2 || o.length > 6 || o.some((x) => !isStr(x, 1, 200) || x.trim() === '') || new Set(o).size !== o.length) out.push(`question ${n} needs 2 to 6 distinct, short options`);
      else if (typeof ans !== 'string' || !o.includes(ans)) out.push(`question ${n} answer must be one of its options`);
      break;
    }
    case 'true_false':
      if (typeof ans !== 'boolean') out.push(`question ${n} answer must be true or false`);
      break;
    case 'numeric':
      if (typeof ans !== 'number' || !Number.isFinite(ans)) out.push(`question ${n} answer must be a number`);
      break;
    default:
      if (!(typeof ans === 'string' && ans.trim() !== '') && !(Array.isArray(ans) && ans.length >= 1 && ans.length <= 10 && ans.every((x) => typeof x === 'string' && x.trim() !== ''))) {
        out.push(`question ${n} answer must be text or a short list of text`);
      }
  }
}

export function validateDraft(payload: unknown, objectiveCodes: readonly string[]): DraftValidation {
  const problems = draftProblems(payload, objectiveCodes);
  return problems.length === 0 ? { ok: true, value: payload as Obj } : { ok: false, problems: problems.slice(0, 20) };
}

/**
 * Pulls the single JSON object out of a model reply. Accepts a bare object or one wrapped in a markdown code
 * fence; anything else (prose around it, several objects, arrays) is rejected rather than guessed at.
 */
export function extractJson(text: string): { ok: true; value: unknown } | { ok: false; problem: string } {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*\n([\s\S]*?)\n```$/.exec(trimmed);
  const candidate = fenced ? fenced[1] : trimmed;
  if (!candidate.startsWith('{') || !candidate.endsWith('}')) return { ok: false, problem: 'reply is not a single JSON object' };
  try {
    return { ok: true, value: JSON.parse(candidate) };
  } catch {
    return { ok: false, problem: 'reply is not valid JSON' };
  }
}

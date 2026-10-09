// Evidence verification: what the user is shown as "checked" must be a
// figure that exists, exactly, at a named field of a named tool output, and
// is used in the answer for what that field means.
//
//   * Each evidence item cites source_tool_call (the tool_call_id) and
//     source_field (a path into that tool's output, e.g.
//     "attendance_rate_percent" or "subjects[1].average_percent").
//     The value must equal the value at that field; a match anywhere else in
//     the output does not count.
//   * Numbers in the answer are of two kinds:
//       - FIGURES (quantities, money, percentages, ordinals; digits in any
//         script, or words): each must be a verified evidence value, AND the
//         sentence using it must fit the cited field. It must name the
//         field's metric ("attendance", "owes"). When the field is inside a
//         list, it must name that row ("Maths" for
//         subjects[0].average_percent). It must not name a different
//         learner, and must not place the figure in a period outside the
//         cited output's period. A figure that only repeats the user's own
//         question is shown but reported as unchecked and caps confidence.
//       - REFERENCES (dates, years, "Grade 10", "Term 2"): each must appear
//         in the retrieved data (a date or period in a tool output, a label
//         in a returned name) or in the user's question.
//     Anything else withholds the answer.
//   * The same checks apply to limitations, follow-up questions, declined
//     actions (items that fail are dropped) and evidence claims and periods
//     (an item that fails is rejected and its text is not shown).
//   * Confidence is capped by the evidence actually verified.
//
// This is NOT fact-checking. It checks that numbers trace to cited fields and
// are used with matching words. It cannot tell whether a sentence's wording,
// reasoning or non-numeric statements ("is struggling", "was absent all
// week" with no number) are true. Roman numerals, "twice", "most" and "a
// few" are not detected.

export interface EvidenceItem {
  claim: string;
  value: string;
  period: string;
  source_tool_call: string;
  source_field: string;
}

export type EvidenceVerdict =
  | 'verified'
  | 'unknown_tool_call'
  | 'invalid_field'
  | 'unknown_field'
  | 'value_mismatch'
  | 'unsupported_claim';

export interface CheckedEvidence extends EvidenceItem {
  verified: boolean;
  reason: EvidenceVerdict;
}

export type Confidence = 'low' | 'medium' | 'high';

/** Comparable form of a figure: "R 1 234,50" / "1234.5" / "85%" -> "1234.5" / "85". */
export function normaliseFigure(value: unknown): string | null {
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : null;
  if (typeof value !== 'string') return null;
  const stripped = asciiDigits(value.normalize('NFKC')).trim().replace(/^R\s*/i, '').replace(/%$/, '').replace(/[\s ]/g, '');
  const numeric = stripped.replace(/,(?=\d{3}(\D|$))/g, '').replace(/,/g, '.');
  if (/^-?\d+(\.\d+)?$/.test(numeric)) return String(Number(numeric));
  return value.trim().toLowerCase();
}

const FIELD_PATH = /^[A-Za-z_][A-Za-z0-9_]*(\[\d{1,3}\]|\.[A-Za-z_][A-Za-z0-9_]*)*$/;

/** The scalar at `path` in `output`, or undefined. Objects and arrays are not figures. */
export function resolveField(output: unknown, path: string): { valid: boolean; value: unknown } {
  if (path.length > 120 || !FIELD_PATH.test(path)) return { valid: false, value: undefined };
  let current: unknown = output;
  for (const part of path.match(/[A-Za-z_][A-Za-z0-9_]*|\[\d{1,3}\]/g) ?? []) {
    if (current === null || typeof current !== 'object') return { valid: true, value: undefined };
    if (part.startsWith('[')) {
      if (!Array.isArray(current)) return { valid: true, value: undefined };
      current = current[Number(part.slice(1, -1))];
    } else {
      if (Array.isArray(current) || !Object.prototype.hasOwnProperty.call(current, part)) return { valid: true, value: undefined };
      current = (current as Record<string, unknown>)[part];
    }
  }
  return { valid: true, value: current !== null && typeof current === 'object' ? undefined : current };
}

export function verifyEvidence(evidence: EvidenceItem[], toolOutputs: Map<string, unknown>): CheckedEvidence[] {
  return evidence.map((item) => {
    const output = toolOutputs.get(item.source_tool_call);
    if (output === undefined) return { ...item, verified: false, reason: 'unknown_tool_call' };
    const field = resolveField(output, item.source_field);
    if (!field.valid) return { ...item, verified: false, reason: 'invalid_field' };
    if (field.value === undefined || field.value === null) return { ...item, verified: false, reason: 'unknown_field' };
    const claimed = normaliseFigure(item.value);
    const actual = normaliseFigure(field.value);
    return claimed !== null && claimed === actual
      ? { ...item, verified: true, reason: 'verified' }
      : { ...item, verified: false, reason: 'value_mismatch' };
  });
}

// ---------------------------------------------------------------------------
// Number extraction

// Zero code points of the Unicode decimal-digit blocks most likely to appear
// (Arabic-Indic, Extended Arabic-Indic, Devanagari, Bengali, Thai, full-width…).
const DIGIT_ZEROS = [
  0x660, 0x6f0, 0x7c0, 0x966, 0x9e6, 0xa66, 0xae6, 0xb66, 0xbe6, 0xc66, 0xce6, 0xd66, 0xde6, 0xe50, 0xed0, 0xf20,
  0x1040, 0x1090, 0x17e0, 0x1810, 0x1946, 0x19d0, 0x1a80, 0x1a90, 0x1b50, 0x1bb0, 0x1c40, 0x1c50, 0xa8d0, 0xa900,
  0xa9d0, 0xaa50, 0xabf0, 0xff10,
];

/** Every Unicode decimal digit as its ASCII digit ("٨٥" -> "85"). */
export function asciiDigits(text: string): string {
  return text.replace(/\p{Nd}/gu, (ch) => {
    const cp = ch.codePointAt(0)!;
    if (cp < 0x80) return ch;
    for (const zero of DIGIT_ZEROS) if (cp >= zero && cp < zero + 10) return String(cp - zero);
    return ch;
  });
}

function clean(text: string): string {
  return asciiDigits(text.normalize('NFKC').replace(/\p{Cf}/gu, ''));
}

// Month names. "May" counts only with a capital M: "17 may fail" is a figure.
const MONTH_NAMES: [RegExp, number][] = [
  [/^jan(uary)?\.?$/i, 1], [/^feb(ruary)?\.?$/i, 2], [/^mar(ch)?\.?$/i, 3], [/^apr(il)?\.?$/i, 4], [/^May$/, 5],
  [/^june?\.?$/i, 6], [/^july?\.?$/i, 7], [/^aug(ust)?\.?$/i, 8], [/^sept?(ember)?\.?$/i, 9], [/^oct(ober)?\.?$/i, 10],
  [/^nov(ember)?\.?$/i, 11], [/^dec(ember)?\.?$/i, 12],
];
const MONTH =
  '(?:[Jj]an(?:uary)?|JAN(?:UARY)?|[Ff]eb(?:ruary)?|FEB(?:RUARY)?|[Mm]ar(?:ch)?|MAR(?:CH)?|[Aa]pr(?:il)?|APR(?:IL)?|May|MAY|[Jj]une?|JUNE?|[Jj]uly?|JULY?|[Aa]ug(?:ust)?|AUG(?:UST)?|[Ss]ept?(?:ember)?|SEPT?(?:EMBER)?|[Oo]ct(?:ober)?|OCT(?:OBER)?|[Nn]ov(?:ember)?|NOV(?:EMBER)?|[Dd]ec(?:ember)?|DEC(?:EMBER)?)\\b\\.?';
const DAY = '(?:[12]\\d|3[01]|0?[1-9])';
const YEAR = '(?:19|20)\\d{2}';

function monthNumber(name: string): number | null {
  for (const [re, n] of MONTH_NAMES) if (re.test(name)) return n;
  return null;
}

/** A date, period or label mentioned in text. Any part may be missing. */
export interface Reference {
  raw: string;
  year?: number;
  month?: number;
  day?: number;
  /** "grade:10", "term:2" */
  label?: string;
}

const REFERENCE_PATTERNS: { re: RegExp; parse: (m: RegExpMatchArray) => Omit<Reference, 'raw'> }[] = [
  { re: /\b(\d{4})-(\d{2})-(\d{2})\b/g, parse: (m) => ({ year: +m[1], month: +m[2], day: +m[3] }) },
  {
    re: new RegExp(`\\b(${DAY})(?:st|nd|rd|th)?\\s+(${MONTH})(?:\\s+(${YEAR})\\b)?`, 'g'),
    parse: (m) => ({ day: +m[1], month: monthNumber(m[2]) ?? undefined, year: m[3] ? +m[3] : undefined }),
  },
  {
    re: new RegExp(`\\b(${MONTH})\\s+(${DAY})(?:st|nd|rd|th)?\\b(?:,?\\s+(${YEAR})\\b)?`, 'g'),
    parse: (m) => ({ month: monthNumber(m[1]) ?? undefined, day: +m[2], year: m[3] ? +m[3] : undefined }),
  },
  { re: new RegExp(`\\b(${MONTH})\\s+(${YEAR})\\b`, 'g'), parse: (m) => ({ month: monthNumber(m[1]) ?? undefined, year: +m[2] }) },
  { re: new RegExp(`\\b(${YEAR})\\s*(?:-|–|to)\\s*(${YEAR})\\b`, 'g'), parse: (m) => ({ year: +m[1] }) },
  { re: new RegExp(`\\b(${YEAR})/(\\d{2,4})\\b`, 'g'), parse: (m) => ({ year: +m[1] }) },
  { re: new RegExp(`\\b(?:in|since|during|until|year)\\s+(${YEAR})\\b`, 'gi'), parse: (m) => ({ year: +m[1] }) },
  { re: new RegExp(`\\b(${YEAR})\\s+(?:academic|school)\\s+year\\b`, 'gi'), parse: (m) => ({ year: +m[1] }) },
  // Labels; a number followed by "%" or a decimal is a figure ("grade 45%").
  {
    re: /\b(grade|gr|term|week|quarter)\.?\s*(\d{1,2})(?:[a-z]\b)?(?![\d.,]*\s*%|[.,]\d)/gi,
    parse: (m) => ({ label: `${m[1].toLowerCase().replace(/^gr$/, 'grade')}:${+m[2]}` }),
  },
  {
    re: /\b(grade|term|week|quarter)\s+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/gi,
    parse: (m) => ({ label: `${m[1].toLowerCase()}:${SMALL[m[2].toLowerCase()]}` }),
  },
];

const SMALL: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11,
  twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
const UNIT_WORDS = 'one|two|three|four|five|six|seven|eight|nine';
// "one" on its own is too common in ordinary prose ("one of the learners") to treat as a figure.
const WORD_FIGURE = new RegExp(
  `\\b(?:(${Object.keys(TENS).join('|')})(?:[- ](${UNIT_WORDS}))?|(zero|${Object.keys(SMALL).filter((w) => w !== 'zero' && w !== 'one').join('|')}))` +
    `(?:\\s+(hundred|thousand))?(?:\\s+(?:percent|per\\s?cent))?\\b`,
  'gi',
);
// Quantity words with no digits.
const QUANTITY_WORDS: [RegExp, string][] = [
  [/\b(?:a|one)\s+hundred\b/gi, '100'],
  [/\b(?:a|one)\s+thousand\b/gi, '1000'],
  [/\b(?:a\s+)?dozens?\b/gi, '12'],
  [/\bhalf\b/gi, '50'],
];

const FIGURE = /(?:R\s?)?\d{1,3}(?:[  ,]\d{3})+(?:[.,]\d+)?%?|(?:R\s?)?\d+(?:[.,]\d+)?%?/gi;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface ExtractedNumbers {
  figures: { raw: string; value: string }[];
  references: Reference[];
}

/**
 * Figures and references in free text. `knownStrings` are text values from
 * the tool outputs (assessment titles, learner numbers): a number inside one
 * of them, quoted exactly, is part of a name, not a figure.
 */
export function extractNumbers(text: string, knownStrings: string[] = []): ExtractedNumbers {
  let cleaned = clean(text);
  for (const known of knownStrings) cleaned = cleaned.replace(new RegExp(escapeRegExp(clean(known)), 'gi'), ' ');
  const references: Reference[] = [];
  for (const { re, parse } of REFERENCE_PATTERNS) {
    cleaned = cleaned.replace(re, (...args) => {
      const m = args.slice(0, -2) as unknown as RegExpMatchArray;
      references.push({ raw: String(args[0]).trim(), ...parse(m) });
      return ' ';
    });
  }
  const figures: { raw: string; value: string }[] = [];
  for (const [re, value] of QUANTITY_WORDS) {
    cleaned = cleaned.replace(re, (raw) => {
      figures.push({ raw: raw.trim(), value });
      return ' ';
    });
  }
  for (const match of cleaned.match(FIGURE) ?? []) {
    const value = normaliseFigure(match);
    if (value !== null && /^-?\d/.test(value)) figures.push({ raw: match.trim(), value });
  }
  for (const m of cleaned.matchAll(WORD_FIGURE)) {
    const [raw, tens, unit, small, scale] = m;
    let n = tens ? TENS[tens.toLowerCase()] + (unit ? SMALL[unit.toLowerCase()] : 0) : SMALL[small!.toLowerCase()];
    if (scale) n *= scale.toLowerCase() === 'hundred' ? 100 : 1000;
    figures.push({ raw: raw.trim(), value: String(n) });
  }
  return { figures, references };
}

/** Figures only (dates, years and labels left out). */
export function extractFigures(text: string, knownStrings: string[] = []): { raw: string; value: string }[] {
  return extractNumbers(text, knownStrings).figures;
}

// ---------------------------------------------------------------------------
// What the retrieved data supports

/** Text values (with a digit, 3+ characters) found anywhere in tool outputs. */
export function knownStringsIn(outputs: Iterable<unknown>): string[] {
  const found = new Set<string>();
  const walk = (v: unknown) => {
    if (typeof v === 'string') {
      if (v.length >= 3 && v.length <= 120 && /\d/.test(v) && /\p{L}/u.test(v) && !/^\d{4}-\d{2}-\d{2}/.test(v)) found.add(v);
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  for (const o of outputs) walk(o);
  // Longest first, so "Grade 10A" is removed before "Grade 10".
  return [...found].sort((a, b) => b.length - a.length).slice(0, 200);
}

interface Period {
  from: string; // YYYY-MM-DD
  to: string;
}

/** Dates, periods and labels one tool output (or a set of them) supports. */
interface Support {
  dates: Set<string>;
  periods: Period[];
  labels: Set<string>;
}

const ISO = /^(\d{4})-(\d{2})-(\d{2})/;

function supportOf(outputs: Iterable<unknown>): Support {
  const support: Support = { dates: new Set(), periods: [], labels: new Set() };
  const walk = (v: unknown) => {
    if (typeof v === 'string') {
      const iso = v.match(ISO);
      if (iso) support.dates.add(iso[0]);
      for (const ref of extractNumbers(v).references) if (ref.label) support.labels.add(ref.label);
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      const from = typeof o.period_from === 'string' ? o.period_from.match(ISO)?.[0] : undefined;
      const to = typeof o.period_to === 'string' ? o.period_to.match(ISO)?.[0] : undefined;
      if (from && to) support.periods.push({ from, to });
      Object.values(o).forEach(walk);
    }
  };
  for (const o of outputs) walk(o);
  return support;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** True when the reference's date parts fall on a supported date or inside a supported period. */
function dateSupported(ref: Reference, support: Support): boolean {
  if (ref.year === undefined && ref.month === undefined && ref.day === undefined) return true;
  const fits = (from: string, to: string) => {
    // Compare at the precision the reference gives.
    if (ref.year !== undefined && ref.month !== undefined && ref.day !== undefined) {
      const d = `${ref.year}-${pad(ref.month)}-${pad(ref.day)}`;
      return d >= from && d <= to;
    }
    if (ref.year !== undefined && ref.month !== undefined) {
      const ym = `${ref.year}-${pad(ref.month)}`;
      return ym >= from.slice(0, 7) && ym <= to.slice(0, 7);
    }
    if (ref.year !== undefined) return String(ref.year) >= from.slice(0, 4) && String(ref.year) <= to.slice(0, 4);
    // Month (and day) without a year: any year in the range.
    for (let y = +from.slice(0, 4); y <= +to.slice(0, 4); y += 1) {
      const d = ref.day !== undefined ? `${y}-${pad(ref.month!)}-${pad(ref.day)}` : `${y}-${pad(ref.month!)}`;
      const lo = ref.day !== undefined ? from : from.slice(0, 7);
      const hi = ref.day !== undefined ? to : to.slice(0, 7);
      if (d >= lo && d <= hi) return true;
    }
    return false;
  };
  for (const d of support.dates) if (fits(d, d)) return true;
  return support.periods.some((p) => fits(p.from, p.to));
}

function refKey(ref: Reference): string {
  return ref.label ?? `${ref.year ?? '*'}-${ref.month ?? '*'}-${ref.day ?? '*'}`;
}

function referenceSupported(ref: Reference, support: Support, userRefs: Set<string>): boolean {
  if (userRefs.has(refKey(ref))) return true;
  if (ref.label) return support.labels.has(ref.label);
  return dateSupported(ref, support);
}

// ---------------------------------------------------------------------------
// Binding a figure to what its field means

// Field-name parts that say nothing about what is measured.
const GENERIC = new Set(['percent', 'pct', 'rate', 'count', 'total', 'number', 'value', 'amount', 'num', 'n', 'avg', 'id', 'net', 'sum']);
// Words a sentence may use for a field-name part. Matching is by prefix.
const SYNONYMS: Record<string, string[]> = {
  attendance: ['attend', 'present'],
  present: ['present', 'attend'],
  absent: ['absen', 'missed', 'away'],
  late: ['late'],
  excused: ['excus'],
  average: ['averag', 'mean'],
  overall: ['overall', 'averag'],
  balance: ['owe', 'owing', 'outstanding', 'balance', 'due', 'arrear', 'unpaid'],
  outstanding: ['owe', 'owing', 'outstanding', 'balance', 'due', 'arrear', 'unpaid'],
  paid: ['paid', 'pay'],
  charged: ['charg', 'fee', 'bill', 'invoic'],
  refunded: ['refund'],
  adjustments: ['adjust', 'discount', 'credit', 'bursar', 'waive'],
  overdue: ['overdue', 'late', 'past due', 'arrear'],
  charges: ['charg', 'fee'],
  records: ['record', 'day', 'register', 'lesson'],
  qualifying: ['day', 'school day', 'qualif'],
  days: ['day'],
  results: ['result', 'assessment', 'test', 'mark', 'task', 'exam'],
  learners: ['learner', 'pupil', 'student', 'child'],
  learner: ['learner', 'pupil', 'student', 'child'],
  enrolled: ['enrol', 'learner'],
  schools: ['school'],
};

function words(text: string): string {
  return ' ' + clean(text).toLowerCase().replace(/[^\p{L}\p{N}%]+/gu, ' ') + ' ';
}

function hasStem(sentence: string, stem: string): boolean {
  return sentence.includes(' ' + stem);
}

function fieldParts(path: string): { leaf: string[]; parent: string[]; indexPath: string | null } {
  const ids = path.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [];
  const split = (id: string | undefined) => (id ? id.split(/_|(?=[A-Z])/).map((w) => w.toLowerCase()).filter(Boolean) : []);
  const lastIndex = path.lastIndexOf('[');
  return {
    leaf: split(ids[ids.length - 1]),
    parent: split(ids[ids.length - 2]),
    indexPath: lastIndex >= 0 ? path.slice(0, path.indexOf(']', lastIndex) + 1) : null,
  };
}

/** The sentence names what the field measures (or the field name says nothing specific). */
function metricOk(sentence: string, path: string): boolean {
  const { leaf, parent } = fieldParts(path);
  let terms = leaf.filter((w) => !GENERIC.has(w));
  if (terms.length === 0) terms = parent.filter((w) => !GENERIC.has(w) && !/^\d/.test(w));
  if (terms.length === 0) return true;
  return terms.some((t) => (SYNONYMS[t] ?? [t.length > 5 ? t.slice(0, 5) : t]).some((stem) => hasStem(sentence, stem)));
}

const NOT_ENTITY = /^(\d{4}-\d{2}-\d{2}.*|[0-9a-f]{8}-[0-9a-f-]{27,}|true|false|null|ok|zar|active|inactive)$/i;

/** When the field sits inside a list, the sentence names that row (its subject, title, name). */
function entityOk(sentence: string, path: string, output: unknown): boolean {
  const { indexPath } = fieldParts(path);
  if (!indexPath) return true;
  const row = resolveRow(output, indexPath);
  if (!row || typeof row !== 'object') return true;
  const names = Object.entries(row as Record<string, unknown>)
    .filter(([k, v]) => typeof v === 'string' && !/(_id|^id|date|status)$/.test(k) && !NOT_ENTITY.test(v as string))
    .flatMap(([, v]) => words(v as string).trim().split(' '))
    .filter((w) => w.length >= 3 && !/^\d+$/.test(w));
  if (names.length === 0) return true;
  return names.some((w) => sentence.includes(' ' + w + ' ') || sentence.includes(' ' + w.slice(0, 5)));
}

function resolveRow(output: unknown, path: string): unknown {
  let current: unknown = output;
  for (const part of path.match(/[A-Za-z_][A-Za-z0-9_]*|\[\d{1,3}\]/g) ?? []) {
    if (current === null || typeof current !== 'object') return undefined;
    current = part.startsWith('[') ? (current as unknown[])[Number(part.slice(1, -1))] : (current as Record<string, unknown>)[part];
  }
  return current;
}

/** Learner names returned by find_learners, by learner id. */
function learnerNames(outputs: Iterable<unknown>): Map<string, string[]> {
  const names = new Map<string, string[]>();
  for (const o of outputs) {
    const list = (o as { learners?: unknown })?.learners;
    if (!Array.isArray(list)) continue;
    for (const l of list as Record<string, unknown>[]) {
      if (typeof l?.learner_id === 'string' && typeof l?.name === 'string') {
        names.set(l.learner_id, words(l.name).trim().split(' ').filter((w) => w.length >= 2));
      }
    }
  }
  return names;
}

/** The sentence does not attribute a learner-specific figure to a different named learner. */
function learnerOk(sentence: string, output: unknown, names: Map<string, string[]>): boolean {
  const id = (output as { learner_id?: unknown })?.learner_id;
  if (typeof id !== 'string' || names.size === 0) return true;
  const own = new Set(names.get(id) ?? []);
  const mentionsOwn = [...own].some((w) => sentence.includes(' ' + w + ' '));
  const mentionsOther = [...names.entries()]
    .filter(([other]) => other !== id)
    .some(([, ws]) => ws.some((w) => !own.has(w) && sentence.includes(' ' + w + ' ')));
  return mentionsOwn || !mentionsOther;
}

// ---------------------------------------------------------------------------
// Checking a whole answer

export interface CheckContext {
  evidence: CheckedEvidence[];
  outputs: Map<string, unknown>;
  userText: string;
  knownStrings: string[];
}

export interface FigureCheck {
  /** Numbers that are neither verified evidence (used for what they mean) nor the user's own: they cannot be shown. */
  unsupported: string[];
  /** Numbers that only repeat the user's question: shown, but reported as unchecked. */
  userOnly: string[];
}

function verifiedValues(evidence: CheckedEvidence[]): Set<string> {
  const values = new Set<string>();
  for (const item of evidence) {
    if (!item.verified) continue;
    const v = normaliseFigure(item.value);
    if (v !== null) values.add(v);
  }
  return values;
}

function sentencesOf(text: string): string[] {
  return clean(text)
    .split(/(?<!\b(?:Gr|gr|No|no|Mr|Mrs|Ms|Dr|vs|e\.g|i\.e)\.)(?<=[.!?;])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Classifies every figure and reference in `text`. Without `context.outputs`
 * only the figure values are checked (no binding, no references).
 */
export function checkText(text: string, context: CheckContext, options: { allowUserFigures?: boolean } = {}): FigureCheck {
  const allowUser = options.allowUserFigures ?? true;
  const verified = verifiedValues(context.evidence);
  const user = extractNumbers(context.userText);
  const fromUser = new Set(user.figures.map((f) => f.value));
  const userRefs = new Set(user.references.map(refKey));
  const outputs = context.outputs;
  const bindable = outputs.size > 0;
  const allSupport = supportOf(outputs.values());
  const names = learnerNames(outputs.values());
  const unsupported = new Set<string>();
  const userOnly = new Set<string>();

  for (const sentence of sentencesOf(text)) {
    const found = extractNumbers(sentence, context.knownStrings);
    const sWords = words(sentence);
    const bound: CheckedEvidence[] = [];
    for (const f of found.figures) {
      if (verified.has(f.value)) {
        if (!bindable) continue;
        const candidates = context.evidence.filter((e) => e.verified && normaliseFigure(e.value) === f.value);
        const fits = candidates.filter((e) => {
          const out = outputs.get(e.source_tool_call);
          return metricOk(sWords, e.source_field) && entityOk(sWords, e.source_field, out) && learnerOk(sWords, out, names);
        });
        if (fits.length > 0) {
          bound.push(...fits);
          continue;
        }
        unsupported.add(`${f.raw} (not what the cited field measures)`);
        continue;
      }
      if (allowUser && fromUser.has(f.value)) userOnly.add(f.raw);
      else unsupported.add(f.raw);
    }
    if (!bindable) continue;
    for (const ref of found.references) {
      if (!referenceSupported(ref, allSupport, userRefs)) {
        unsupported.add(`${ref.raw} (not in the retrieved data)`);
        continue;
      }
      // A date or period next to a figure must fit the period of the output that figure came from.
      if (bound.length > 0 && !ref.label && !userRefs.has(refKey(ref))) {
        const ok = bound.some((e) => dateSupported(ref, supportOf([outputs.get(e.source_tool_call)])));
        if (!ok) unsupported.add(`${ref.raw} (outside the cited data's period)`);
      }
    }
  }
  if (bindable) for (const name of unknownPeople(text, outputs, context.userText)) unsupported.add(`${name} (not in the retrieved data)`);
  return { unsupported: [...unsupported].slice(0, 10), userOnly: [...userOnly].slice(0, 10) };
}

// Capitalised words that are not people.
const NOT_PEOPLE = new Set(
  ('maths mathematics english afrikaans isizulu isixhosa sesotho setswana sepedi science history geography accounting ' +
    'economics physics chemistry biology funda funda360 grade term week school monday tuesday wednesday thursday friday ' +
    'saturday sunday january february march april may june july august september october november december the this ' +
    'attendance overall average his her their learner learners').split(' '),
);

/**
 * A capitalised word used as the subject of a statement about a person
 * ("... and Sipho was absent") that appears nowhere in the retrieved data or
 * the question: the answer is talking about someone Funda AI did not look up.
 */
function unknownPeople(text: string, outputs: Map<string, unknown>, userText: string): string[] {
  const known = new Set<string>();
  const add = (v: string) => words(v).trim().split(' ').forEach((w) => known.add(w));
  const walk = (v: unknown) => {
    if (typeof v === 'string') add(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  for (const o of outputs.values()) walk(o);
  add(userText);
  const found = new Set<string>();
  const re = /(?<=\S\s+)([A-Z][a-z]{2,})(?=\s+(?:was|is|has|had|did|missed|scored|failed|owes|attended|got|received|paid)\b)/g;
  for (const m of clean(text).matchAll(re)) {
    const w = m[1].toLowerCase();
    if (!known.has(w) && !NOT_PEOPLE.has(w)) found.add(m[1]);
  }
  return [...found];
}

/** Back-compatible figure check (values only, no binding): see checkText. */
export function checkFigures(text: string, userText: string, evidence: CheckedEvidence[], knownStrings: string[] = []): FigureCheck {
  return checkText(text, { evidence, outputs: new Map(), userText, knownStrings });
}

/** Figures in the answer that are neither verified evidence nor taken from the user's own words. */
export function unsupportedFigures(answer: string, userText: string, evidence: CheckedEvidence[]): string[] {
  return checkFigures(answer, userText, evidence).unsupported;
}

/** "last 90 days", "3 weeks": allowed in an evidence period. */
const DURATION = /\b\d{1,3}\s+(?:school\s+)?(?:days?|weeks?|months?|years?)\b/gi;

/**
 * Rejects evidence whose claim does not describe its own field (claim
 * "failed subjects" for the field "absent"), whose claim carries a number
 * that is not itself verified evidence (numbers from the user's question do
 * not count here), or whose period is not supported by the cited output.
 */
export function checkClaims(
  evidence: CheckedEvidence[],
  userText: string,
  knownStrings: string[] = [],
  outputs: Map<string, unknown> = new Map(),
): CheckedEvidence[] {
  return evidence.map((item) => {
    if (!item.verified) return item;
    const own = outputs.get(item.source_tool_call);
    const context: CheckContext = { evidence, outputs, userText, knownStrings };
    const claimWords = words(item.claim + ' ' + item.value);
    const describesField = outputs.size === 0 || (metricOk(claimWords, item.source_field) && entityOk(claimWords, item.source_field, own));
    const claimBad = checkText(item.claim, context, { allowUserFigures: false }).unsupported.length > 0;
    // A period can only be checked against an output that carries dates; an
    // output without any (a current fee balance) cannot contradict it.
    const ownSupport = supportOf([own]);
    const datesKnown = ownSupport.dates.size > 0 || ownSupport.periods.length > 0;
    const periodContext: CheckContext = {
      evidence: [item],
      outputs: own === undefined || !datesKnown ? new Map() : new Map([[item.source_tool_call, own]]),
      userText,
      knownStrings,
    };
    const periodBad = checkText(item.period.replace(DURATION, ' '), periodContext, { allowUserFigures: false }).unsupported.length > 0;
    return claimBad || periodBad || !describesField ? { ...item, verified: false, reason: 'unsupported_claim' as const } : item;
  });
}

/**
 * The confidence shown to the user. "high" needs at least one verified
 * figure and nothing rejected, unsupported, unchecked or dropped; any
 * rejected or unsupported figure means "low"; when lookups returned data but
 * nothing was verified, "low"; with no data looked up at all, at most
 * "medium". Non-numeric statements cannot lower it (see the header).
 */
export function decideConfidence(input: {
  model: Confidence;
  evidence: CheckedEvidence[];
  toolsReturnedData: boolean;
  unsupported: number;
  /** Figures that only repeat the user's question (answer or notes). */
  userOnly?: number;
  /** Notes removed because they failed the checks. */
  droppedNotes?: number;
  /** The answer text, to spot predictions and judgements the checks cannot verify. */
  answer?: string;
}): Confidence {
  const verified = input.evidence.filter((e) => e.verified).length;
  if (input.unsupported > 0 || (input.userOnly ?? 0) > 0 || input.evidence.some((e) => !e.verified)) return 'low';
  if (verified === 0) return input.toolsReturnedData ? 'low' : input.model === 'high' ? 'medium' : input.model;
  const speculative = PREDICTIVE.test(input.answer ?? '');
  if (((input.droppedNotes ?? 0) > 0 || speculative) && input.model === 'high') return 'medium';
  return input.model;
}

// Predictions and judgements: the figures may be checked, the conclusion is not.
const PREDICTIVE = /\b(will (likely |probably )?(fail|pass|drop|improve)|likely to|at (serious |high )?risk|is failing|is struggling|serious(ly)?|predict\w*|expect(ed)? to)\b/i;

/** Text shown in place of a rejected evidence item's claim and value. */
export const REJECTED_CLAIM = 'Not shown: this figure could not be checked against the data it cited.';

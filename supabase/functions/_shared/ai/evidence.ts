// Evidence verification: what the user is shown as "checked" must be a
// figure that exists, exactly, at a named field of a named tool output.
//
//   * Each evidence item cites source_tool_call (the tool_call_id) and
//     source_field (a path into that tool's output, e.g.
//     "attendance_rate_percent" or "subjects[1].average_percent").
//     The value must equal the value at that field; a match anywhere else in
//     the output does not count.
//   * Every number in the answer text, digits or words ("twenty-five"), must
//     be one of the verified figures, unless it is part of a date, a year, a
//     label ("Grade 10", "Term three") or an ordinal. A number that only
//     repeats the user's own question is shown but reported as unchecked and
//     caps confidence at "low". Any other number withholds the answer.
//   * The same check applies to limitations, follow-up questions, declined
//     actions (items with unchecked numbers are dropped) and evidence claims
//     (a claim with an unchecked number is rejected).
//   * Confidence is capped by the evidence actually verified.
//
// This checks numbers, not wording: a sentence can still misdescribe a
// verified figure, and "one", fractions ("half") and vague quantities
// ("most", "a few") are not detected.

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
  const stripped = value.trim().replace(/^R\s*/i, '').replace(/%$/, '').replace(/[\s ]/g, '');
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

// Whole month names or their standard abbreviations only ("mark", "decline"
// and "may" as a verb before a non-day number are NOT months).
const MONTH =
  '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\b\\.?';
const DAY = '(?:[12]\\d|3[01]|0?[1-9])';
const YEAR = '(?:19|20)\\d{2}';
const NOT_FIGURES: RegExp[] = [
  /\b\d{4}-\d{2}-\d{2}\b/g, // ISO dates
  new RegExp(`\\b${DAY}(?:st|nd|rd|th)?\\s+${MONTH}(?:\\s+${YEAR}\\b)?`, 'gi'), // 2 February 2026
  // February 2, 2026 (the day must not run into a year: "February 2026" is month + year)
  new RegExp(`\\b${MONTH}\\s+${DAY}(?:st|nd|rd|th)?\\b(?:,?\\s+${YEAR}\\b)?`, 'gi'),
  new RegExp(`\\b${MONTH}\\s+${YEAR}\\b`, 'gi'), // February 2026
  // A year only in a date-like context; a bare 2050 may be rand or a count.
  // ("for 1987 learners" and "R 500 of 2000" are figures, so only unambiguous words count.)
  new RegExp(`\\b(?:in|since|during|until|year)\\s+${YEAR}\\b`, 'gi'),
  new RegExp(`\\b${YEAR}\\s*(?:-|–|to)\\s*${YEAR}\\b`, 'gi'), // 2025-2026, 2025 to 2026
  new RegExp(`\\b${YEAR}\\s+(?:academic|school)\\s+year\\b`, 'gi'),
  new RegExp(`\\b${YEAR}/\\d{2,4}\\b`, 'g'), // 2026/27
  /\b(?:grade|gr|term|week|quarter)\.?\s*\d{1,2}[a-z]?\b/gi, // labels
  /\b(?:grade|term|week|quarter)\s+(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/gi, // word labels
  /\b\d{1,3}(?:st|nd|rd|th)\b/gi, // ordinals
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

const FIGURE = /(?:R\s?)?\d{1,3}(?:[  ,]\d{3})+(?:[.,]\d+)?%?|(?:R\s?)?\d+(?:[.,]\d+)?%?/gi;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Normalised numeric figures in free text, ignoring dates, date-context
 * years, labels and ordinals. `knownStrings` are text values from the tool
 * outputs (assessment titles, learner numbers, grade names): a number inside
 * one of them, quoted exactly, is a name, not a figure.
 */
export function extractFigures(text: string, knownStrings: string[] = []): { raw: string; value: string }[] {
  let cleaned = text.normalize('NFKC').replace(/\p{Cf}/gu, '');
  for (const known of knownStrings) cleaned = cleaned.replace(new RegExp(escapeRegExp(known), 'gi'), ' ');
  for (const pattern of NOT_FIGURES) cleaned = cleaned.replace(pattern, ' ');
  const found: { raw: string; value: string }[] = [];
  for (const match of cleaned.match(FIGURE) ?? []) {
    const value = normaliseFigure(match);
    if (value !== null && /^-?\d/.test(value)) found.push({ raw: match.trim(), value });
  }
  for (const m of cleaned.matchAll(WORD_FIGURE)) {
    const [raw, tens, unit, small, scale] = m;
    let n = tens ? TENS[tens.toLowerCase()] + (unit ? SMALL[unit.toLowerCase()] : 0) : SMALL[small!.toLowerCase()];
    if (scale) n *= scale.toLowerCase() === 'hundred' ? 100 : 1000;
    found.push({ raw: raw.trim(), value: String(n) });
  }
  return found;
}

export interface FigureCheck {
  /** Numbers that are neither verified evidence nor the user's own: they cannot be shown. */
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

/** Classifies every figure in `text` against verified evidence and the user's own words. */
export function checkFigures(text: string, userText: string, evidence: CheckedEvidence[], knownStrings: string[] = []): FigureCheck {
  const verified = verifiedValues(evidence);
  const fromUser = new Set(extractFigures(userText).map((f) => f.value));
  const unsupported = new Set<string>();
  const userOnly = new Set<string>();
  for (const f of extractFigures(text, knownStrings)) {
    if (verified.has(f.value)) continue;
    if (fromUser.has(f.value)) userOnly.add(f.raw);
    else unsupported.add(f.raw);
  }
  return { unsupported: [...unsupported].slice(0, 10), userOnly: [...userOnly].slice(0, 10) };
}

/** Figures in the answer that are neither verified evidence nor taken from the user's own words. */
export function unsupportedFigures(answer: string, userText: string, evidence: CheckedEvidence[]): string[] {
  return checkFigures(answer, userText, evidence).unsupported;
}

/**
 * Rejects evidence whose claim text carries a number that is not itself
 * verified (e.g. claim "attendance rose from 70%" next to a verified 80%).
 */
export function checkClaims(evidence: CheckedEvidence[], userText: string, knownStrings: string[] = []): CheckedEvidence[] {
  return evidence.map((item) => {
    if (!item.verified) return item;
    const own = [item];
    // The claim may use any verified figure; the period may only describe time.
    const claimBad = checkFigures(item.claim, userText, evidence, knownStrings).unsupported.length > 0;
    const periodBad = checkFigures(item.period.replace(DURATION, ' '), '', own, knownStrings).unsupported.length > 0;
    return claimBad || periodBad ? { ...item, verified: false, reason: 'unsupported_claim' as const } : item;
  });
}

/** "last 90 days", "3 weeks": allowed in an evidence period. */
const DURATION = /\b\d{1,3}\s+(?:school\s+)?(?:days?|weeks?|months?|years?)\b/gi;

/**
 * The confidence shown to the user. "high" needs at least one verified
 * figure and nothing rejected; any rejected or unsupported figure means
 * "low"; when lookups returned data but nothing was verified, "low"; with no
 * data looked up at all, at most "medium".
 */
export function decideConfidence(input: {
  model: Confidence;
  evidence: CheckedEvidence[];
  toolsReturnedData: boolean;
  unsupported: number;
  /** Figures that only repeat the user's question. */
  userOnly?: number;
}): Confidence {
  const verified = input.evidence.filter((e) => e.verified).length;
  if (input.unsupported > 0 || (input.userOnly ?? 0) > 0 || input.evidence.some((e) => !e.verified)) return 'low';
  if (verified === 0) return input.toolsReturnedData ? 'low' : input.model === 'high' ? 'medium' : input.model;
  return input.model;
}

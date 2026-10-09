// Evidence verification: what the user is shown as "checked" must be a
// figure that exists, exactly, at a named field of a named tool output.
//
//   * Each evidence item cites source_tool_call (the tool_call_id) and
//     source_field (a path into that tool's output, e.g.
//     "attendance_rate_percent" or "subjects[1].average_percent").
//     The value must equal the value at that field; a match anywhere else in
//     the output does not count.
//   * Every number in the answer text must be one of the verified figures,
//     unless it is part of a date, a year, a label ("Grade 10", "Term 3") or
//     was written by the user. Otherwise the answer is withheld.
//   * Confidence is capped by the evidence actually verified.
//
// This checks numbers, not wording: a sentence can still misdescribe a
// verified figure, and numbers written as words are not detected.

export interface EvidenceItem {
  claim: string;
  value: string;
  period: string;
  source_tool_call: string;
  source_field: string;
}

export type EvidenceVerdict = 'verified' | 'unknown_tool_call' | 'invalid_field' | 'unknown_field' | 'value_mismatch';

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

const MONTH = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?';
const NOT_FIGURES: RegExp[] = [
  /\b\d{4}-\d{2}-\d{2}\b/g, // ISO dates
  new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+${MONTH}(?:\\s+\\d{4})?`, 'gi'), // 2 February 2026
  new RegExp(`\\b${MONTH}\\s+\\d{1,2}(?:st|nd|rd|th)?(?:,?\\s+\\d{4})?`, 'gi'), // February 2, 2026
  /\b(?:19|20)\d{2}\b/g, // years
  /\b(?:grade|gr|term|test|week|quarter|class|question|page|room|step|day)\.?\s*\d{1,3}[a-z]?\b/gi, // labels
  /\b\d{1,3}(?:st|nd|rd|th)\b/gi, // ordinals
];

const FIGURE = /(?:R\s?)?\d{1,3}(?:[  ,]\d{3})+(?:[.,]\d+)?%?|(?:R\s?)?\d+(?:[.,]\d+)?%?/gi;

/** Normalised numeric figures in free text, ignoring dates, years, labels and ordinals. */
export function extractFigures(text: string): { raw: string; value: string }[] {
  let cleaned = text;
  for (const pattern of NOT_FIGURES) cleaned = cleaned.replace(pattern, ' ');
  const found: { raw: string; value: string }[] = [];
  for (const match of cleaned.match(FIGURE) ?? []) {
    const value = normaliseFigure(match);
    if (value !== null && /^-?\d/.test(value)) found.push({ raw: match.trim(), value });
  }
  return found;
}

/** Figures in the answer that are neither verified evidence nor taken from the user's own words. */
export function unsupportedFigures(answer: string, userText: string, evidence: CheckedEvidence[]): string[] {
  const allowed = new Set<string>();
  for (const item of evidence) {
    if (item.verified) {
      const v = normaliseFigure(item.value);
      if (v !== null) allowed.add(v);
    }
  }
  for (const f of extractFigures(userText)) allowed.add(f.value);
  const missing = new Set<string>();
  for (const f of extractFigures(answer)) if (!allowed.has(f.value)) missing.add(f.raw);
  return [...missing].slice(0, 10);
}

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
}): Confidence {
  const verified = input.evidence.filter((e) => e.verified).length;
  if (input.unsupported > 0 || input.evidence.some((e) => !e.verified)) return 'low';
  if (verified === 0) return input.toolsReturnedData ? 'low' : input.model === 'high' ? 'medium' : input.model;
  return input.model;
}

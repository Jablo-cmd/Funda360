// A small JSON-Schema subset, enough to validate tool inputs, tool outputs
// and model outputs without adding a dependency. Every value that crosses a
// trust boundary (model -> tool input, tool -> model, model -> browser) is
// validated with this before it is used.

export type SchemaType = 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean' | 'null';

export interface JsonSchema {
  type: SchemaType | SchemaType[];
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean;
  items?: JsonSchema;
  enum?: (string | number | boolean | null)[];
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: 'uuid' | 'date';
  minimum?: number;
  maximum?: number;
  maxItems?: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function typeOf(value: unknown): SchemaType {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  return typeof value as SchemaType;
}

function typeMatches(expected: SchemaType, actual: SchemaType): boolean {
  return expected === actual || (expected === 'number' && actual === 'integer');
}

/** Returns a list of problems; an empty list means the value is valid. */
export function validate(schema: JsonSchema, value: unknown, path = '$', errors: string[] = []): string[] {
  if (errors.length >= 20) return errors;
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  const actual = typeOf(value);
  if (!types.some((t) => typeMatches(t, actual))) {
    errors.push(`${path}: expected ${types.join('|')}, got ${actual}`);
    return errors;
  }
  if (schema.enum && !schema.enum.includes(value as never)) {
    errors.push(`${path}: not an allowed value`);
  }
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${path}: too short`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength) errors.push(`${path}: too long`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${path}: invalid format`);
    if (schema.format === 'uuid' && !UUID.test(value)) errors.push(`${path}: must be a UUID`);
    if (schema.format === 'date' && (!DATE.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`)))) {
      errors.push(`${path}: must be a date (YYYY-MM-DD)`);
    }
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) errors.push(`${path}: must be finite`);
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${path}: below minimum`);
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${path}: above maximum`);
  }
  if (Array.isArray(value)) {
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${path}: too many items`);
    if (schema.items) value.forEach((item, i) => validate(schema.items!, item, `${path}[${i}]`, errors));
  }
  if (actual === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of schema.required ?? []) {
      if (!(key in record)) errors.push(`${path}.${key}: required`);
    }
    for (const [key, item] of Object.entries(record)) {
      const child = schema.properties?.[key];
      if (child) validate(child, item, `${path}.${key}`, errors);
      else if (schema.additionalProperties === false) errors.push(`${path}.${key}: not allowed`);
    }
  }
  return errors;
}

/**
 * The schema as sent to a model provider: structural keywords only. Length,
 * range and pattern limits stay local (enforced by validate()), because
 * providers accept different keyword subsets.
 */
export function providerSchema(schema: JsonSchema): Record<string, unknown> {
  const out: Record<string, unknown> = { type: schema.type };
  if (schema.description) out.description = schema.description;
  if (schema.enum) out.enum = schema.enum;
  if (schema.properties) {
    out.properties = Object.fromEntries(Object.entries(schema.properties).map(([k, v]) => [k, providerSchema(v)]));
  }
  if (schema.required) out.required = schema.required;
  if (schema.additionalProperties !== undefined) out.additionalProperties = schema.additionalProperties;
  if (schema.items) out.items = providerSchema(schema.items);
  return out;
}

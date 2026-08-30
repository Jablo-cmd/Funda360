import { z } from 'zod';

/**
 * Curated, not exhaustive — matches this schema's own established pattern
 * for open-ended-but-bounded fields (a `<select>` of sensible options
 * rather than free text a typo could silently break, but not a full
 * IANA/ISO-4217 enumeration either). Weighted toward Southern Africa,
 * matching this platform's own SA focus (ZAR/en defaults, SA ID number
 * validation elsewhere), with common international options alongside for
 * schools with international ties.
 */
export const TIMEZONE_OPTIONS = [
  { value: 'Africa/Johannesburg', label: 'Johannesburg (SAST, UTC+2)' },
  { value: 'Africa/Windhoek', label: 'Windhoek (CAT, UTC+2)' },
  { value: 'Africa/Gaborone', label: 'Gaborone (CAT, UTC+2)' },
  { value: 'Africa/Harare', label: 'Harare (CAT, UTC+2)' },
  { value: 'Africa/Lagos', label: 'Lagos (WAT, UTC+1)' },
  { value: 'Africa/Nairobi', label: 'Nairobi (EAT, UTC+3)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'UTC', label: 'UTC' },
] as const;

export const CURRENCY_OPTIONS = [
  { value: 'ZAR', label: 'South African Rand (ZAR)' },
  { value: 'NAD', label: 'Namibian Dollar (NAD)' },
  { value: 'BWP', label: 'Botswana Pula (BWP)' },
  { value: 'USD', label: 'US Dollar (USD)' },
  { value: 'GBP', label: 'British Pound (GBP)' },
  { value: 'EUR', label: 'Euro (EUR)' },
] as const;

/** SA's 11 official languages, plus a couple of common regional additions. */
export const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'af', label: 'Afrikaans' },
  { value: 'zu', label: 'isiZulu' },
  { value: 'xh', label: 'isiXhosa' },
  { value: 'st', label: 'Sesotho' },
  { value: 'tn', label: 'Setswana' },
  { value: 'ts', label: 'Xitsonga' },
  { value: 've', label: 'Tshivenda' },
  { value: 'ss', label: 'siSwati' },
  { value: 'nr', label: 'isiNdebele' },
  { value: 'nso', label: 'Sepedi' },
  { value: 'pt', label: 'Portuguese' },
] as const;

export const schoolSettingsSchema = z.object({
  timezone: z.string().trim().min(1, 'Select a timezone'),
  currency: z.string().trim().min(1, 'Select a currency'),
  language: z.string().trim().min(1, 'Select a language'),
});

export type SchoolSettingsFormValues = z.infer<typeof schoolSettingsSchema>;

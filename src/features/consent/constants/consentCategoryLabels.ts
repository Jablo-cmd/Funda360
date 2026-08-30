import type { ConsentCategory } from '@/lib/database.types';

/**
 * The three categories this platform captures separate, affirmative
 * guardian consent for — see 20260829270000_consent_management.sql's
 * migration header for why these three and not a "core data processing"
 * category (that remains an unresolved legal question, not an engineering
 * default). CONSENT_CATEGORIES is the fixed, ordered list used everywhere
 * a full set of toggles is rendered (e.g. the guardian self-service view).
 */
export const CONSENT_CATEGORIES: ConsentCategory[] = ['photo_media_use', 'marketing_communications', 'third_party_data_sharing'];

export const CONSENT_CATEGORY_LABELS: Record<ConsentCategory, string> = {
  photo_media_use: 'Photo & media use',
  marketing_communications: 'Marketing communications',
  third_party_data_sharing: 'Third-party data sharing',
};

export const CONSENT_CATEGORY_DESCRIPTIONS: Record<ConsentCategory, string> = {
  photo_media_use: "Your child's photo or video may appear in the school yearbook, website, newsletter, or social media.",
  marketing_communications: 'The school may send you promotional or fundraising communications beyond routine school updates.',
  third_party_data_sharing: "Your child's information may be shared with an external partner (e.g. a school photographer or extracurricular provider).",
};

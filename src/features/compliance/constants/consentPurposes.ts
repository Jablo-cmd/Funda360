import type { ConsentPurpose } from '@/lib/database.types';
import type { PrivacyChild } from '@/features/compliance/types/compliance.types';

export interface ConsentPurposeInfo {
  purpose: ConsentPurpose;
  title: string;
  description: string;
  /** Plain-language consequence of refusing — shown before the choice, never hidden. */
  ifRefused: string;
  frameworks: string;
}

/**
 * The consent purposes a guardian decides on, in the order they are asked.
 * Every description says what is collected, why, and what refusing means —
 * POPIA s.18 / GDPR Art. 13 notice requirements, and COPPA's "direct notice".
 */
export const CONSENT_PURPOSES: ConsentPurposeInfo[] = [
  {
    purpose: 'core_educational_processing',
    title: 'Education record',
    description:
      "The school keeps your child's enrolment, attendance, assessment results, report cards and fee account to deliver their education.",
    ifRefused:
      'The school may still keep records it is legally required to keep (e.g. attendance registers), but nothing beyond that.',
    frameworks: 'POPIA s.11/s.35 · GDPR Art. 6/8 · FERPA',
  },
  {
    purpose: 'online_learner_account',
    title: 'Online learner account',
    description:
      'Your child gets their own Funda360 login to see homework, results and timetables and to hand in work online. This collects information directly from your child.',
    ifRefused:
      'Your child will not get a login. You can still see everything through your own account.',
    frameworks: 'COPPA (required under 13) · GDPR Art. 8 · POPIA s.35',
  },
  {
    purpose: 'directory_information',
    title: 'Directory information',
    description:
      "The school may share your child's name, grade and participation in activities in class lists, programmes and school publications.",
    ifRefused: "Your child's name will not appear in school directories or publications.",
    frameworks: 'FERPA §99.37',
  },
  {
    purpose: 'third_party_sharing',
    title: 'Sharing with third parties',
    description:
      "The school may share your child's records with outside organisations you have agreed to, such as tutoring or sports partners. Every disclosure is logged and visible to you.",
    ifRefused:
      'Records are only shared where the law requires or allows it without consent (e.g. the Department of Education).',
    frameworks: 'FERPA §99.30 · POPIA s.11 · GDPR Art. 6',
  },
  {
    purpose: 'photo_media_use',
    title: 'Photos and media',
    description:
      'The school may use photos or videos of your child in newsletters, its website and social media.',
    ifRefused: 'Your child will not appear in published photos or videos.',
    frameworks: 'POPIA · GDPR',
  },
];

export const CONSENT_PURPOSE_TITLE: Record<ConsentPurpose, string> = Object.fromEntries(
  CONSENT_PURPOSES.map((p) => [p.purpose, p.title]),
) as Record<ConsentPurpose, string>;

/** Purposes a guardian must decide (grant or refuse) before using the portal. */
export function requiredPurposes(underCoppaAge: boolean): ConsentPurpose[] {
  return underCoppaAge
    ? ['core_educational_processing', 'online_learner_account']
    : ['core_educational_processing'];
}

/** True while a required purpose has no recorded decision (granted or refused) for this child. */
export function childNeedsDecision(child: PrivacyChild): boolean {
  return requiredPurposes(child.under_coppa_age).some((p) => child.consents[p] == null);
}

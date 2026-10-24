import { supabase } from '@/lib/supabase';
import { getDbErrorMessage } from '@/lib/dbErrors';
import { guardianService } from '@/features/learners/services/guardianService';
import { guardianInvitationService } from '@/features/guardians/services/guardianInvitationService';
import type { ImportedGuardian } from '@/features/learners/utils/csvImport';

export interface GuardianImportLink {
  learnerId: string;
  learnerLabel: string;
  guardian: ImportedGuardian;
}

export interface GuardianImportResult {
  created: number;
  reused: number;
  linked: number;
  invited: number;
  errors: string[];
}

/**
 * Second step of a learner CSV import: for every row that named a guardian,
 * reuse the school's existing guardian with that email or create one
 * (admin_create_guardian), link them to the learner as primary guardian and
 * emergency contact, and optionally send portal invitations to the
 * guardians this import created. Siblings that share a guardian email get
 * one guardian. A failure on one guardian is reported and does not stop the
 * others; the learners themselves are already saved.
 */
export async function importGuardians(
  schoolId: string,
  links: GuardianImportLink[],
  options: { invite: boolean },
): Promise<GuardianImportResult> {
  const result: GuardianImportResult = { created: 0, reused: 0, linked: 0, invited: 0, errors: [] };
  if (links.length === 0) return result;

  const emails = [...new Set(links.map((link) => link.guardian.email))];
  const { data: existing, error } = await supabase
    .from('profiles')
    .select('id, email')
    .eq('tenant_id', schoolId)
    .in('role', ['parent', 'guardian'])
    .in('email', emails);
  if (error) throw error;

  const idByEmail = new Map<string, string>();
  for (const row of existing) {
    if (row.email) idByEmail.set(row.email.toLowerCase(), row.id);
  }
  result.reused = idByEmail.size;

  const createdIds = new Set<string>();
  const failedEmails = new Set<string>();
  for (const email of emails) {
    if (idByEmail.has(email)) continue;
    const guardian = links.find((link) => link.guardian.email === email)!.guardian;
    try {
      const created = await guardianService.createGuardianProfile({
        firstName: guardian.firstName,
        lastName: guardian.lastName,
        email,
        phone: guardian.phone,
      });
      idByEmail.set(email, created.id);
      createdIds.add(created.id);
      result.created += 1;
    } catch (err) {
      failedEmails.add(email);
      result.errors.push(
        `${email}: ${getDbErrorMessage(err, 'the guardian could not be created.')}`,
      );
    }
  }

  for (const link of links) {
    const guardianId = idByEmail.get(link.guardian.email);
    if (!guardianId) {
      if (!failedEmails.has(link.guardian.email)) {
        result.errors.push(`${link.learnerLabel}: no guardian for ${link.guardian.email}.`);
      }
      continue;
    }
    try {
      await guardianService.createGuardian(schoolId, link.learnerId, {
        guardianProfileId: guardianId,
        relationshipType: link.guardian.relationshipType,
        isPrimary: true,
        isEmergencyContact: true,
      });
      result.linked += 1;
    } catch (err) {
      result.errors.push(
        `${link.learnerLabel}: ${getDbErrorMessage(err, `could not be linked to ${link.guardian.email}.`)}`,
      );
    }
  }

  if (options.invite) {
    for (const [email, id] of idByEmail) {
      if (!createdIds.has(id)) continue;
      try {
        await guardianInvitationService.sendInvitation(id, email);
        result.invited += 1;
      } catch (err) {
        result.errors.push(
          `${email}: ${getDbErrorMessage(err, 'the invitation could not be sent.')}`,
        );
      }
    }
  }

  return result;
}

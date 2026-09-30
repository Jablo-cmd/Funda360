import { describe, expect, it } from 'vitest';
import {
  exportFileBase,
  recordPackageToCsv,
  recordPackageToFacts,
  recordPackageToJson,
} from '@/features/compliance/utils/recordExport';
import type { LearnerRecordPackage } from '@/features/compliance/types/compliance.types';

function pkg(): LearnerRecordPackage {
  return {
    format: 'funda360.learner-record.v1',
    generated_at: '2026-09-30T08:00:00Z',
    school: { id: 's1', name: 'Riverside College' },
    learner: {
      id: 'l1',
      first_name: 'Naledi',
      last_name: 'Dube',
      date_of_birth: '2014-03-01',
      preferred_name: null,
    },
    enrollments: [
      {
        academic_year: '2026',
        grade: 'Grade 6',
        class: '6A',
        status: 'active',
        enrollment_date: '2026-01-15',
      },
    ],
    guardians: [
      { name: 'Thandi Dube', relationship: 'mother', is_primary: true, custody_notes: null },
    ],
    emergency_contacts: [],
    medical: { id: 'm1', learner_id: 'l1', allergies: 'Peanuts', medication: null },
    attendance: [{ date: '2026-03-02', status: 'absent', notes: null }],
    assessment_results: [
      { assessment: 'Maths test 1', type: 'test', date: '2026-02-10', mark: 42, max_mark: 50 },
    ],
    report_cards: [],
    behaviour: [],
    fees: {
      charges: [{ description: 'Tuition', amount: 5000, due_date: '2026-02-01' }],
      payments: [],
    },
    documents: [],
    privacy: {
      consents: [
        {
          purpose: 'core_educational_processing',
          decision: 'granted',
          method: 'in_app_attestation',
          decided_at: '2026-01-10T09:00:00Z',
        },
      ],
      amendment_requests: [],
      disclosures: [
        {
          disclosed_to: '=cmd|calc',
          recipient_type: 'education_authority',
          disclosed_at: '2026-04-01T10:00:00Z',
        },
      ],
    },
  };
}

describe('recordPackageToFacts', () => {
  it('turns every section into dated, labelled facts', () => {
    const facts = recordPackageToFacts(pkg());
    expect(facts).toContainEqual({
      section: 'Learner',
      date: '',
      item: 'first name',
      detail: 'Naledi',
    });
    expect(facts).toContainEqual({
      section: 'Medical',
      date: '',
      item: 'allergies',
      detail: 'Peanuts',
    });
    expect(facts.find((f) => f.section === 'Attendance')).toEqual({
      section: 'Attendance',
      date: '2026-03-02',
      item: 'absent',
      detail: '',
    });
    const result = facts.find((f) => f.section === 'Assessment result');
    expect(result?.item).toBe('Maths test 1');
    expect(result?.detail).toContain('mark: 42');
  });

  it('omits empty values and internal identifiers from medical data', () => {
    const facts = recordPackageToFacts(pkg());
    expect(facts.some((f) => f.item === 'preferred name')).toBe(false);
    expect(facts.some((f) => f.section === 'Medical' && f.item.includes('id'))).toBe(false);
  });
});

describe('export formats', () => {
  it('JSON round-trips the full package', () => {
    expect(JSON.parse(recordPackageToJson(pkg()))).toEqual(pkg());
  });

  it('CSV has a header and neutralises formula-like values', () => {
    const csv = recordPackageToCsv(pkg());
    expect(csv.split('\r\n')[0]).toBe('Section,Date,Item,Detail');
    expect(csv).toContain("'=cmd|calc");
  });

  it('names files after the learner and the export date', () => {
    expect(exportFileBase(pkg())).toBe('learner-record-naledi-dube-2026-09-30');
  });
});

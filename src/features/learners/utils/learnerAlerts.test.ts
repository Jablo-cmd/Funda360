import { describe, expect, it } from 'vitest';
import { deriveLearnerAlerts, type LearnerAlertsInputs } from './learnerAlerts';

function baseInputs(overrides: Partial<LearnerAlertsInputs> = {}): LearnerAlertsInputs {
  return {
    guardianCount: 1,
    hasEmergencyContact: true,
    attendanceStats: { present: 20, absent: 0, late: 0, excused: 0, qualifyingDays: 20, attendanceRate: 100 },
    overallAveragePercentage: 80,
    feeSummary: undefined,
    behaviourSummary: undefined,
    hasMedicalInfoOnFile: undefined,
    ...overrides,
  };
}

describe('deriveLearnerAlerts', () => {
  it('returns no alerts when everything is in order and no sensitive domain is visible', () => {
    expect(deriveLearnerAlerts(baseInputs())).toEqual([]);
  });

  it('flags a missing guardian', () => {
    const alerts = deriveLearnerAlerts(baseInputs({ guardianCount: 0 }));
    expect(alerts.map((a) => a.id)).toContain('guardian-missing');
  });

  it('flags a missing emergency contact', () => {
    const alerts = deriveLearnerAlerts(baseInputs({ hasEmergencyContact: false }));
    expect(alerts.map((a) => a.id)).toContain('emergency-contact-missing');
  });

  it('flags attendance below the threshold', () => {
    const alerts = deriveLearnerAlerts(
      baseInputs({ attendanceStats: { present: 5, absent: 5, late: 0, excused: 0, qualifyingDays: 10, attendanceRate: 50 } }),
    );
    expect(alerts.map((a) => a.id)).toContain('attendance-low');
  });

  it('does not flag attendance when there is no qualifying data yet', () => {
    const alerts = deriveLearnerAlerts(
      baseInputs({ attendanceStats: { present: 0, absent: 0, late: 0, excused: 0, qualifyingDays: 0, attendanceRate: null } }),
    );
    expect(alerts.map((a) => a.id)).not.toContain('attendance-low');
  });

  it('flags a low academic average', () => {
    const alerts = deriveLearnerAlerts(baseInputs({ overallAveragePercentage: 30 }));
    expect(alerts.map((a) => a.id)).toContain('academic-low');
  });

  it('never fabricates a financial alert when the viewer cannot see financial info (undefined)', () => {
    const alerts = deriveLearnerAlerts(baseInputs({ feeSummary: undefined }));
    expect(alerts.map((a) => a.id)).not.toContain('fees-outstanding');
  });

  it('flags outstanding fees only when the caller can view financial info', () => {
    const alerts = deriveLearnerAlerts(
      baseInputs({
        feeSummary: { totalCharged: 1000, totalPaid: 0, outstandingBalance: 1000, status: 'outstanding', lastPayment: null, charges: [], payments: [] },
      }),
    );
    expect(alerts.map((a) => a.id)).toContain('fees-outstanding');
  });

  it('does not flag a learner who has never been charged anything (deriveFeeStatus defaults to outstanding with zero data)', () => {
    const alerts = deriveLearnerAlerts(
      baseInputs({
        feeSummary: { totalCharged: 0, totalPaid: 0, outstandingBalance: 0, status: 'outstanding', lastPayment: null, charges: [], payments: [] },
      }),
    );
    expect(alerts.map((a) => a.id)).not.toContain('fees-outstanding');
  });

  it('does not flag a fee status of paid', () => {
    const alerts = deriveLearnerAlerts(
      baseInputs({
        feeSummary: { totalCharged: 1000, totalPaid: 1000, outstandingBalance: 0, status: 'paid', lastPayment: null, charges: [], payments: [] },
      }),
    );
    expect(alerts.map((a) => a.id)).not.toContain('fees-outstanding');
  });

  it('never fabricates a behaviour alert when the viewer cannot see behaviour info (undefined)', () => {
    const alerts = deriveLearnerAlerts(baseInputs({ behaviourSummary: undefined }));
    expect(alerts.map((a) => a.id)).not.toContain('behaviour-attention');
  });

  it('flags recent negative behaviour only when the caller can view behaviour info', () => {
    const alerts = deriveLearnerAlerts(
      baseInputs({ behaviourSummary: { incidents: [], hasRecentNegative: true, positiveCount: 0, negativeCount: 1 } }),
    );
    expect(alerts.map((a) => a.id)).toContain('behaviour-attention');
  });

  it('never fabricates a medical alert when the viewer cannot see medical info (undefined)', () => {
    const alerts = deriveLearnerAlerts(baseInputs({ hasMedicalInfoOnFile: undefined }));
    expect(alerts.map((a) => a.id)).not.toContain('medical-missing');
  });

  it('flags missing medical information only when the caller can view medical info', () => {
    const alerts = deriveLearnerAlerts(baseInputs({ hasMedicalInfoOnFile: false }));
    expect(alerts.map((a) => a.id)).toContain('medical-missing');
  });
});

import { test, expect } from '@playwright/test';
import { fulfillJson, seedAuthenticatedSession } from './utils/mockAuth';
import {
  MOCK_TENANT_ID,
  buildMockSchoolRow,
  buildMockProfileRow,
  buildMockAcademicYearRow,
  buildMockLearnerRow,
  installDataMocks,
  installLearnerDetailMock,
} from './utils/mockData';

const CHARGE_ROW = {
  id: 'charge-1',
  school_id: MOCK_TENANT_ID,
  learner_id: 'learner-1',
  academic_year_id: 'year-2026',
  fee_structure_id: null,
  description: 'Term 1 Tuition',
  category: 'tuition',
  amount: 1000,
  due_date: '2026-03-01',
  notes: null,
  active: true,
  created_by: null,
  updated_by: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const PAYMENT_ROW = {
  id: 'payment-1',
  school_id: MOCK_TENANT_ID,
  learner_id: 'learner-1',
  academic_year_id: 'year-2026',
  amount: 400,
  payment_date: '2026-02-01',
  method: 'eft',
  reference: 'REF-001',
  notes: null,
  active: true,
  created_by: null,
  updated_by: null,
  created_at: '2026-02-01T00:00:00Z',
  updated_at: '2026-02-01T00:00:00Z',
};

// Matched loosely on separators — Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' })
// spacing/decimal-separator rendering can vary by ICU version; the digits are what actually matter here.
function zar(amount: number): RegExp {
  return new RegExp(`R\\D{0,2}${amount}[.,]00`);
}

async function installFeesBaseMocks(page: import('@playwright/test').Page) {
  await page.route('**/rest/v1/fee_structures*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await fulfillJson(route, []);
  });
  await page.route('**/rest/v1/learner_fee_charges*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await fulfillJson(route, [CHARGE_ROW]);
  });
  await page.route('**/rest/v1/learner_fee_payments*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await fulfillJson(route, [PAYMENT_ROW]);
  });
  await page.route('**/rest/v1/learner_fee_refunds*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await fulfillJson(route, []);
  });
  await page.route('**/rest/v1/invoices*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await fulfillJson(route, []);
  });
  await page.route('**/rest/v1/learner_fee_payment_allocations*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await fulfillJson(route, []);
  });
}

test("a finance_manager can view a learner's financial summary with the correct outstanding balance", async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'finance_manager' });
  await installDataMocks(page, {
    profile: buildMockProfileRow({ role: 'finance_manager' }),
    school: buildMockSchoolRow(),
    academicYears: [buildMockAcademicYearRow()],
  });
  await installLearnerDetailMock(page, buildMockLearnerRow());
  await installFeesBaseMocks(page);
  await page.route('**/rest/v1/learner_fee_adjustments*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await fulfillJson(route, []);
  });

  await page.goto('/learners/learner-1');
  await page.getByRole('button', { name: 'Financial' }).click();

  await expect(page.getByText('Term 1 Tuition')).toBeVisible();
  // 1000 charged - 400 paid = 600 outstanding.
  await expect(page.getByText(zar(600)).first()).toBeVisible();
});

test('a finance_manager can record a discount and it reduces the outstanding balance', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'finance_manager' });
  await installDataMocks(page, {
    profile: buildMockProfileRow({ role: 'finance_manager' }),
    school: buildMockSchoolRow(),
    academicYears: [buildMockAcademicYearRow()],
  });
  await installLearnerDetailMock(page, buildMockLearnerRow());
  await installFeesBaseMocks(page);

  let adjustmentCreated = false;
  const adjustmentRow = {
    id: 'adjustment-1',
    school_id: MOCK_TENANT_ID,
    learner_id: 'learner-1',
    academic_year_id: 'year-2026',
    charge_id: null,
    adjustment_type: 'discount',
    method: 'fixed_amount',
    percentage: null,
    amount: 100,
    reason: 'Sibling discount',
    active: true,
    created_by: null,
    updated_by: null,
    created_at: '2026-02-10T00:00:00Z',
    updated_at: '2026-02-10T00:00:00Z',
  };
  await page.route('**/rest/v1/learner_fee_adjustments*', async (route) => {
    if (route.request().method() === 'POST') {
      adjustmentCreated = true;
      await fulfillJson(route, adjustmentRow);
      return;
    }
    if (route.request().method() !== 'GET') return route.fallback();
    await fulfillJson(route, adjustmentCreated ? [adjustmentRow] : []);
  });

  await page.goto('/learners/learner-1');
  await page.getByRole('button', { name: 'Financial' }).click();
  await page.getByRole('button', { name: 'Add discount / bursary' }).click();

  await page.getByLabel('Amount (Rand removed from the balance)').fill('100');
  await page.getByLabel('Reason').fill('Sibling discount');
  await page.getByRole('button', { name: 'Add adjustment' }).click();

  await expect(page.getByRole('heading', { name: 'Add discount / bursary' })).toHaveCount(0);
  await expect(page.getByText('Sibling discount')).toBeVisible();
  // 1000 charged - 100 discount - 400 paid = 500 outstanding.
  await expect(page.getByText(zar(500)).first()).toBeVisible();
});

test('a finance_manager sees the debtor list on Finance Overview and can export it', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'finance_manager' });
  await installDataMocks(page, {
    profile: buildMockProfileRow({ role: 'finance_manager' }),
    school: buildMockSchoolRow(),
    academicYears: [buildMockAcademicYearRow()],
  });
  await installFeesBaseMocks(page);
  await page.route('**/rest/v1/learner_fee_adjustments*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await fulfillJson(route, []);
  });
  await page.route('**/rest/v1/learners*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await fulfillJson(route, [{ id: 'learner-1', first_name: 'Naledi', last_name: 'Dube', learner_number: 'LRN-0001' }]);
  });

  await page.goto('/fees');
  await expect(page.getByRole('heading', { name: 'Finance Overview' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Debtor list' })).toBeVisible();
  await expect(page.getByText(/Naledi Dube/)).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export debtor list' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/debtor-list.*\.csv$/);
});

test('a finance_manager can send overdue reminders from Finance Overview', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'finance_manager' });
  await installDataMocks(page, {
    profile: buildMockProfileRow({ role: 'finance_manager' }),
    school: buildMockSchoolRow(),
    academicYears: [buildMockAcademicYearRow()],
  });
  await installFeesBaseMocks(page);
  await page.route('**/rest/v1/learner_fee_adjustments*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await fulfillJson(route, []);
  });
  await page.route('**/rest/v1/learners*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await fulfillJson(route, []);
  });

  let calledWithSchoolId: string | undefined;
  await page.route('**/rest/v1/rpc/trigger_fee_overdue_reminders', async (route) => {
    const body = route.request().postDataJSON() as { p_school_id: string };
    calledWithSchoolId = body.p_school_id;
    await fulfillJson(route, 3);
  });

  await page.goto('/fees');
  await page.getByRole('button', { name: 'Send overdue reminders now' }).click();

  await expect(page.getByText('Sent 3 reminders.')).toBeVisible();
  expect(calledWithSchoolId).toBe(MOCK_TENANT_ID);
});

test('the finance dashboard shows a Collection Rate KPI for a finance role', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'finance_manager' });
  await installDataMocks(page, {
    profile: buildMockProfileRow({ role: 'finance_manager' }),
    school: buildMockSchoolRow(),
    academicYears: [buildMockAcademicYearRow({ isActive: true })],
  });
  await installFeesBaseMocks(page);
  await page.route('**/rest/v1/learner_fee_adjustments*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await fulfillJson(route, []);
  });
  await page.route('**/rest/v1/learners*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await fulfillJson(route, [{ id: 'learner-1', first_name: 'Naledi', last_name: 'Dube', learner_number: 'LRN-0001' }]);
  });

  await page.goto('/dashboard');
  // CHARGE_ROW (1000) - PAYMENT_ROW (400 paid), no adjustments -> 40% collected.
  const kpiCard = page.getByRole('link', { name: /Collection Rate/ });
  await expect(kpiCard).toBeVisible();
  await expect(kpiCard).toContainText('40%');
  // The finance dashboard is finance-only — no attendance/academic KPIs.
  await expect(page.getByText('Outstanding Fees')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Attendance', exact: true })).toHaveCount(0);
});

const BANK_LINE = {
  id: 'line-1',
  school_id: MOCK_TENANT_ID,
  import_id: 'import-1',
  transaction_date: '2026-08-25',
  description: 'EFT DEPOSIT SCHOOL FEES REF 0001',
  amount: 400,
  matched_at: null,
  matched_by: null,
  created_at: '2026-08-27T00:00:00Z',
  updated_at: '2026-08-27T00:00:00Z',
};

const BANK_CHARGE_LINE = {
  ...BANK_LINE,
  id: 'line-2',
  description: 'MONTHLY ACCOUNT ADMINISTRATION FEE',
  amount: 57,
};

async function installReconciliationBaseMocks(page: import('@playwright/test').Page) {
  await seedAuthenticatedSession(page, { role: 'finance_manager' });
  await installDataMocks(page, {
    profile: buildMockProfileRow({ role: 'finance_manager' }),
    school: buildMockSchoolRow(),
    academicYears: [buildMockAcademicYearRow()],
  });
  await page.route('**/rest/v1/learners*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await fulfillJson(route, [{ id: 'learner-1', first_name: 'Naledi', last_name: 'Dube', learner_number: 'LRN-0001' }]);
  });
}

test('a finance_manager can match an unmatched bank statement line to a recorded payment', async ({ page }) => {
  await installReconciliationBaseMocks(page);

  let matched = false;
  await page.route('**/rest/v1/bank_statement_lines*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await fulfillJson(route, [
      matched ? { ...BANK_LINE, status: 'matched', matched_payment_id: 'payment-1' } : { ...BANK_LINE, status: 'unmatched', matched_payment_id: null },
    ]);
  });
  await page.route('**/rest/v1/learner_fee_payments*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    if (route.request().url().includes('id=in')) return fulfillJson(route, [PAYMENT_ROW]);
    return fulfillJson(route, matched ? [] : [PAYMENT_ROW]);
  });

  let rpcBody: { p_line_id: string; p_payment_id: string } | undefined;
  await page.route('**/rest/v1/rpc/reconcile_bank_statement_line', async (route) => {
    rpcBody = route.request().postDataJSON() as { p_line_id: string; p_payment_id: string };
    matched = true;
    await fulfillJson(route, null);
  });

  await page.goto('/fees/reconciliation');
  await expect(page.getByRole('heading', { name: 'Bank Reconciliation' })).toBeVisible();
  await expect(page.getByText('EFT DEPOSIT SCHOOL FEES REF 0001')).toBeVisible();

  await page.getByRole('combobox', { name: /Match payment for/ }).selectOption('payment-1');
  await page.getByRole('button', { name: 'Match', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Matched (1)' })).toBeVisible();
  await expect(page.getByText(/Matched to Naledi Dube/)).toBeVisible();
  expect(rpcBody).toEqual({ p_line_id: 'line-1', p_payment_id: 'payment-1' });
});

test('a finance_manager can mark a bank charge line as ignored', async ({ page }) => {
  await installReconciliationBaseMocks(page);

  let ignored = false;
  await page.route('**/rest/v1/bank_statement_lines*', async (route) => {
    const method = route.request().method();
    if (method === 'PATCH') {
      ignored = true;
      return fulfillJson(route, [{ ...BANK_CHARGE_LINE, status: 'ignored', matched_payment_id: null }]);
    }
    if (method !== 'GET') return route.fallback();
    await fulfillJson(route, [{ ...BANK_CHARGE_LINE, status: ignored ? 'ignored' : 'unmatched', matched_payment_id: null }]);
  });
  await page.route('**/rest/v1/learner_fee_payments*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await fulfillJson(route, []);
  });

  await page.goto('/fees/reconciliation');
  await expect(page.getByText('MONTHLY ACCOUNT ADMINISTRATION FEE')).toBeVisible();

  await page.getByRole('button', { name: 'Ignore' }).click();

  await expect(page.getByRole('heading', { name: 'Ignored (1)' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Unmatched (0)' })).toBeVisible();
});

test('a role without learner.view_financial does not see the Financial tab', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'teacher' });
  await installDataMocks(page, {
    profile: buildMockProfileRow({ role: 'teacher' }),
    school: buildMockSchoolRow(),
    academicYears: [buildMockAcademicYearRow()],
  });
  await installLearnerDetailMock(page, buildMockLearnerRow());

  await page.goto('/learners/learner-1');
  await expect(page.getByRole('button', { name: 'Financial' })).toHaveCount(0);
});

test('a finance_manager can create a draft invoice and issue it', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'finance_manager' });
  await installDataMocks(page, {
    profile: buildMockProfileRow({ role: 'finance_manager' }),
    school: buildMockSchoolRow(),
    academicYears: [buildMockAcademicYearRow()],
  });
  await installLearnerDetailMock(page, buildMockLearnerRow());
  await installFeesBaseMocks(page);
  await page.route('**/rest/v1/learner_fee_adjustments*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await fulfillJson(route, []);
  });

  const draftInvoice = {
    id: 'invoice-1',
    school_id: MOCK_TENANT_ID,
    learner_id: 'learner-1',
    academic_year_id: 'year-2026',
    invoice_number: null,
    status: 'draft',
    issue_date: null,
    due_date: null,
    notes: 'Term 1',
    vat_rate: 0,
    subtotal: 0,
    vat_amount: 0,
    total: 0,
    issued_at: null,
    issued_by: null,
    voided_at: null,
    voided_by: null,
    void_reason: null,
    created_by: null,
    updated_by: null,
    created_at: '2026-02-01T00:00:00Z',
    updated_at: '2026-02-01T00:00:00Z',
  };
  const issuedInvoice = {
    ...draftInvoice,
    invoice_number: 'INV-2026-00001',
    status: 'issued',
    issue_date: '2026-09-01',
    due_date: '2099-12-31',
    subtotal: 1200,
    total: 1200,
    issued_at: '2026-09-01T00:00:00Z',
  };

  let invoiceCreated = false;
  let invoiceIssued = false;

  // The line-item charges are inserted after the draft invoice.
  await page.unroute('**/rest/v1/learner_fee_charges*');
  await page.route('**/rest/v1/learner_fee_charges*', async (route) => {
    const method = route.request().method();
    if (method === 'POST') return fulfillJson(route, [{ ...CHARGE_ROW, id: 'charge-inv-1', invoice_id: 'invoice-1', amount: 1200 }]);
    if (method !== 'GET') return route.fallback();
    await fulfillJson(route, invoiceCreated ? [{ ...CHARGE_ROW, id: 'charge-inv-1', invoice_id: 'invoice-1', amount: 1200 }] : [CHARGE_ROW]);
  });

  // invoices GET reflects the current state; POST creates the draft.
  await page.unroute('**/rest/v1/invoices*');
  await page.route('**/rest/v1/invoices*', async (route) => {
    const method = route.request().method();
    if (method === 'POST') {
      invoiceCreated = true;
      await fulfillJson(route, draftInvoice);
      return;
    }
    if (method !== 'GET') return route.fallback();
    if (!invoiceCreated) return fulfillJson(route, []);
    await fulfillJson(route, [invoiceIssued ? issuedInvoice : draftInvoice]);
  });
  await page.route('**/rest/v1/rpc/issue_fee_invoice', async (route) => {
    invoiceIssued = true;
    await fulfillJson(route, issuedInvoice);
  });

  await page.goto('/learners/learner-1');
  await page.getByRole('button', { name: 'Financial' }).click();

  await page.getByRole('button', { name: 'New invoice' }).click();
  await expect(page.getByRole('heading', { name: 'New invoice (draft)' })).toBeVisible();

  await page.getByLabel('Description').first().fill('Term 1 tuition');
  await page.getByLabel('Amount').first().fill('1200');
  await page.getByRole('button', { name: 'Create draft' }).click();

  await expect(page.getByRole('heading', { name: 'New invoice (draft)' })).toHaveCount(0);
  expect(invoiceCreated).toBe(true);

  await page.getByRole('button', { name: 'Issue', exact: true }).click();
  await expect(page.getByRole('row', { name: /INV-2026-00001/ })).toContainText('Issued');
  expect(invoiceIssued).toBe(true);
});

test('a guardian sees an issued invoice with a Pay button on the family Fees page', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'guardian' });
  await installDataMocks(page, {
    profile: buildMockProfileRow({ role: 'guardian' }),
    school: buildMockSchoolRow(),
    academicYears: [buildMockAcademicYearRow()],
  });

  await page.route('**/rest/v1/learners*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await fulfillJson(route, [{ ...buildMockLearnerRow(), id: 'learner-1', first_name: 'Naledi', last_name: 'Dube' }]);
  });
  await installFeesBaseMocks(page);
  await page.route('**/rest/v1/learner_fee_adjustments*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await fulfillJson(route, []);
  });
  await page.route('**/rest/v1/fee_receipts*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await fulfillJson(route, []);
  });

  const issuedInvoice = {
    id: 'invoice-1',
    school_id: MOCK_TENANT_ID,
    learner_id: 'learner-1',
    academic_year_id: 'year-2026',
    invoice_number: 'INV-2026-00001',
    status: 'issued',
    issue_date: '2026-02-01',
    due_date: '2026-03-03',
    notes: null,
    vat_rate: 0,
    subtotal: 900,
    vat_amount: 0,
    total: 900,
    issued_at: '2026-02-01T00:00:00Z',
    issued_by: null,
    voided_at: null,
    voided_by: null,
    void_reason: null,
    created_by: null,
    updated_by: null,
    created_at: '2026-02-01T00:00:00Z',
    updated_at: '2026-02-01T00:00:00Z',
  };
  await page.unroute('**/rest/v1/invoices*');
  await page.route('**/rest/v1/invoices*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    await fulfillJson(route, [issuedInvoice]);
  });

  await page.goto('/parent/fees');
  await expect(page.getByRole('heading', { name: 'Fees' })).toBeVisible();
  await expect(page.getByText('INV-2026-00001')).toBeVisible();
  await expect(page.getByRole('button', { name: /Pay/ })).toBeVisible();
});

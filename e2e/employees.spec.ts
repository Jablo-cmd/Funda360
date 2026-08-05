import { test, expect } from '@playwright/test';
import { fulfillJson, seedAuthenticatedSession } from './utils/mockAuth';
import {
  buildMockSchoolRow,
  buildMockProfileRow,
  buildMockDepartmentRow,
  buildMockEmployeeRow,
  installDataMocks,
  installDepartmentsListMock,
  installEmployeesListMock,
  installEmployeeDetailMock,
  installEmployeeCandidatesMock,
  installEmployeeRpcMock,
} from './utils/mockData';

test('principal can view the employees directory', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, { profile: buildMockProfileRow(), school: buildMockSchoolRow() });
  await installDepartmentsListMock(page, [buildMockDepartmentRow()]);
  await installEmployeesListMock(page, [buildMockEmployeeRow()]);

  await page.goto('/employees');
  await expect(page.getByRole('heading', { name: 'Employees' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Karabo Mokoena' })).toBeVisible();
});

test('principal cannot manage employees (view-only)', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, { profile: buildMockProfileRow(), school: buildMockSchoolRow() });
  await installDepartmentsListMock(page, [buildMockDepartmentRow()]);
  await installEmployeesListMock(page, [buildMockEmployeeRow()]);

  await page.goto('/employees');
  await expect(page.getByRole('button', { name: 'Add employee' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Edit' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Terminate' })).toHaveCount(0);
});

test('hr_manager can create an employee', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'hr_manager' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'hr_manager' }), school: buildMockSchoolRow() });
  await installDepartmentsListMock(page, [buildMockDepartmentRow()]);
  await installEmployeesListMock(page, []);
  await installEmployeeCandidatesMock(page, []);

  await page.route('**/rest/v1/employees*', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    await fulfillJson(route, buildMockEmployeeRow({ id: 'employee-2', firstName: 'Palesa', lastName: 'Nkosi' }));
  });

  await page.goto('/employees');
  await page.getByRole('button', { name: 'Add employee' }).click();
  await page.getByLabel('First name').fill('Palesa');
  await page.getByLabel('Last name').fill('Nkosi');
  await page.getByLabel('Employee number').fill('EMP-0002');
  await page.getByLabel('Hire date').fill('2026-02-01');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByRole('heading', { name: 'Add employee' })).toHaveCount(0);
});

test('hr_manager can view an employee profile with full detail', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'hr_manager' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'hr_manager' }), school: buildMockSchoolRow() });
  await installDepartmentsListMock(page, [buildMockDepartmentRow()]);
  await installEmployeeDetailMock(page, buildMockEmployeeRow());

  await page.goto('/employees/employee-1');
  await expect(page.getByRole('heading', { name: 'Karabo Mokoena' })).toBeVisible();
  await expect(page.getByText('Human Resources')).toBeVisible();
  await expect(page.getByText('HR Officer')).toBeVisible();
});

test('hr_manager can terminate an employee', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'hr_manager' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'hr_manager' }), school: buildMockSchoolRow() });
  await installDepartmentsListMock(page, [buildMockDepartmentRow()]);
  await installEmployeeDetailMock(page, buildMockEmployeeRow());
  await installEmployeeRpcMock(page, 'terminate_employee', async (route) => {
    await fulfillJson(route, buildMockEmployeeRow({ employmentStatus: 'terminated' }));
  });

  await page.goto('/employees/employee-1');
  await page.getByRole('button', { name: 'Terminate' }).click();
  await page.getByLabel('Termination date').fill('2026-06-30');
  await page.getByRole('dialog').getByRole('button', { name: 'Terminate' }).click();

  await expect(page.getByRole('heading', { name: 'Terminate employee' })).toHaveCount(0);
});

test('hr_manager can reactivate a terminated employee', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'hr_manager' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'hr_manager' }), school: buildMockSchoolRow() });
  await installDepartmentsListMock(page, [buildMockDepartmentRow()]);
  await installEmployeeDetailMock(page, buildMockEmployeeRow({ employmentStatus: 'terminated' }));
  await installEmployeeRpcMock(page, 'reactivate_employee', async (route) => {
    await fulfillJson(route, buildMockEmployeeRow({ employmentStatus: 'active' }));
  });

  await page.goto('/employees/employee-1');
  await page.getByRole('button', { name: 'Reactivate' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Reactivate' }).click();

  await expect(page.getByRole('heading', { name: 'Reactivate employee' })).toHaveCount(0);
});

test('hr_manager can provision a login for an employee', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'hr_manager' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'hr_manager' }), school: buildMockSchoolRow() });
  await installDepartmentsListMock(page, [buildMockDepartmentRow()]);
  await installEmployeeDetailMock(page, buildMockEmployeeRow());
  await installEmployeeRpcMock(page, 'provision_employee_login', async (route) => {
    await fulfillJson(route, [{ user_id: '66666666-6666-6666-6666-666666666666', temporary_password: 'Tmp9xQ2vLkZo1==' }]);
  });

  await page.goto('/employees/employee-1');
  await page.getByRole('button', { name: 'Provision login' }).click();
  await page.getByLabel('Role').selectOption('teacher');
  await page.getByRole('dialog').getByRole('button', { name: 'Provision login' }).click();

  await expect(page.getByText('Tmp9xQ2vLkZo1==')).toBeVisible();
});

test('an employee with no work email cannot be provisioned a login', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'hr_manager' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'hr_manager' }), school: buildMockSchoolRow() });
  await installDepartmentsListMock(page, [buildMockDepartmentRow()]);
  await installEmployeeDetailMock(page, buildMockEmployeeRow({ workEmail: null }));

  await page.goto('/employees/employee-1');
  await page.getByRole('button', { name: 'Provision login' }).click();
  await expect(page.getByText('has no work email on file')).toBeVisible();
  await expect(page.getByLabel('Role')).toHaveCount(0);
});

test('a role without employee.view is blocked from the employees section', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'teacher' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'teacher' }), school: buildMockSchoolRow() });

  await page.goto('/employees');
  await expect(page).toHaveURL('http://localhost:5173/dashboard');
  await expect(page.getByRole('link', { name: 'Employees' })).toHaveCount(0);
});

test('hr_manager can create and archive a department', async ({ page }) => {
  await seedAuthenticatedSession(page, { role: 'hr_manager' });
  await installDataMocks(page, { profile: buildMockProfileRow({ role: 'hr_manager' }), school: buildMockSchoolRow() });
  await installDepartmentsListMock(page, [buildMockDepartmentRow()]);

  await page.route('**/rest/v1/departments*', async (route) => {
    const method = route.request().method();
    if (method === 'POST') {
      return fulfillJson(route, buildMockDepartmentRow({ id: 'department-2', name: 'Finance', code: 'FIN' }));
    }
    if (method === 'PATCH') {
      return fulfillJson(route, buildMockDepartmentRow({ active: false }));
    }
    return route.fallback();
  });

  await page.goto('/employees/departments');
  await page.getByRole('button', { name: 'Add department' }).click();
  await page.getByLabel('Name').fill('Finance');
  await page.getByLabel('Code').fill('FIN');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Add department' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Archive' }).click();
});

test('tenant isolation: the employees list only ever reflects the caller\'s own tenant scope', async ({ page }) => {
  // As with the equivalent Users/Academic/Learners directory tests, RLS
  // (verified independently in supabase/rls-tests/tests/employee_management.test.sql)
  // is the actual tenant-isolation boundary — this only demonstrates that
  // the client renders exactly the rows its (tenant-scoped) query returns.
  await seedAuthenticatedSession(page, { role: 'principal' });
  await installDataMocks(page, { profile: buildMockProfileRow(), school: buildMockSchoolRow() });
  await installDepartmentsListMock(page, [buildMockDepartmentRow()]);
  await installEmployeesListMock(page, [buildMockEmployeeRow({ schoolId: 'tenant-demo' })]);

  await page.goto('/employees');
  await expect(page.getByRole('link', { name: 'Karabo Mokoena' })).toBeVisible();
  await expect(page.getByText(/other-school/)).toHaveCount(0);
});

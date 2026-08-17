export interface PageTitleEntry {
  title: string;
  section: string;
}

/**
 * Static route → { title, section } lookup for the application header's
 * title/breadcrumb block. Purely presentational — does not affect routing,
 * permissions, or data. Ordered longest-prefix-first so a child route
 * (e.g. `/academic/years`) isn't shadowed by its parent (`/academic`).
 */
const PAGE_TITLES: Array<[string, PageTitleEntry]> = [
  ['/dashboard', { title: 'Dashboard', section: 'Overview' }],
  ['/my-profile', { title: 'My Profile', section: 'Administration' }],
  ['/school/profile', { title: 'School Profile', section: 'Administration' }],
  ['/users', { title: 'Users & Roles', section: 'Administration' }],
  ['/academic/years', { title: 'Academic Years', section: 'Academics' }],
  ['/academic/terms', { title: 'Terms', section: 'Academics' }],
  ['/academic/grades', { title: 'Grades', section: 'Academics' }],
  ['/academic/classes', { title: 'Classes', section: 'Academics' }],
  ['/academic/subjects', { title: 'Subjects', section: 'Academics' }],
  ['/academic/teaching-assignments', { title: 'Teaching Assignments', section: 'Academics' }],
  ['/academic', { title: 'Academic Overview', section: 'Academics' }],
  ['/learners', { title: 'Learners', section: 'People' }],
  ['/employees/departments', { title: 'Departments', section: 'People' }],
  ['/employees', { title: 'Employees', section: 'People' }],
  ['/reports/learners', { title: 'Learner Report', section: 'Operations' }],
  ['/reports/employees', { title: 'Employee Report', section: 'Operations' }],
  ['/reports/academic', { title: 'Academic Report', section: 'Operations' }],
  ['/reports', { title: 'Reports', section: 'Operations' }],
];

const DEFAULT_ENTRY: PageTitleEntry = { title: 'Funda360', section: 'Overview' };

export function getPageTitle(pathname: string): PageTitleEntry {
  const match = PAGE_TITLES.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return match ? match[1] : DEFAULT_ENTRY;
}

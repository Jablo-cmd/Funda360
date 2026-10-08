# Funda360: what the app can do today (8 October 2026)

Status labels:

- **Working**: built, connected to the database and covered by automated tests.
- **Not switched on**: code finished, needs setup (accounts, keys or settings).
- **Not built**: does not exist yet.

> **There is no AI in Funda360 today.** Nothing in the app, its database code or its git history calls an AI or machine-learning service. Analytics are counts and totals worked out with fixed formulas. Alerts and content safety follow fixed rules. Do not describe Funda360 as AI-powered until an AI feature is built.

## 1. AI and analytics

1. AI insights, predictions, chatbots, AI comments: **Not built**
2. School analytics (Operations → Analytics): learners, attendance, finance, admissions, discipline, transport: **Working**
3. Attendance trend chart on the dashboard: **Working**
4. Automatic attendance alerts (fixed rules, such as several absences in a row): **Working**

## 2. Finance

1. Fee structures per grade or year; charges per learner: **Working**
2. Recording payments; splitting one payment across several invoices: **Working**
3. Discounts and adjustments; refunds: **Working**
4. Invoices: draft, issue, void, part-paid and overdue tracking, with a register you can filter by status: **Working**
5. PDF receipts and PDF account statements: **Working**
6. Bank reconciliation (upload a bank statement CSV, match or unmatch each line against payments): **Working**
7. Finance overview (billed, collected, outstanding, overdue) with CSV export: **Working**
8. Automatic overdue reminders to parents (daily, at most every 7 days), escalated to finance staff after 14+ days late; "send now" button: **Working**
9. Parent fees page: **Working**
10. Online payments (PayFast, Ozow, Yoco, Peach, Netcash): **Not switched on**. No school has payment settings yet, and the fixed payment server code deploys when the audit branch is merged.
11. Payroll, general ledger, tax invoices: **Not built**. The receipt itself states it is not a tax invoice.

## 3. School setup and platform

1. Multi-school platform with fully separated data: **Working**
2. School onboarding wizard and schools list: **Working**
3. School profile, logo and settings: **Working**
4. Academic years, terms, grades, classes, subjects: **Working**
5. Teaching assignments (which teacher teaches which subject to which class): **Working**
6. Quick search (Ctrl+K): **Working**
7. Light and dark mode; phone, tablet and desktop layouts: **Working**

## 4. Users, roles and security

1. About 20 roles: platform owner, super admin, school owner, principal, vice principal, department head, class and subject teachers, finance manager, accountant, HR manager, admissions officer, medical officer, guardian, learner, plus operations roles: **Working**
2. Each role sees only its own menus; the database enforces the same limits: **Working**
3. Creating staff and learner logins with a temporary password: **Working**. Forced password change at first login: **Not built**
4. Login, forgot password, reset password, email verification: **Working**
5. Two-factor authentication (authenticator app, optional): **Working**. Nobody has turned it on in production yet.
6. Full audit log of sensitive changes: **Working**
7. Password-reset and invitation emails: **Not switched on**. The email setup in `docs/EMAIL_AND_LOGIN_SETUP.md` must be finished.

## 5. Learners

1. Learner records, South African ID number check, enrolment, status changes: **Working**
2. Bulk learner import from CSV: **Working**
3. Guardians, emergency contacts, medical information: **Working**
4. Documents: upload, versions, expiry dates and automatic expiry alerts: **Working**
5. Transfers with a PDF transfer letter: **Working**
6. Promotion to the next grade: **Working**
7. Alumni list: **Working**
8. Learner timeline: **Working**

## 6. Admissions

1. Public online application form (`/apply`); save and finish later: **Working**
2. Document uploads by families (PDF or images, up to 10 MB): **Working**
3. Staff review: submitted, under review, accepted or rejected, enrolled, with notes: **Working**
4. One-step conversion of an accepted application into a learner: **Working**
5. Required documents set by each school: **Working**
6. Abuse protection on the public form (rate limits, date-of-birth check when resuming), live in production since 8 October: **Working**

## 7. Attendance

1. Daily class register: present, absent, late, excused: **Working**
2. Automatic alerts to parents: **Working**
3. Staff attendance: **Working**
4. Attendance reports with CSV export: **Working**

## 8. Assessments, results and report cards

1. Assessments, mark entry, class results: **Working**
2. Grading scales (marks to levels or symbols): **Working**
3. Report card templates: **Working**
4. Report cards per learner or whole class; submit, review, approve, publish; teacher and subject comments; promotion decisions; reissue: **Working**
5. PDF report cards: **Working**
6. Academic interventions for struggling learners: **Working**

## 9. Homework

1. Teachers create, publish and close assignments, with resources: **Working**
2. Learners submit work, including files: **Working**
3. Marking, feedback, return for redo: **Working**
4. Parents see their child's homework: **Working**

## 10. Timetable

1. Timetable by class, teacher or whole school: **Working**
2. Draft and published versions: **Working**
3. Substitute teachers for a given day: **Working**
4. Parents and learners see their own timetable: **Working**

## 11. Behaviour and safeguarding

1. Behaviour incidents (positive and negative) with follow-up; the school chooses what parents see: **Working**
2. Confidential safeguarding concerns: **Working**
3. Message content safety: a fixed word list blocks or flags harmful content; self-harm and violence flags alert the principal: **Working**

## 12. Communication

1. In-app notifications, with each user choosing which they receive: **Working**
2. Announcements to the whole school or selected groups: **Working**
3. Staff-parent messaging with attachments, editing, deleting, archiving: **Working**
4. Email, SMS and WhatsApp delivery (Resend, Twilio): **Not switched on**. Notifications appear inside the app only for now.

## 13. Staff and HR

1. Employee records and departments: **Working**
2. Leave requests and approval: **Working**
3. Staff attendance: **Working**
4. Termination and reactivation: **Working**
5. Payroll: **Not built**

## 14. Parent portal

1. Dashboard covering all linked children: **Working**
2. Each child's profile, attendance, results, report cards, behaviour (only what the school shares), documents, timetable: **Working**
3. Fees, homework, messages, announcements, transport: **Working**
4. Privacy centre: view and download the child's record, request corrections (POPIA): **Working**
5. Account activation by email invitation: **Not switched on** (email setup)

## 15. Learner portal

1. Learner's own dashboard, timetable, homework submission, results, report cards, attendance, documents, transport, notifications, privacy page: **Working**

## 16. Transport

1. Vehicles, drivers, routes and stops: **Working**
2. Assigning learners to routes; daily trip schedules: **Working**
3. Pick-up and drop-off attendance; trip status: **Working**
4. Transport fees: **Working**
5. Parents and learners see their own transport details: **Working**

## 17. School operations (Operations Hub)

These work but are basic, and have had less real-world use than the core modules.

1. Boarding: assigning learners to beds: **Working**
2. Library: lending and renewals: **Working**
3. Sports: teams, players, match results: **Working**
4. Asset register, transfers, lifecycle: **Working**
5. Procurement: purchase requests, approvals, purchase orders: **Working**
6. Governing body (SGB): meetings and resolutions: **Working**
7. Events and participants: **Working**
8. Automation settings for scheduled jobs: **Working**

## 18. Compliance and privacy (POPIA and related)

1. Trust Center for school leaders: **Working**
2. Parental consent records; consent step at sign-up: **Working**
3. Data requests (access, correction, erasure), including full record export and erasure of a learner's data: **Working**
4. Log of who viewed or shared each learner's record: **Working**
5. PDF compliance reports: **Working**
6. Public `/trust` page: **Working**

## 19. Reports

1. Learner, employee, academic, assessment and attendance reports, each exportable to CSV: **Working**

## 20. Data import (SA-SAMS / CEMIS)

1. Learner CSV import: staged, validated, checked for duplicates, then applied only when confirmed: **Working**
2. Direct link to government SA-SAMS or CEMIS systems: **Not built**

## 21. Marketing website (separate repo `Funda360_website`)

1. "Request a Demo" form with spam protection and email delivery: **Built**
2. A live request arriving in the Auris inbox: **Not yet confirmed**

## Not built yet

1. AI of any kind
2. Payroll and full accounting
3. Native mobile app (the web app works on phones)
4. Direct link to government systems (SA-SAMS / CEMIS)
5. Single sign-on (Google or Microsoft school accounts)

## In short

About 20 modules covering the whole school day (admissions, learners, academics, attendance, homework, report cards, finance, communication, transport, operations, compliance) are built and connected. Online payments and email/SMS delivery are finished but not switched on. AI, payroll and government system links do not exist yet.

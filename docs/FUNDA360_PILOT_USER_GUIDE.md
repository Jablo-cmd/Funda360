# Funda360 — Pilot User Guide

This guide covers everything a member of staff at a pilot school can actually do in Funda360 today. Every feature described here has been verified against the live application — nothing in this guide is planned or upcoming functionality.

---

## Logging in

Go to the Funda360 web address given to you by your school's pilot coordinator. You'll see a sign-in screen asking for:

- **Email address** — the address your account was created with.
- **Password** — given to you securely by your pilot coordinator.
- **Remember me** (optional checkbox) — leave this **unchecked** on a shared or public computer. Checking it keeps you signed in on that browser across visits and across new tabs; leaving it unchecked keeps you signed in only for that one browser tab, for that one session.

If you forget your password, use the **Forgot password?** link on the sign-in screen to request a reset email.

## Dashboard

After signing in, you land on your **Dashboard** — a live summary of your school, not a static page. What you see depends on your role:

- **Executive Summary** — active learners, active employees, number of classes, and today's attendance count (principals and similar roles).
- **My Classes** — appears if you're assigned to teach one or more classes, with a direct link into each one.
- **Attendance Overview** — today's Present / Absent / Late / Excused counts for the school.
- **Recent Assessments** and **Quick Actions** — shortcuts into the areas you're permitted to use.

Every number on the dashboard reflects real data in the system at that moment — nothing is a placeholder.

## Navigation

The sidebar on the left (an icon menu on mobile — tap it to open the same menu) is organised into:

- **Overview** — Dashboard
- **People** — Learners, Employees (Guardians is marked "Soon" — not yet a standalone feature)
- **Academics** — Academic Overview, Academic Years, Terms, Grades, Classes, Subjects, Teaching Assignments, Assessments
- **Operations** — Attendance, My Classes
- **Reporting** — Reports
- **Administration** — Users & Roles, School Profile, My Profile

You'll only see the items your role has access to — greyed-out items with a "Soon" badge aren't available yet anywhere in the product.

## Learners

Under **People → Learners**, staff with permission can view the learner directory: search and filter by status, and open any learner's full profile — enrollment history, guardians, emergency contacts, medical information, documents, and (if you can view assessments) their academic results. Staff with manage permission can add a new learner, edit details, and change a learner's status. Learners are never permanently deleted — a status change (e.g. "Withdrawn") replaces deletion.

## Employees

Under **People → Employees**, staff with permission can view the staff directory, add a new employee, assign them to a department, edit their record, and terminate or reactivate them. From an individual employee's profile, an authorised user can provision that employee a Funda360 login for the first time.

## Academic Overview

Under **Academics → Academic Overview**, you'll see the school's current active academic year and a set of cards linking into Academic Years, Terms, Grades, Classes, Subjects, Teaching Assignments, and Assessments — the building blocks the rest of the system (enrollment, attendance, marks) is built on.

## Attendance

Under **Operations → Attendance**:

1. **Select a class** — you'll only see classes you're actually assigned to teach, unless your role has broader access (e.g. principal).
2. **Select a date** — defaults to today.
3. You'll see every learner enrolled in that class for that date.

### Attendance statuses

Each learner can be marked:

- **Present**
- **Absent**
- **Late**
- **Excused** — for an already-approved absence (e.g. a medical note or authorised leave)

### Saving and editing attendance

Tap or click a status button for each learner, then **Save register**. To correct a mistake — on the same day or any day already recorded — reopen the same class and date, change the status, and save again. This **updates** the existing record; it never creates a duplicate.

## Reports

Under **Reporting → Reports**, you'll see every report your role can access: Learners, Employees, Academic, Assessments, and Attendance. Each opens its own report page with relevant filters.

## Attendance Report

Under **Reporting → Reports → Attendance** (or directly via the sidebar for roles with access):

- Filter by date range and class.
- See Present / Absent / Late totals for the selected period, plus the school's **attendance rate**.
- **Attendance rate is calculated as: (Present + Late) ÷ (Present + Late + Absent) × 100.** Excused days and days nobody marked are not counted either way — they don't help or hurt the rate.
- An alert reads **"N learners have attendance below 80%"** with a **View →** link that filters the learner table down to just those learners.
- Two tables — **Attendance by class** and **Attendance by learner** — each with their own **Export CSV** button.

## CSV export

Any **Export CSV** button downloads a real spreadsheet file of exactly what's on screen (respecting your current filters) — open it in Excel, Google Sheets, or similar.

## My Profile

Under **Administration → My Profile**, you see whichever of the following apply to your account: your employee information, your linked children (if you're a guardian — see [Known Limitations](FUNDA360_KNOWN_LIMITATIONS.md) about guardian accounts), or your teaching classes. There's nothing to edit here directly — it links you into the relevant feature pages.

## Logout

Click your name in the top-right corner, then **Sign out**. This ends your session — attempting to reopen any Funda360 page afterwards returns you to the sign-in screen.

## What to do if something goes wrong

- **An error message appears on screen:** Funda360 shows a plain-language message (e.g. "Failed to save attendance.") rather than a technical error. Try the action again; if it keeps failing, note down exactly what you were doing and report it using the [Bug Report Template](FUNDA360_BUG_REPORT_TEMPLATE.md).
- **A page looks blank or stuck loading:** refresh the page. Your session stays signed in.
- **You're unexpectedly signed out:** sign back in. If this happens repeatedly, report it.
- **Anything else feels wrong or confusing:** use the [Pilot Feedback Form](FUNDA360_PILOT_FEEDBACK_FORM.md) — that's exactly what the pilot is for.

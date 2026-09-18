# Funda360 Privacy & POPIA Engineering Baseline

**Status:** Pilot-hardening baseline  
**Product:** Funda360  
**Operator:** Auris Nexus Technologies (Pty) Ltd  
**Effective date:** 18 September 2026

> This is an engineering baseline, not a substitute for a final POPIA privacy notice, data-processing agreement, information officer process, or legal advice.

## 1. Scope

Funda360 can process personal information relating to learners, parents/guardians, teachers, school employees, applicants and other school users. Because learner information may involve children and other sensitive contexts, production handling must apply appropriate safeguards.

## 2. Minimum principles

Production operation must follow these principles:

1. Process information for defined and legitimate purposes.
2. Collect only information reasonably necessary for those purposes.
3. Keep information accurate and allow appropriate correction.
4. Restrict access according to role and legitimate need.
5. Protect information against unauthorised access, alteration, disclosure or loss.
6. Retain information only for as long as justified by the applicable purpose, agreement or legal requirement.
7. Support appropriate data-subject rights and lawful requests.
8. Maintain evidence of security and operational controls.

## 3. Tenant isolation

Every tenant-scoped record must be protected by database-level RLS where applicable.

Tests must cover:

- same-school permitted access;
- cross-school read denial;
- cross-school update denial;
- cross-school deletion denial;
- tenant reassignment protection;
- role escalation protection;
- platform-level access boundaries.

## 4. Authentication

Production accounts must use secure authentication, verified email flows where configured, strong password requirements, secure password reset and MFA where required by the platform's security policy.

Temporary credentials must not become a permanent production onboarding mechanism.

## 5. Least privilege

Users must only see functions, records and actions required by their role.

The UI must not be treated as the authorization boundary. Server-side/database policies must independently enforce access.

## 6. Sensitive information

The platform must avoid collecting highly sensitive information unless a documented product requirement and lawful processing basis exist.

Sensitive fields must receive appropriate:

- access restrictions;
- audit treatment;
- retention rules;
- export/deletion handling; and
- test coverage.

## 7. Auditability

Security-relevant events should be auditable, including where applicable:

- authentication events;
- privileged role changes;
- school/tenant changes;
- user provisioning;
- account suspension;
- sensitive administrative actions;
- material configuration changes.

## 8. Third-party services

Before production pilot launch, Auris must maintain an inventory of external services that can receive or process Funda360 information, including hosting, authentication, email, analytics, monitoring and support tooling.

The production configuration must be checked against the applicable contractual and POPIA requirements.

## 9. Breach response

A production incident process must define:

- detection;
- containment;
- investigation;
- evidence preservation;
- affected-school communication;
- regulatory/legal escalation where required;
- remediation; and
- post-incident review.

## 10. Data subject requests

The operational process must support lawful requests concerning access, correction, deletion or other applicable rights. Requests must be authenticated and handled according to the applicable legal and contractual process.

## 11. Children's information

Where the platform processes children's personal information, the school and Auris must establish the appropriate lawful basis, notices, permissions and safeguards required by the applicable legal framework.

No feature should assume that ordinary adult-consent patterns automatically apply to learner information.

## 12. Production gate

A Funda360 pilot must not be declared production-ready until:

- tenant isolation tests pass;
- authentication and recovery flows work;
- privileged actions are controlled;
- production email is configured and tested;
- privacy/legal documents are approved;
- backup and recovery procedures are documented;
- external processors are inventoried;
- security incident procedures are documented; and
- a named operational owner is assigned.

---
**Document owner:** Auris Nexus Technologies (Pty) Ltd  
**Review trigger:** material change to data processing, infrastructure, roles or applicable law.

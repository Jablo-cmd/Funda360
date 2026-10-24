# Funda360 Platform Ownership & Data Sovereignty

**Status:** Pilot-hardening baseline  
**Product:** Funda360  
**Platform owner/operator:** Auris Nexus Technologies (Pty) Ltd  
**Effective date:** 18 September 2026

## 1. Purpose

This document establishes the intended ownership and data-control boundaries for Funda360. It is an engineering and governance baseline and does not replace a signed commercial agreement, privacy notice, data-processing agreement, or legal advice.

## 2. Platform ownership

Funda360 is an Auris Nexus Technologies (Pty) Ltd product and technology platform.

Subject to any separately signed agreement, Auris retains ownership of the Funda360 software, source code, architecture, product design, reusable components, documentation, deployment configuration, database schema, migrations, automation logic, and other platform intellectual property created for the platform.

A school pilot does not by itself transfer ownership of the Funda360 platform or its underlying intellectual property.

## 3. School data

School-provided and school-generated information remains associated with the school and its lawful data-control responsibilities. Funda360 must not treat school data as Auris-owned product intellectual property merely because it is stored or processed by the platform.

The platform must maintain tenant isolation so that one school's records are not exposed to another school through normal application access or direct database/API access permitted to authenticated users.

## 4. Processing role

For each deployment, the parties must document their respective POPIA roles and responsibilities. The application architecture must support the principle that the school determines the purposes for which its learner, guardian, staff and operational information is used, while Auris provides and operates the software and associated processing services under the applicable agreement.

This document intentionally does not declare a legally binding controller/operator classification without reviewing the final commercial and processing arrangements.

## 5. Data access

Access to school data must be based on authenticated identity, role, tenant membership and explicit permissions.

Platform-level administrative access is privileged and must be limited to legitimate operational, security, support or maintenance purposes. Such access must be auditable where technically supported.

## 6. Tenant isolation

Tenant isolation is enforced at the database layer through PostgreSQL Row Level Security (RLS), including forced RLS on tenant-scoped tables where configured.

Application-level route guards and permission checks are complementary controls; they are not the sole security boundary.

## 7. Data portability and exit

A future production agreement must define:

- what data can be exported;
- export format;
- reasonable export assistance;
- retention period after termination;
- deletion or anonymisation requirements;
- legally required retention exceptions; and
- treatment of backups.

No automatic deletion of a school's data should occur solely because a pilot ends unless the applicable agreement and lawful retention requirements permit it.

## 8. Infrastructure and residency

Funda360 currently relies on third-party infrastructure, including Supabase-hosted services and GitHub-hosted source/deployment infrastructure. Infrastructure location, subprocessors and cross-border transfer implications must be verified against the actual production configuration before a school processes real personal information.

The platform must not describe data as "South Africa-hosted" or "data-sovereign" unless the actual production infrastructure has been verified to support that claim.

## 9. Change control

Material changes to authentication, authorization, tenant isolation, data storage, personal-information processing or external integrations require security review and regression testing before production release.

## 10. Governing principle

Funda360 separates **platform ownership** from **customer data control**:

> Auris owns and operates the Funda360 technology platform; the school retains its rights and responsibilities in relation to the information it provides or controls, subject to the final contractual and legal framework.

---
**Document owner:** Auris Nexus Technologies (Pty) Ltd  
**Review trigger:** material architecture, legal, infrastructure or contractual change.

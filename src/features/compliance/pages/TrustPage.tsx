import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '@/components/ui/Logo';
import { ComplianceBadge, type ComplianceIconKey } from '@/components/ui/complianceIcons';

interface Pillar {
  icon: ComplianceIconKey;
  title: string;
  subtitle: string;
  points: string[];
}

const FRAMEWORKS: Pillar[] = [
  {
    icon: 'popia',
    title: 'POPIA Trust',
    subtitle: 'South Africa — our legal baseline, always on',
    points: [
      'A registered Information Officer per school, shown to every family',
      'Data-subject requests tracked against statutory deadlines',
      'Guardian consent for every minor, recorded and provable',
    ],
  },
  {
    icon: 'ferpa',
    title: 'FERPA Shield',
    subtitle: 'Family rights over education records',
    points: [
      'Parents view and download the complete record at any time',
      'Correction requests with written reasons, hearings and statements of disagreement',
      'A record of every disclosure, visible to the family',
    ],
  },
  {
    icon: 'gdpr',
    title: 'GDPR Lock',
    subtitle: 'Ready for EU schools and EU families',
    points: [
      'Explicit, attested consent with no pre-ticked boxes',
      'Right to be forgotten, protected by multi-factor authentication',
      'One-click data portability in JSON, CSV and PDF',
    ],
  },
  {
    icon: 'coppa',
    title: 'COPPA Consent',
    subtitle: 'Children under 13 are protected by default',
    points: [
      'No online account for a child without verifiable parental consent',
      'Consent is part of parent onboarding — decided before anything else',
      'Withdrawing consent closes the child’s access immediately',
    ],
  },
  {
    icon: 'cipa',
    title: 'CIPA Safe Content',
    subtitle: 'Safe messaging, homework and uploads',
    points: [
      'Harmful content is blocked before it is saved',
      'Self-harm and violence signals alert school leadership at once',
      'Executable and script files are refused on every upload',
    ],
  },
];

const SAFEGUARDS: Pillar[] = [
  {
    icon: 'encryption',
    title: 'Encryption',
    subtitle: 'TLS in transit · AES-256 at rest',
    points: [
      'Every connection uses HTTPS; databases, backups and files are encrypted at rest by our hosting provider.',
    ],
  },
  {
    icon: 'rbac',
    title: 'Role-Based Access',
    subtitle: 'Enforced in the database',
    points: [
      'Parents, teachers and administrators have separate permissions, enforced by row-level security on every table — not just in the app.',
    ],
  },
  {
    icon: 'audit',
    title: 'Audit Logs',
    subtitle: 'Every change and every access',
    points: [
      'Changes to student data and every view, export and disclosure of a record are logged, append-only, and visible to school leadership.',
    ],
  },
  {
    icon: 'consent',
    title: 'Consent Workflow',
    subtitle: 'Clear, explicit, reversible',
    points: [
      'Each purpose explains what refusing means; consent needs a typed signature and can be withdrawn at any time.',
    ],
  },
  {
    icon: 'portability',
    title: 'Data Portability',
    subtitle: 'One click, three formats',
    points: [
      'Families and schools export a full learner record as JSON, CSV or PDF, and every export is logged.',
    ],
  },
];

/**
 * Public trust page — the "POPIA + FERPA + GDPR ready" positioning. Every
 * statement here describes a control that exists in the product (see
 * supabase/migrations/20260930100000_compliance_framework.sql); nothing is
 * a certification claim, and the page says so.
 */
export function TrustPage() {
  useEffect(() => {
    const previous = document.title;
    document.title = 'Trust & Compliance · Funda360';
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const created = !meta;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'description';
      document.head.appendChild(meta);
    }
    const previousDescription = meta.content;
    meta.content =
      'Funda360 is POPIA, FERPA and GDPR ready: parental consent, audit logs, encryption, role-based access and one-click data portability for schools.';
    return () => {
      document.title = previous;
      if (created) meta?.remove();
      else if (meta) meta.content = previousDescription;
    };
  }, []);

  // This public page is designed white-on-white. A visitor who saved the dark theme would otherwise get light dark-mode text on a hard-coded white background, so render it in light mode while it is open and restore their theme on the way out (the stored preference is not touched).
  useEffect(() => {
    const root = document.documentElement;
    const wasDark = root.classList.contains('dark');
    root.classList.remove('dark');
    return () => {
      if (wasDark) root.classList.add('dark');
    };
  }, []);

  return (
    <div className="min-h-dvh bg-white text-slate-900">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/trust" aria-label="Funda360 trust and compliance">
            <Logo />
          </Link>
          <Link
            to="/login"
            className="focus-ring rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main>
        <section className="border-b-4 border-accent-500 bg-white">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <p className="text-sm font-semibold uppercase tracking-widest text-accent-700">
              Trust & compliance
            </p>
            <h1 className="mt-3 max-w-3xl text-4xl font-extrabold leading-tight text-brand-700 sm:text-5xl">
              POPIA + FERPA + GDPR ready.
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-slate-600">
              Funda360 protects learner data the way regulators expect: in the database, where it
              cannot be bypassed. Consent, access control, audit and data rights are enforced by the
              platform itself — and every school can prove it with a live compliance report.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {(['popia', 'ferpa', 'gdpr', 'coppa', 'cipa'] as const).map((icon) => (
                <ComplianceBadge key={icon} icon={icon} size="lg" />
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-2xl font-bold text-brand-700">Five frameworks, one platform</h2>
          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {FRAMEWORKS.map((p) => (
              <PillarCard key={p.title} pillar={p} />
            ))}
          </div>
        </section>

        <section className="bg-slate-50">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <h2 className="text-2xl font-bold text-brand-700">Technical safeguards</h2>
            <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {SAFEGUARDS.map((p) => (
                <PillarCard key={p.title} pillar={p} />
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <h2 className="text-2xl font-bold text-brand-700">For schools: a Trust Center</h2>
              <p className="mt-3 text-slate-600">
                Leadership sees live data-protection status next to learner progress: open requests
                and their deadlines, consent coverage, flagged content, and complete audit and
                access logs. One click produces a white-label compliance report in the school's own
                name to present to the Information Regulator, auditors or the governing body.
              </p>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-brand-700">For families: Privacy & Records</h2>
              <p className="mt-3 text-slate-600">
                Parents decide every consent explicitly, download their child's full record, see who
                accessed it and every time it was shared, request corrections, and request deletion
                — all from their own portal.
              </p>
            </div>
          </div>
          <p className="mt-10 border-t border-slate-200 pt-6 text-xs text-slate-500">
            “Ready” means the controls these frameworks require are built into Funda360 and measured
            live for each school. It is not a certification by a regulator or auditor, and each
            school remains the responsible party for its own processing. Encryption at rest is
            provided by our hosting infrastructure.
          </p>
        </section>
      </main>
    </div>
  );
}

function PillarCard({ pillar }: { pillar: Pillar }) {
  return (
    <article className="rounded-card border border-slate-200 bg-white p-6 shadow-card">
      <ComplianceBadge icon={pillar.icon} size="lg" />
      <h3 className="mt-4 text-lg font-bold text-slate-900">{pillar.title}</h3>
      <p className="text-sm font-medium text-accent-700">{pillar.subtitle}</p>
      <ul className="mt-3 space-y-2 text-sm text-slate-600">
        {pillar.points.map((point) => (
          <li key={point} className="flex gap-2">
            <span
              aria-hidden="true"
              className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-500"
            />
            {point}
          </li>
        ))}
      </ul>
    </article>
  );
}

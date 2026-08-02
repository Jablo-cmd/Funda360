import type { ReactNode } from 'react';
import { Logo } from '@/components/ui/Logo';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { CheckIcon } from '@/components/ui/icons';

const HIGHLIGHTS = [
  'Multi-tenant architecture built for groups of schools',
  'Real-time academic, attendance and finance insights',
  'Secure, role-based access for every stakeholder',
];

export interface AuthLayoutProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}

/** Shared split-panel chrome for every unauthenticated auth screen (login, forgot/reset password, verify email). */
export function AuthLayout({ eyebrow = 'Enterprise sign in', title, subtitle, children }: AuthLayoutProps) {
  const year = new Date().getFullYear();

  return (
    <div className="min-h-dvh bg-surface-sunken lg:grid lg:grid-cols-2">
      <section
        aria-hidden="true"
        className="relative hidden overflow-hidden bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900 lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16"
      >
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-brand-400/10 blur-3xl" />

        <Logo variant="inverse" className="relative" />

        <div className="relative max-w-md">
          <h1 className="text-3xl font-bold leading-tight text-white xl:text-4xl">
            One platform for your entire school, end to end.
          </h1>
          <p className="mt-4 text-base text-brand-100">
            Funda360 brings admissions, academics, finance and operations together in a single,
            secure, cloud-native workspace built for schools across Africa.
          </p>

          <ul className="mt-8 flex flex-col gap-3">
            {HIGHLIGHTS.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-brand-50">
                <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-200" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-brand-200">
          © {year} Auris Nexus Technologies. All rights reserved.
        </p>
      </section>

      <section className="flex min-h-dvh flex-col justify-center px-4 py-10 sm:px-6 lg:px-12 xl:px-20">
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
          <div className="mb-8 flex items-center justify-between lg:mb-10">
            <Logo className="lg:hidden" />
            <span className="hidden text-sm font-medium text-content-tertiary lg:block">{eyebrow}</span>
            <ThemeToggle />
          </div>

          <div className="rounded-card border border-border bg-surface-raised p-6 shadow-card sm:p-8 dark:shadow-card-dark">
            <header className="mb-6">
              <h2 className="text-xl font-bold text-content-primary sm:text-2xl">{title}</h2>
              {subtitle && <p className="mt-1.5 text-sm text-content-secondary">{subtitle}</p>}
            </header>

            {children}
          </div>

          <p className="mt-6 text-center text-xs text-content-tertiary lg:hidden">
            © {year} Auris Nexus Technologies. All rights reserved.
          </p>
        </div>
      </section>
    </div>
  );
}

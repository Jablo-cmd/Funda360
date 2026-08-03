import { Link } from 'react-router-dom';
import { FullScreenSpinner } from '@/components/ui/FullScreenSpinner';
import { CalendarIcon, ChalkboardIcon, GraduationCapIcon, LayersIcon, BookIcon } from '@/components/ui/icons';
import { useAcademic } from '@/features/academic/hooks/useAcademic';
import type { ComponentType, SVGProps } from 'react';

interface AcademicLink {
  label: string;
  description: string;
  path: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const LINKS: AcademicLink[] = [
  { label: 'Academic Years', description: 'Create and activate academic years.', path: '/academic/years', icon: CalendarIcon },
  { label: 'Terms', description: 'Manage terms within an academic year.', path: '/academic/terms', icon: LayersIcon },
  { label: 'Grades', description: 'Manage the grade catalogue.', path: '/academic/grades', icon: GraduationCapIcon },
  { label: 'Classes', description: 'Manage class sections and capacity.', path: '/academic/classes', icon: ChalkboardIcon },
  { label: 'Subjects', description: 'Manage the subject catalogue.', path: '/academic/subjects', icon: BookIcon },
];

export function AcademicOverviewPage() {
  const { currentAcademicYear, loading } = useAcademic();

  if (loading) {
    return <FullScreenSpinner label="Loading academic structure…" />;
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-bold text-content-primary">Academic Structure</h1>
        <p className="mt-1 text-sm text-content-secondary">
          Define your school&apos;s academic years, terms, grades, classes and subjects.
        </p>
      </div>

      <section className="rounded-card border border-border bg-surface-raised p-5 shadow-card sm:p-6 dark:shadow-card-dark">
        <h2 className="text-base font-semibold text-content-primary">Current academic year</h2>
        {currentAcademicYear ? (
          <p className="mt-2 text-sm text-content-secondary">
            <span className="font-medium text-content-primary">{currentAcademicYear.name}</span> — {currentAcademicYear.startDate} to {currentAcademicYear.endDate}
          </p>
        ) : (
          <p className="mt-2 text-sm text-content-tertiary">
            No academic year is active yet.{' '}
            <Link to="/academic/years" className="focus-ring rounded font-medium text-brand-600 hover:underline">
              Set one up
            </Link>
            .
          </p>
        )}
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {LINKS.map(({ label, description, path, icon: Icon }) => (
          <Link
            key={path}
            to={path}
            className="focus-ring flex items-start gap-3 rounded-card border border-border bg-surface-raised p-4 shadow-card transition-colors hover:border-brand-500/40 dark:shadow-card-dark"
          >
            <Icon className="h-6 w-6 shrink-0 text-brand-600" />
            <div>
              <p className="font-medium text-content-primary">{label}</p>
              <p className="mt-0.5 text-sm text-content-tertiary">{description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

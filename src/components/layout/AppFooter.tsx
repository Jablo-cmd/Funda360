export interface AppFooterProps {
  /** Layout shells render two copies: a persistent bar from `md` up, and one at the end of the scroll area on phones so it never takes screen height while reading. */
  className?: string;
}

export function AppFooter({ className }: AppFooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer
      className={`flex min-h-9 shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-0.5 border-t border-border bg-surface-raised px-4 py-2 text-xs text-content-secondary sm:px-6 md:py-0 ${className ?? ''}`}
    >
      <span>FUNDA360 · Education Management System</span>
      <span>
        © {year}{' '}
        <a
          href="https://aurisnexus.co.za"
          target="_blank"
          rel="noopener noreferrer"
          className="focus-ring rounded underline underline-offset-2 hover:text-brand-600 dark:hover:text-brand-300"
        >
          Auris Nexus
        </a>{' '}
        Technologies
      </span>
    </footer>
  );
}

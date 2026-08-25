export function AppFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="flex h-9 shrink-0 items-center justify-between gap-4 border-t border-border bg-surface-raised px-4 text-xs text-content-secondary sm:px-6">
      <span className="truncate">FUNDA360 · Education Management System</span>
      <span className="shrink-0 truncate">
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

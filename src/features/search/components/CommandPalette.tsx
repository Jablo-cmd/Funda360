import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { useSchool } from '@/features/school/hooks/useSchool';
import { globalSearchService } from '@/features/search/services/globalSearchService';
import type { GlobalSearchResult } from '@/features/search/services/globalSearchService';
import { SearchIcon, GraduationCapIcon, BriefcaseIcon, UsersIcon } from '@/components/ui/icons';

const TYPE_ICONS = { learner: GraduationCapIcon, employee: BriefcaseIcon, guardian: UsersIcon };
const TYPE_LABELS = { learner: 'Learner', employee: 'Employee', guardian: 'Guardian' };
const DEBOUNCE_MS = 250;

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Global Cmd/Ctrl+K search across learners/employees/guardians
 * (FND-ARCH-005) — a "jump to a specific record" tool, not a search
 * results page (see globalSearchService's own 5-per-domain cap comment).
 * Mounted once at the app shell root (DashboardLayout), which also owns
 * the Cmd/Ctrl+K shortcut and the header's visible search-button trigger —
 * this component itself is fully controlled (isOpen/onClose), so both
 * ways of opening it stay in sync with one source of truth.
 */
export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const { school } = useSchool();
  const listboxId = useId();

  const [term, setTerm] = useState('');
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = () => {
    onClose();
    setTerm('');
    setResults([]);
    setActiveIndex(0);
  };

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !school) return;
    if (term.trim().length === 0) {
      setResults([]);
      return;
    }
    setIsLoading(true);
    const timeoutId = setTimeout(() => {
      void globalSearchService
        .search(school.id, term, {
          learners: can('learner.view'),
          employees: can('employee.view'),
          guardians: can('guardian.view'),
        })
        .then((found) => {
          setResults(found);
          setActiveIndex(0);
        })
        .finally(() => setIsLoading(false));
    }, DEBOUNCE_MS);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, isOpen, school]);

  const navigateToResult = (result: GlobalSearchResult) => {
    close();
    navigate(result.path);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      close();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const selected = results[activeIndex];
      if (selected) navigateToResult(selected);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh]">
      <div className="absolute inset-0 bg-black/40" onClick={close} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="relative flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-card border border-border bg-surface-raised shadow-card dark:shadow-card-dark"
      >
        <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
          <SearchIcon className="h-4 w-4 shrink-0 text-content-tertiary" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls={listboxId}
            aria-activedescendant={results[activeIndex] ? `${listboxId}-${activeIndex}` : undefined}
            autoComplete="off"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search learners, employees, guardians…"
            aria-label="Search learners, employees, guardians"
            className="h-8 flex-1 bg-transparent text-sm text-content-primary placeholder:text-content-tertiary focus:outline-none"
          />
          <kbd className="hidden shrink-0 rounded border border-border-strong px-1.5 py-0.5 text-[10px] font-medium text-content-tertiary sm:inline">
            Esc
          </kbd>
        </div>

        <div className="overflow-y-auto">
          {isLoading ? (
            <p className="px-4 py-6 text-center text-sm text-content-tertiary">Searching…</p>
          ) : term.trim().length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-content-tertiary">
              Type to search learners, employees, and guardians.
            </p>
          ) : results.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-content-tertiary">No results for "{term}".</p>
          ) : (
            <ul id={listboxId} role="listbox" aria-label="Search results" className="flex flex-col gap-0.5 p-2">
              {results.map((result, index) => {
                const Icon = TYPE_ICONS[result.type];
                return (
                  <li key={`${result.type}-${result.id}`} role="presentation">
                    <button
                      id={`${listboxId}-${index}`}
                      role="option"
                      aria-selected={index === activeIndex}
                      type="button"
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => navigateToResult(result)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left ${
                        index === activeIndex ? 'bg-brand-50 dark:bg-brand-500/10' : ''
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-content-tertiary" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-content-primary">{result.label}</span>
                        <span className="block truncate text-xs text-content-tertiary">{result.sublabel}</span>
                      </span>
                      <span className="shrink-0 rounded-full bg-surface-sunken px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-content-tertiary">
                        {TYPE_LABELS[result.type]}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

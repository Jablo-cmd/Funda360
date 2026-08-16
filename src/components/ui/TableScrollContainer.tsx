import { useEffect, useRef, useState, type ReactNode } from 'react';

export interface TableScrollContainerProps {
  children: ReactNode;
}

/**
 * Wraps a horizontally-scrollable table (the `overflow-x-auto rounded-card
 * border ...` shell every *Table component uses) with edge-fade shadows
 * that appear only when there's more content to scroll to. Without this, a
 * table wider than the viewport — the normal case on mobile — clips
 * silently: columns vanish off-screen with no visual hint that swiping the
 * table (not the page — the page itself never scrolls horizontally, per
 * the design system) reveals them.
 */
export function TableScrollContainer({ children }: TableScrollContainerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const update = () => {
      setCanScrollLeft(el.scrollLeft > 1);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    };

    update();
    el.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);

    return () => {
      el.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, [children]);

  return (
    <div className="relative">
      <div ref={scrollRef} className="overflow-x-auto rounded-card border border-border bg-surface-raised">
        {children}
      </div>
      {canScrollLeft && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 w-8 rounded-l-card bg-gradient-to-r from-surface-raised to-transparent"
        />
      )}
      {canScrollRight && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-8 rounded-r-card bg-gradient-to-l from-surface-raised to-transparent"
        />
      )}
    </div>
  );
}

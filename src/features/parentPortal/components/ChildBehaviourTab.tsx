/**
 * Deliberately does not query behaviour_incidents. That table has no
 * column or flag distinguishing guardian-appropriate information from
 * internal staff-only notes (action_taken, outcome are free-text staff
 * commentary) — see the parent_portal_v1 migration header. Exposing raw
 * incident rows to guardians would leak internal staff notes; exposing
 * nothing looks like "nothing happened," which is also wrong. This
 * explicit placeholder is the honest middle ground until a real
 * visibility model (e.g. a guardian_visible flag) exists.
 */
export function ChildBehaviourTab() {
  return (
    <div className="rounded-card border border-border bg-surface-raised px-4 py-10 text-center text-sm text-content-tertiary">
      Behaviour information isn't available in the parent portal yet. Your school can share behaviour updates with
      you directly in the meantime.
    </div>
  );
}

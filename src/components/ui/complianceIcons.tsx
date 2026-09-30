import { useId, type ComponentType, type SVGProps } from 'react';

/**
 * The compliance visual layer. Same 24px grid and 1.75 stroke as
 * components/ui/icons.tsx, but two-tone: the primary shape follows
 * `currentColor` (navy in the default palette) and one accent element uses
 * the orange accent token, so every compliance surface is recognisable at a
 * glance. The POPIA mark carries the South African flag colours instead.
 */

type IconProps = SVGProps<SVGSVGElement>;

const ACCENT = 'rgb(var(--accent-500))';

function Frame({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

const SHIELD = 'M12 2.75 4.5 5.5v5.75c0 4.6 3.1 8.6 7.5 10 4.4-1.4 7.5-5.4 7.5-10V5.5L12 2.75Z';

/** FERPA Shield — graduation cap on a shield. */
export function FerpaShieldIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <path d={SHIELD} />
      <path d="m7.5 10.25 4.5-2 4.5 2-4.5 2-4.5-2Z" stroke={ACCENT} />
      <path d="M9.25 11.1v2.4c0 .8 1.25 1.5 2.75 1.5s2.75-.7 2.75-1.5v-2.4" stroke={ACCENT} />
    </Frame>
  );
}

/** COPPA Consent — parent and child silhouettes with a checkmark. */
export function CoppaConsentIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <circle cx="7.5" cy="6" r="2.25" />
      <path d="M3.5 19v-3.5a4 4 0 0 1 8 0V19" />
      <circle cx="14" cy="10" r="1.75" />
      <path d="M11.5 19v-2.25a2.5 2.5 0 0 1 5 0V19" />
      <path d="m16.5 5.5 1.75 1.75 3.25-3.5" stroke={ACCENT} />
    </Frame>
  );
}

/** CIPA Safe Content — a shield guarding a filtered globe. */
export function CipaSafeContentIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <path d={SHIELD} />
      <circle cx="12" cy="11.5" r="4" stroke={ACCENT} />
      <path
        d="M8 11.5h8M12 7.5c1.2 1.1 1.8 2.5 1.8 4s-.6 2.9-1.8 4c-1.2-1.1-1.8-2.5-1.8-4s.6-2.9 1.8-4Z"
        stroke={ACCENT}
      />
      <path d="m9 8.5 6 6" />
    </Frame>
  );
}

/** GDPR Lock — padlock ringed by the EU stars. */
export function GdprLockIcon(props: IconProps) {
  const stars = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    return { cx: 12 + Math.cos(a) * 9.25, cy: 12 + Math.sin(a) * 9.25 };
  });
  return (
    <Frame {...props}>
      {stars.map((s, i) => (
        <circle key={i} cx={s.cx} cy={s.cy} r={0.7} fill={ACCENT} stroke="none" />
      ))}
      <rect x="8" y="11" width="8" height="6.5" rx="1.25" />
      <path d="M9.75 11V9.25a2.25 2.25 0 0 1 4.5 0V11" />
    </Frame>
  );
}

/** POPIA Trust — shield in the colours of the South African flag. */
export function PopiaTrustIcon(props: IconProps) {
  const clipId = `popia-${useId().replace(/:/g, '')}`;
  return (
    <Frame {...props}>
      <defs>
        <clipPath id={clipId}>
          <path d={SHIELD} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`} stroke="none">
        <rect x="0" y="0" width="24" height="9" fill="#E03C31" />
        <rect x="0" y="15" width="24" height="9" fill="#001489" />
        <path d="M0 0 11 12 0 24Z" fill="#007749" />
        <rect x="0" y="10" width="24" height="4" fill="#007749" />
        <path d="M0 4 7.5 12 0 20Z" fill="#FFB81C" />
        <path d="M0 6.5 5 12l-5 5.5Z" fill="#000000" />
      </g>
      <path d={SHIELD} />
    </Frame>
  );
}

/** Audit Logs — magnifying glass over a document. */
export function AuditLogIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M14 3H6.75A1.75 1.75 0 0 0 5 4.75v14.5A1.75 1.75 0 0 0 6.75 21H11" />
      <path d="M14 3v4h4M14 3l4 4v3" />
      <path d="M8 10h4M8 13h2.5" />
      <circle cx="15.5" cy="15.5" r="3" stroke={ACCENT} />
      <path d="m17.75 17.75 2.75 2.75" stroke={ACCENT} />
    </Frame>
  );
}

/** Encryption — padlock over binary code. */
export function EncryptionIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <rect x="6" y="10.5" width="12" height="9" rx="1.5" />
      <path d="M8.5 10.5V7.75a3.5 3.5 0 0 1 7 0v2.75" />
      <g stroke={ACCENT} strokeWidth={1.4}>
        <path d="M9 13.25v3.5" />
        <rect x="11" y="13.25" width="2" height="3.5" rx="1" />
        <path d="M15 13.25v3.5" />
      </g>
    </Frame>
  );
}

/** Role-Based Access — user silhouettes with a lock. */
export function RoleAccessIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <circle cx="8" cy="7" r="2.5" />
      <path d="M3.5 19v-2a4.5 4.5 0 0 1 9 0v2" />
      <circle cx="15.5" cy="6.5" r="2" />
      <path d="M14.5 11.1a3.8 3.8 0 0 1 4.5 1.4" />
      <rect x="15" y="15" width="6" height="5" rx="1" stroke={ACCENT} />
      <path d="M16.25 15v-1.25a1.75 1.75 0 0 1 3.5 0V15" stroke={ACCENT} />
    </Frame>
  );
}

/** Consent Workflow — an open hand with a checkmark. */
export function ConsentWorkflowIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M4 14.5v4.25A2.25 2.25 0 0 0 6.25 21h7.1a3 3 0 0 0 2.4-1.2l4.1-5.45a1.4 1.4 0 0 0-2.1-1.85L15 15.25" />
      <path d="M4 14.5h7.25a1.75 1.75 0 0 1 0 3.5H8.5" />
      <path d="m9.5 7 2 2 4-4.5" stroke={ACCENT} />
    </Frame>
  );
}

/** Data Portability — cloud with an outward arrow. */
export function DataPortabilityIcon(props: IconProps) {
  return (
    <Frame {...props}>
      <path d="M7.5 18.5H6.75a4.25 4.25 0 0 1-.6-8.46A5.75 5.75 0 0 1 17.3 8.6a4 4 0 0 1-.55 7.9" />
      <path d="M12 21v-8.5" stroke={ACCENT} />
      <path d="m8.75 15.5 3.25-3.25 3.25 3.25" stroke={ACCENT} />
    </Frame>
  );
}

export type ComplianceIconKey =
  | 'ferpa'
  | 'coppa'
  | 'cipa'
  | 'gdpr'
  | 'popia'
  | 'audit'
  | 'encryption'
  | 'rbac'
  | 'consent'
  | 'portability';

const COMPLIANCE_ICONS: Record<ComplianceIconKey, ComponentType<IconProps>> = {
  ferpa: FerpaShieldIcon,
  coppa: CoppaConsentIcon,
  cipa: CipaSafeContentIcon,
  gdpr: GdprLockIcon,
  popia: PopiaTrustIcon,
  audit: AuditLogIcon,
  encryption: EncryptionIcon,
  rbac: RoleAccessIcon,
  consent: ConsentWorkflowIcon,
  portability: DataPortabilityIcon,
};

/** Renders the compliance icon for `icon` — lets callers pick an icon by key without importing each component. */
export function ComplianceIcon({ icon, ...props }: IconProps & { icon: ComplianceIconKey }) {
  const Icon = COMPLIANCE_ICONS[icon];
  return <Icon {...props} />;
}

export interface ComplianceBadgeProps {
  icon: ComplianceIconKey;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const BADGE_SIZES = {
  sm: 'h-8 w-8 [&>svg]:h-5 [&>svg]:w-5',
  md: 'h-11 w-11 [&>svg]:h-6 [&>svg]:w-6',
  lg: 'h-14 w-14 [&>svg]:h-8 [&>svg]:w-8',
};

/** The icon on a white tile with a navy glyph and an orange accent rule — the compliance layer's signature mark. */
export function ComplianceBadge({ icon, size = 'md', className }: ComplianceBadgeProps) {
  const Icon = COMPLIANCE_ICONS[icon];
  return (
    <span
      className={[
        'inline-flex shrink-0 items-center justify-center rounded-card border border-b-2 border-brand-100 border-b-accent-500 bg-white text-brand-600 dark:border-brand-800 dark:bg-surface-raised dark:text-brand-300',
        BADGE_SIZES[size],
        className ?? '',
      ].join(' ')}
    >
      <Icon />
    </span>
  );
}

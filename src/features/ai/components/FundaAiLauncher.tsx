import { useState } from 'react';
import { SparkleIcon } from '@/components/ui/icons';
import { FundaAiPanel } from '@/features/ai/components/FundaAiPanel';
import { useAiFeatures } from '@/features/ai/hooks/useAiFeatures';

/** Header button for Funda AI. Renders nothing unless a feature is switched on for this user and school. */
export function FundaAiLauncher() {
  const features = useAiFeatures();
  const [open, setOpen] = useState(false);
  const feature = features.find((f) => f.key === 'copilot') ?? features[0];
  if (!feature) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open Funda AI"
        className="focus-ring flex h-11 w-11 shrink-0 items-center justify-center gap-2 rounded-md text-content-secondary transition-colors hover:bg-surface-sunken hover:text-content-primary lg:h-9 lg:w-auto lg:border lg:border-border-strong lg:px-3 lg:text-xs lg:font-medium"
      >
        <SparkleIcon className="h-5 w-5 lg:h-3.5 lg:w-3.5" />
        <span className="hidden lg:inline">Funda AI</span>
      </button>
      <FundaAiPanel feature={feature} isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}

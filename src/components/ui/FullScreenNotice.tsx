import type { ReactNode } from 'react';

export interface FullScreenNoticeProps {
  title: string;
  message: string;
  action?: ReactNode;
}

export function FullScreenNotice({ title, message, action }: FullScreenNoticeProps) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-surface-sunken px-6 text-center">
      <h1 className="text-lg font-bold text-content-primary">{title}</h1>
      <p role="alert" className="max-w-sm text-sm text-content-secondary">
        {message}
      </p>
      {action}
    </div>
  );
}

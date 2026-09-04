import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LoadingBlock } from '@/components/ui/LoadingBlock';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { Button } from '@/components/ui/Button';
import { useLearnerReportCards } from '@/features/reportCards/hooks/useLearnerReportCards';
import { reportCardService } from '@/features/reportCards/services/reportCardService';
import { ReportCardStatusBadge } from '@/features/reportCards/components/ReportCardStatusBadge';
import {
  generateReportCardDocument,
  FULL_DISPLAY_CONFIG,
} from '@/features/reportCards/utils/generateReportCardDocument';
import { getDbErrorMessage } from '@/lib/dbErrors';

export interface LearnerReportCardsSectionProps {
  learnerId: string;
  /** Staff view links each card to the workflow page; the family view only ever shows published cards (RLS) with a PDF download. */
  variant: 'staff' | 'family';
  schoolName: string;
  schoolAddress?: string | null;
  gradeName?: string;
  className?: string;
}

function fmtDate(value: string): string {
  return new Date(value).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function LearnerReportCardsSection({
  learnerId,
  variant,
  schoolName,
  schoolAddress,
  gradeName,
  className,
}: LearnerReportCardsSectionProps) {
  const { cards, isLoading, error } = useLearnerReportCards(learnerId);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const download = async (cardId: string, learnerNumber: string, version: number) => {
    setBusyId(cardId);
    setPdfError(null);
    try {
      const full = await reportCardService.getCard(cardId);
      if (!full) throw new Error('Report card not available.');
      const doc = await generateReportCardDocument(full, {
        schoolName,
        schoolAddress,
        gradeName,
        className,
        template: FULL_DISPLAY_CONFIG,
      });
      doc.save(`${learnerNumber}-report-card-v${version}.pdf`);
    } catch (err) {
      setPdfError(getDbErrorMessage(err, 'Failed to build the PDF.'));
    } finally {
      setBusyId(null);
    }
  };

  if (isLoading) return <LoadingBlock label="Loading report cards…" />;

  return (
    <div className="flex flex-col gap-3">
      <ErrorAlert message={error ?? pdfError} />
      {cards.length === 0 ? (
        <p className="rounded-card border border-border bg-surface-raised px-4 py-8 text-center text-sm text-content-tertiary">
          {variant === 'family' ? 'No published report cards yet.' : 'No report cards for this learner yet.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {cards.map((card) => (
            <li
              key={card.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-border bg-surface-raised px-4 py-3"
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium text-content-primary">
                  {card.learnerName} — v{card.version}
                  {card.overallAveragePercentage !== null && (
                    <span className="ml-2 text-content-secondary">
                      {card.overallAveragePercentage}%{card.overallAchievementCode ? ` (${card.overallAchievementCode})` : ''}
                    </span>
                  )}
                </span>
                <span className="text-xs text-content-tertiary">
                  Generated {fmtDate(card.generatedAt)}
                  {card.publishedAt ? ` · published ${fmtDate(card.publishedAt)}` : ''}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <ReportCardStatusBadge status={card.status} />
                {variant === 'staff' ? (
                  <Link
                    to={`/report-cards/${card.id}`}
                    className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
                  >
                    Open
                  </Link>
                ) : (
                  card.status === 'published' && (
                    <Button
                      variant="secondary"
                      isLoading={busyId === card.id}
                      onClick={() => download(card.id, card.learnerNumber, card.version)}
                    >
                      Download PDF
                    </Button>
                  )
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

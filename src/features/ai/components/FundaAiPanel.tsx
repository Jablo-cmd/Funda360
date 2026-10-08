import { useRef, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { AiAnswerCard } from '@/features/ai/components/AiAnswerCard';
import { aiService, AiRequestError } from '@/features/ai/services/aiService';
import { buildHistory, GENERIC_AI_ERROR } from '@/features/ai/utils/aiResponse';
import type { AiFeature, AiResult } from '@/features/ai/types/ai.types';

const SUGGESTIONS = [
  'Summarise attendance for a learner this term',
  'How is a learner doing across subjects?',
  'Which indicators need attention at our school?',
];

interface Turn {
  question: string;
  result: AiResult | null;
  error: string | null;
}

export interface FundaAiPanelProps {
  feature: AiFeature;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * The Funda AI conversation. Kept in memory only: closing the page clears
 * it, and only the last three question/answer texts are sent with a new
 * question (data minimisation; no evidence or data is sent back).
 */
export function FundaAiPanel({ feature, isOpen, onClose }: FundaAiPanelProps) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState('');
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  async function ask(text: string) {
    const message = text.trim();
    if (!message || pending) return;
    setPending(true);
    setQuestion('');
    const history = buildHistory(turns);
    setTurns((t) => [...t, { question: message, result: null, error: null }]);
    let result: AiResult | null = null;
    let error: string | null = null;
    try {
      result = await aiService.ask({
        feature: feature.key,
        message,
        history,
        clientRequestId: crypto.randomUUID(),
      });
    } catch (e) {
      error = e instanceof AiRequestError ? e.message : GENERIC_AI_ERROR;
    }
    setTurns((t) => t.map((turn, i) => (i === t.length - 1 ? { ...turn, result, error } : turn)));
    setPending(false);
    inputRef.current?.focus();
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Funda AI"
      footer={
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            void ask(question);
          }}
        >
          <label
            htmlFor="funda-ai-question"
            className="block text-sm font-medium text-content-primary"
          >
            Ask Funda AI
          </label>
          <textarea
            id="funda-ai-question"
            ref={inputRef}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void ask(question);
              }
            }}
            maxLength={4000}
            rows={2}
            className="focus-ring w-full resize-none rounded-md border border-border-strong bg-surface-raised px-3 py-2 text-base text-content-primary sm:text-sm"
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-content-tertiary">
              AI can be wrong. Check figures before acting on them.
            </p>
            <button
              type="submit"
              disabled={pending || question.trim().length === 0}
              className="focus-ring h-11 shrink-0 rounded-md bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-500 disabled:cursor-not-allowed disabled:bg-brand-600/60 lg:h-9"
            >
              Ask
            </button>
          </div>
        </form>
      }
    >
      <div className="space-y-4" aria-live="polite">
        <p className="text-sm text-content-secondary">
          {feature.description || 'Ask about data you can already see in Funda360.'} Funda AI only
          reads what your account is allowed to see, shows the figures it used, and never changes
          records.
        </p>

        {turns.length === 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-content-tertiary">
              Try asking
            </p>
            <ul className="mt-2 flex flex-col gap-2">
              {SUGGESTIONS.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => {
                      setQuestion(s);
                      inputRef.current?.focus();
                    }}
                    className="focus-ring min-h-11 w-full rounded-md border border-border-strong px-3 py-2 text-left text-sm text-content-secondary hover:bg-surface-sunken lg:min-h-9"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {turns.map((turn, i) => (
          <div key={i} className="space-y-2">
            <p className="ml-auto w-fit max-w-[90%] whitespace-pre-line break-words rounded-lg bg-surface-sunken px-3 py-2 text-sm text-content-primary">
              <span className="sr-only">You asked: </span>
              {turn.question}
            </p>
            {turn.result?.kind === 'answer' && <AiAnswerCard answer={turn.result} />}
            {turn.result?.kind === 'safeguarding' && (
              <div
                role="alert"
                className="rounded-lg border border-danger-500/30 bg-danger-50 px-3.5 py-3 text-sm text-danger-600"
              >
                <p className="font-semibold">Safeguarding</p>
                <p className="mt-1">{turn.result.message}</p>
              </div>
            )}
            <ErrorAlert message={turn.error} />
            {!turn.result && !turn.error && pending && i === turns.length - 1 && (
              <p role="status" className="text-sm text-content-secondary">
                Checking your Funda360 data…
              </p>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}

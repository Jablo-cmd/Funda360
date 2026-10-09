import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { aiErrorMessage, parseAiResult } from '@/features/ai/utils/aiResponse';
import type {
  AiFeature,
  AiFeedbackRating,
  AiHistoryTurn,
  AiResult,
} from '@/features/ai/types/ai.types';

/** Error from the funda-ai gateway, carrying its code and request id for support. */
export class AiRequestError extends Error {
  constructor(
    readonly code: string,
    readonly requestId: string | null,
  ) {
    super(aiErrorMessage(code));
    this.name = 'AiRequestError';
  }
}

/** Features the caller may use now. Never throws: no features means no launcher. */
async function listMyFeatures(): Promise<AiFeature[]> {
  const { data, error } = await supabase.rpc('ai_my_features');
  if (error || !Array.isArray(data)) return [];
  return (data as unknown[]).flatMap((row) => {
    const f = row as Record<string, unknown>;
    return typeof f.key === 'string' && typeof f.name === 'string'
      ? [
          {
            key: f.key,
            name: f.name,
            description: typeof f.description === 'string' ? f.description : '',
          },
        ]
      : [];
  });
}

async function ask(input: {
  feature: string;
  message: string;
  history: AiHistoryTurn[];
  clientRequestId: string;
}): Promise<AiResult> {
  const { data, error } = await supabase.functions.invoke('funda-ai', {
    body: {
      feature: input.feature,
      message: input.message,
      history: input.history,
      client_request_id: input.clientRequestId,
    },
  });
  if (error) {
    let code = 'unknown';
    let requestId: string | null = null;
    if (error instanceof FunctionsHttpError) {
      try {
        const body = (await (error.context as Response).json()) as {
          error?: string;
          request_id?: string;
        };
        code = body.error ?? code;
        requestId = body.request_id ?? null;
      } catch {
        // Not JSON (e.g. the platform rejected the call): keep the generic code.
      }
    }
    throw new AiRequestError(code, requestId);
  }
  const result = parseAiResult(data);
  if (!result) throw new AiRequestError('ai_invalid_output', null);
  return result;
}

async function submitFeedback(
  requestId: string,
  rating: AiFeedbackRating,
  comment?: string,
): Promise<void> {
  const { error } = await supabase.rpc('ai_submit_feedback', {
    p_request_id: requestId,
    p_rating: rating,
    p_comment: comment?.trim() ? comment.trim() : null,
  });
  if (error) throw error;
}

export const aiService = { listMyFeatures, ask, submitFeedback };

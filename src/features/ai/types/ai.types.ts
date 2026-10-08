/** A Funda AI feature the signed-in user may use right now (from ai_my_features()). */
export interface AiFeature {
  key: string;
  name: string;
  description: string;
}

export type AiConfidence = 'low' | 'medium' | 'high';

export interface AiEvidence {
  claim: string;
  value: string;
  period: string;
  sourceToolCall: string;
  /** True when the figure was found in the output of the lookup it cites. */
  verified: boolean;
}

export interface AiToolUse {
  tool: string;
  status: string;
}

export interface AiAnswer {
  kind: 'answer';
  requestId: string;
  answer: string;
  evidence: AiEvidence[];
  limitations: string[];
  confidence: AiConfidence;
  followUpQuestions: string[];
  declinedActions: string[];
  toolsUsed: AiToolUse[];
  requiresHumanReview: boolean;
}

/** Returned instead of an answer when a message suggests a child may be at risk. */
export interface AiSafeguardingNotice {
  kind: 'safeguarding';
  requestId: string;
  message: string;
}

export type AiResult = AiAnswer | AiSafeguardingNotice;

export interface AiHistoryTurn {
  role: 'user' | 'assistant';
  text: string;
}

export type AiFeedbackRating = 'helpful' | 'not_helpful' | 'problem';

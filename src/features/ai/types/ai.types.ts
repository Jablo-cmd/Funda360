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
  /** The field of that lookup's output the figure was copied from. */
  sourceField: string;
  /** True only when the figure equals the value at that exact field. */
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
  /** The model's text was replaced because it contained figures that could not be verified. */
  answerWithheld: boolean;
  unsupportedFigures: string[];
}

/** Returned instead of an answer when a message suggests a child may be at risk. */
export interface AiSafeguardingNotice {
  kind: 'safeguarding';
  requestId: string;
  message: string;
}

/** Returned instead of an answer when a content policy stops the request (e.g. medical information). */
export interface AiPolicyNotice {
  kind: 'policy_notice';
  requestId: string;
  message: string;
}

export type AiResult = AiAnswer | AiSafeguardingNotice | AiPolicyNotice;

export interface AiHistoryTurn {
  role: 'user' | 'assistant';
  text: string;
}

export type AiFeedbackRating = 'helpful' | 'not_helpful' | 'problem';

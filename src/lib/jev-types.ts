export type NoulQuestion = {
  type: 'noul';
  instructions: string;
};

export type ChoiceQuestion = {
  type: 'choice';
  instructions: string;

  criteria: Record<string, string>;
};

export type ScoreQuestion = {
  type: 'score';
  instructions: string;

  criteria: string[];
};

export type JevQuestion = NoulQuestion | ChoiceQuestion | ScoreQuestion;

export type NoulAnswer = {
  type: 'noul';

  probability: number;
};

export type ChoiceAnswer = {
  type: 'choice';

  selected: string;

  probabilities: Record<string, number>;
  confidence: number;
};

export type ScoreAnswer = {
  type: 'score';

  score: number;

  probabilities: Record<string, number>;
  confidence: number;

  legend?: Record<string, string>;
};

export type JevAnswer = NoulAnswer | ChoiceAnswer | ScoreAnswer;

export type JevUsage = {
  inputTokens: number;
  outputTokens: number;

  cost: number;
};

export type JevResult<K extends string = string> = {
  answers: Record<K, JevAnswer>;
  usage: JevUsage;
  model: string;

  replayed: boolean;

  simulated: boolean;

  latencyMs: number;

  recordedAt: string | null;
};

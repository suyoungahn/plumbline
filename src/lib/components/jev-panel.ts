export type JevStep = {
  label: string;
  primitive: string;
  value: string;
  sub?: string;

  bar?: { value: number; threshold?: number; tone: 'good' | 'bad' | 'neutral' };
  lit: boolean;
};

export type JevOutcome = {
  label: string;
  why: string;
  tone: 'good' | 'bad' | 'warn' | 'neutral';
};

export type JevMeta = { costUsd: number; latencyMs: number; source: string; model?: string | null };

export type JevRaw = {
  state: unknown;
  questions: { key: string; type: string; instructions: string; optionCount?: number }[];
  answers: unknown;
};

export type JevDelta = { label: string; from: string; to: string; better: boolean };

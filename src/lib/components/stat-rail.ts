export type RailStat = {
  label: string;
  value: string;
  note?: string;
  tone?: 'neutral' | 'good' | 'bad' | 'warn';
  bar?: number;
  threshold?: number;
};

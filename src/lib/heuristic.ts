import type { JevQuestion } from '$lib/jev-types';

type RawAnswers = Record<string, Record<string, unknown>>;
type State = Record<string, unknown>;

const num = (s: State, k: string, d = 0): number => (typeof s[k] === 'number' ? (s[k] as number) : d);
const bool = (s: State, k: string, d = false): boolean =>
  typeof s[k] === 'boolean' ? (s[k] as boolean) : d;

type Signals = {
  spendAtRiskPct: number;
  cpaOverPct: number;
  pacingOut: boolean;
  underfillPct: number;
  darkDays: number;
  overbidding: number;
  losingCtr: number;
  headroomLines: number;
  offsiteWouldBreach: boolean;
};

function read(state: State): Signals {
  const lines = (state.lines ?? state.line_items ?? []) as Record<string, unknown>[];
  const target = num(state, 'target_cpa_eur', 1);
  const offsite = num(state, 'offsite_cpa_eur', 0);

  return {
    spendAtRiskPct: num(state, 'spend_at_risk_pct'),
    cpaOverPct: num(state, 'cpa_vs_target_pct'),
    pacingOut: !bool(state, 'pacing_within_tolerance', true),
    underfillPct: num(state, 'underfill_pct'),
    darkDays: num(state, 'dark_days_if_unchanged'),
    overbidding: num(state, 'lines_overbidding', num(state, 'line_items_overbidding')),
    losingCtr:
      num(state, 'lines_losing_ctr', num(state, 'line_items_losing_ctr')) ||
      lines.filter((l) => num(l as State, 'ctr_change_pct', 0) <= -15).length,
    headroomLines: num(
      state,
      'efficient_line_items_with_headroom',
      lines.filter((l) => num(l as State, 'fill_rate', 1) > 0.95 && num(l as State, 'cpa_eur', 0) <= target).length
    ),
    offsiteWouldBreach: offsite > target * 1.2
  };
}

function distribution(permitted: string[], s: Signals): Record<string, number> {
  const w: Record<string, number> = {};
  for (const k of permitted) w[k] = 0.02;

  if (s.underfillPct > 0.1) {
    if (s.offsiteWouldBreach) {
      w.escalate_to_client = (w.escalate_to_client ?? 0) + 0.5;
      w.spill_to_offsite = (w.spill_to_offsite ?? 0) + 0.3;
    } else {
      w.spill_to_offsite = (w.spill_to_offsite ?? 0) + 0.65;
    }
  }
  if (s.losingCtr > 0) w.swap_creative = (w.swap_creative ?? 0) + 0.6;
  if (s.overbidding > 0) w.adjust_bid = (w.adjust_bid ?? 0) + 0.55;
  if ((s.cpaOverPct > 8 || s.spendAtRiskPct > 0.1) && s.headroomLines > 0)
    w.shift_budget = (w.shift_budget ?? 0) + 0.5;
  if (s.darkDays > 2 && s.headroomLines === 0) w.escalate_to_client = (w.escalate_to_client ?? 0) + 0.55;
  if (
    s.cpaOverPct <= 3 &&
    !s.pacingOut &&
    s.underfillPct < 0.05 &&
    s.losingCtr === 0 &&
    s.overbidding === 0 &&
    s.spendAtRiskPct < 0.08 &&
    s.darkDays <= 2
  ) {
    w.no_action = (w.no_action ?? 0) + 0.7;
  }
  if (s.pacingOut && s.cpaOverPct > 15) w.pause_placement = (w.pause_placement ?? 0) + 0.2;

  const total = Object.values(w).reduce((a, b) => a + b, 0);
  const out: Record<string, number> = {};
  for (const k of permitted) out[k] = Number((w[k] / total).toFixed(3));
  return out;
}

function gateFrom(s: Signals): number {
  let p = 0.08;
  if (s.cpaOverPct > 8) p += 0.35;
  else if (s.cpaOverPct > 3) p += 0.12;
  if (s.spendAtRiskPct > 0.15) p += 0.32;
  else if (s.spendAtRiskPct > 0.08) p += 0.16;
  if (s.pacingOut) p += 0.25;
  if (s.underfillPct > 0.1) p += 0.3;
  if (s.losingCtr > 0) p += 0.45;
  if (s.overbidding > 0) p += 0.15;
  if (s.darkDays > 2) p += 0.45;
  return Number(Math.min(0.97, p).toFixed(2));
}

function severityFrom(s: Signals, levels: number): number {
  const max = levels - 1;
  let v = 0.2;
  if (s.cpaOverPct > 0) v += Math.min(2.0, s.cpaOverPct / 12);
  if (s.pacingOut) v += 0.7;
  if (s.underfillPct > 0.1) v += 1.0;
  if (s.spendAtRiskPct > 0.1) v += Math.min(1.2, s.spendAtRiskPct * 5);
  if (s.losingCtr > 0) v += 0.6;
  if (s.darkDays > 2) v += 0.6;
  return Number(Math.min(max, v).toFixed(2));
}

function spread(score: number, levels: number): Record<string, number> {
  const weights = Array.from({ length: levels }, (_, i) => Math.exp(-Math.abs(i - score) / 0.8));
  const total = weights.reduce((a, b) => a + b, 0);
  const out: Record<string, number> = {};
  weights.forEach((wt, i) => (out[String(i)] = Number((wt / total).toFixed(3))));
  return out;
}

export function simulate(
  state: unknown,
  questions: Record<string, JevQuestion>
): { answers: RawAnswers; usage: { input_tokens: number; output_tokens: number; cost: number } } {
  const s = read((state ?? {}) as State);
  const answers: RawAnswers = {};

  for (const [key, q] of Object.entries(questions)) {
    if (q.type === 'noul') {
      answers[key] = { type: 'noul', noul: gateFrom(s) };
    } else if (q.type === 'choice') {
      const permitted = Object.keys(q.criteria);
      const dist = distribution(permitted, s);
      const sorted = Object.values(dist).sort((a, b) => b - a);
      const selected = Object.entries(dist).sort((a, b) => b[1] - a[1])[0][0];
      answers[key] = {
        type: 'choice',
        choice: selected,
        probabilities: dist,
        confidence: Number(Math.min(0.95, 0.45 + ((sorted[0] ?? 0) - (sorted[1] ?? 0)) * 0.9).toFixed(3))
      };
    } else {
      const levels = q.criteria.length;
      const score = severityFrom(s, levels);
      answers[key] = {
        type: 'score',
        score,
        probabilities: spread(score, levels),
        confidence: 0.62
      };
    }
  }

  const inputTokens = Math.round(JSON.stringify(state).length / 3.6);
  return {
    answers,
    usage: { input_tokens: inputTokens, output_tokens: 20, cost: Number((inputTokens * 1.1e-7).toFixed(7)) }
  };
}

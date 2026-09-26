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
  const offsite = num(state, 'programmatic_cpa_eur', num(state, 'offsite_cpa_eur', 0));

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

type TermSignals = { gate: number; severity: number; weights: Record<string, number> };

function readTerm(state: State): TermSignals {
  const w: Record<string, number> = {};
  const add = (k: string, v: number) => (w[k] = (w[k] ?? 0) + v);
  const clicks = num(state, 'clicks');
  const spend = num(state, 'spend_eur');
  const conversions = num(state, 'conversions');
  const target = num(state, 'target_cpa_eur', 1);
  const ratio = conversions > 0 ? spend / conversions / target : Infinity;
  const exact = state.match_type === 'exact';

  if (bool(state, 'on_brand_safety_list')) {
    add('add_negative', 0.55); add('no_action', 0.1);
    return { gate: 0.88, severity: 3.1, weights: w };
  }
  if (bool(state, 'mentions_competitor_brand')) {
    add('escalate_to_client', 0.5); add('add_negative', 0.22);
    if (ratio < 1) add('raise_bid', 0.14);
    return { gate: 0.84, severity: 2.2, weights: w };
  }
  if (!bool(state, 'matches_category', true)) {
    add('add_negative', 0.75);
    return { gate: 0.12, severity: 1 + Math.min(1, spend / 200), weights: w };
  }
  if (clicks < 10) {
    add('no_action', 0.7);
    return { gate: 0.04, severity: 0.2, weights: w };
  }
  if (conversions === 0) {
    add('add_negative', 0.62); add('lower_bid', 0.12);
    return { gate: spend > 250 ? 0.58 : 0.14, severity: 1.4 + Math.min(1.5, spend / 200), weights: w };
  }
  if (ratio <= 0.8 && !exact) {
    add('promote_to_exact', 0.65); add('raise_bid', 0.15);
    return { gate: 0.07, severity: 0.3, weights: w };
  }
  if (ratio <= 0.75 && exact) {
    add('raise_bid', 0.6); add('no_action', 0.1);
    return { gate: 0.09, severity: 0.4, weights: w };
  }
  if (ratio >= 1.3) {
    add('lower_bid', 0.58); add('add_negative', 0.16);
    return { gate: spend > 600 ? 0.56 : 0.18, severity: 1.2 + Math.min(1.5, (ratio - 1) * 2), weights: w };
  }
  if (spend >= 450 && ratio > 0.9 && ratio < 1.15) {
    add('raise_bid', 0.3); add('lower_bid', 0.28); add('no_action', 0.26);
    return { gate: 0.63, severity: 1.5, weights: w };
  }
  add('no_action', 0.6);
  return { gate: 0.06, severity: 0.5, weights: w };
}

export function simulate(
  state: unknown,
  questions: Record<string, JevQuestion>
): { answers: RawAnswers; usage: { input_tokens: number; output_tokens: number; cost: number } } {
  if ((state as State | null)?.kind === 'search_term') return simulateTerm(state as State, questions);
  if (state && typeof state === 'object' && 'undeliverable_eur' in state) return simulateSignals(readPlan(state as State), state as State, questions);
  if ((state as State | null)?.kind === 'pacing_line') return simulateSignals(readPacingLine(state as State), state as State, questions);
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

// A media plan check. The gate here asks whether the plan IS deliverable, so a high
// probability is good news, unlike the campaign gate.
function readPlan(state: State): TermSignals {
  const w: Record<string, number> = {};
  const add = (k: string, v: number) => (w[k] = (w[k] ?? 0) + v);
  const u = num(state, 'undeliverable_pct');
  const ready = bool(state, 'creative_ready', true);
  if (u > 0) {
    add('rebalance_to_offsite', 0.5); add('add_retailer', 0.18); add('extend_flight', 0.12);
    return { gate: u > 0.05 ? 0.08 : u > 0.01 ? 0.2 : 0.4, severity: Math.min(3.8, 1.2 + u * 25) + (ready ? 0 : 0.4), weights: w };
  }
  add('approve_as_is', ready ? 0.75 : 0.3);
  return { gate: ready ? 0.9 : 0.35, severity: ready ? 0.3 : 1.4, weights: w };
}

function readPacingLine(state: State): TermSignals {
  const w: Record<string, number> = {};
  const add = (k: string, v: number) => (w[k] = (w[k] ?? 0) + v);
  const pacing = typeof state.pacing === 'number' ? (state.pacing as number) : null;
  const over = num(state, 'over_pace_threshold', 1.1);
  const under = num(state, 'under_pace_threshold', 0.9);
  const vsTarget = typeof state.cpa_vs_target === 'number' ? (state.cpa_vs_target as number) : null;
  const performance = state.role === 'performance';

  if (bool(state, 'held') || state.role === 'non_working' || pacing === null) {
    add('no_action', 0.8);
    return { gate: 0.03, severity: 0.1, weights: w };
  }
  const drift = pacing > over ? pacing - 1 : pacing < under ? 1 - pacing : 0;
  const costly = performance && vsTarget !== null && vsTarget > 0;
  if (pacing < under) {
    if (bool(state, 'inventory_bounded')) { add('shift_budget', 0.5); add('escalate_to_client', 0.15); }
    else { add('expand_audience', 0.42); add('adjust_bid', 0.3); }
    return { gate: 0.55 + Math.min(0.35, drift), severity: 1.3 + Math.min(1.5, drift * 6), weights: w };
  }
  if (pacing > over) {
    if (costly) { add('shift_budget', 0.42); add('swap_creative', 0.22); add('adjust_bid', 0.2); }
    else { add('adjust_bid', 0.45); add('no_action', 0.2); }
    return { gate: costly ? 0.78 : 0.48, severity: 1.2 + Math.min(1.5, drift * 6) + (costly ? 0.4 : 0), weights: w };
  }
  if (performance && vsTarget !== null && vsTarget > 0.25) {
    add('adjust_bid', 0.4); add('shift_budget', 0.3);
    return { gate: 0.58, severity: 1.2 + Math.min(1.5, vsTarget * 2), weights: w };
  }
  add('no_action', 0.7);
  return { gate: 0.08, severity: 0.3, weights: w };
}

function simulateTerm(
  state: State,
  questions: Record<string, JevQuestion>
): { answers: RawAnswers; usage: { input_tokens: number; output_tokens: number; cost: number } } {
  return simulateSignals(readTerm(state), state, questions);
}

function simulateSignals(
  t: TermSignals,
  state: State,
  questions: Record<string, JevQuestion>
): { answers: RawAnswers; usage: { input_tokens: number; output_tokens: number; cost: number } } {
  const answers: RawAnswers = {};
  for (const [key, q] of Object.entries(questions)) {
    if (q.type === 'noul') {
      answers[key] = { type: 'noul', noul: Number(t.gate.toFixed(2)) };
    } else if (q.type === 'choice') {
      const permitted = Object.keys(q.criteria);
      const raw: Record<string, number> = {};
      for (const k of permitted) raw[k] = 0.02 + (t.weights[k] ?? 0);
      const total = Object.values(raw).reduce((a, b) => a + b, 0);
      const dist: Record<string, number> = {};
      for (const k of permitted) dist[k] = Number((raw[k] / total).toFixed(3));
      const ranked = Object.entries(dist).sort((a, b) => b[1] - a[1]);
      answers[key] = {
        type: 'choice',
        choice: ranked[0][0],
        probabilities: dist,
        confidence: Number(Math.min(0.95, 0.45 + (ranked[0][1] - (ranked[1]?.[1] ?? 0)) * 0.9).toFixed(3))
      };
    } else {
      const levels = q.criteria.length;
      const score = Number(Math.min(levels - 1, t.severity).toFixed(2));
      answers[key] = { type: 'score', score, probabilities: spread(score, levels), confidence: 0.62 };
    }
  }
  const inputTokens = Math.round(JSON.stringify(state).length / 3.6);
  return {
    answers,
    usage: { input_tokens: inputTokens, output_tokens: 20, cost: Number((inputTokens * 1.1e-7).toFixed(7)) }
  };
}

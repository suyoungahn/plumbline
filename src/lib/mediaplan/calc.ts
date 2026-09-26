import { CUR } from '$lib/money';
import { CHANNELS, type LineActual, type MediaPlan, type Pacing, type PlanLine } from './types';

// Every figure the workbook and the weekly report show is derived here, once. The
// xlsx export writes the same logic as live Excel formulas.

const DAY = 86_400_000;
export const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
export const toIso = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (iso: string, n: number) => toIso(new Date(toDate(iso).getTime() + n * DAY));
export const daysBetween = (a: string, b: string) => Math.round((toDate(b).getTime() - toDate(a).getTime()) / DAY);
export const shortDate = (iso: string) => {
  const d = toDate(iso);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${String(d.getUTCFullYear()).slice(2)}`;
};
export const dayMonth = (iso: string) => {
  const d = toDate(iso);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
};

export const cad = (n: number, decimals = 0) =>
  `${n < 0 ? '-' : ''}${CUR}${Math.abs(n).toLocaleString('en-CA', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
export const cadK = (n: number) =>
  n >= 1_000_000 ? `${CUR}${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 2)}M` : `${CUR}${(n / 1000).toFixed(1)}K`;
export const compact = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2)}M` : n >= 1000 ? `${(n / 1000).toFixed(0)}K` : String(Math.round(n));
export const pct = (n: number, decimals = 0) => `${(n * 100).toFixed(decimals)}%`;
export const signedPct = (n: number) => `${n > 0 ? '+' : ''}${(n * 100).toFixed(0)}%`;

export const flightDays = (p: MediaPlan) => daysBetween(p.flightStart, p.flightEnd) + 1;
export const weekCount = (p: MediaPlan) => Math.max(1, Math.ceil(flightDays(p) / 7));
export const weekStart = (p: MediaPlan, i: number) => addDays(p.flightStart, i * 7);
// The last week of a flight that isn't a whole number of weeks is a short stub.
export const daysInWeek = (p: MediaPlan, i: number) => Math.max(1, Math.min(7, flightDays(p) - i * 7));

// "Paid social (Meta)", the way a client report names a line.
export function lineName(l: PlanLine): string {
  const ch = CHANNELS[l.channel];
  const partner = l.partner.replace(/\s*\(.*\)\s*/g, '').trim();
  if (!partner || partner === 'TBD' || ch.role === 'non_working' || ch.role === 'reserve') return ch.short;
  return `${ch.short} (${partner})`;
}

export function partnerName(l: PlanLine): string {
  return l.partner.replace(/\s*\(.*\)\s*/g, '').trim() || CHANNELS[l.channel].short;
}

export function estimates(l: PlanLine) {
  return {
    impressions: l.buyType === 'CPM' && l.rate > 0 ? (l.budget / l.rate) * 1000 : 0,
    clicks: l.buyType === 'CPC' && l.rate > 0 ? l.budget / l.rate : 0
  };
}

export function planTotals(p: MediaPlan) {
  const budget = p.lines.reduce((s, l) => s + l.budget, 0);
  const est = p.lines.map(estimates);
  return {
    budget,
    impressions: est.reduce((s, e) => s + e.impressions, 0),
    clicks: est.reduce((s, e) => s + e.clicks, 0),
    offBy: budget - p.totalBudget
  };
}

export const isHeld = (p: MediaPlan, l: PlanLine) => p.heldLineIds.includes(l.id);

export function weekly(p: MediaPlan, l: PlanLine): number[] {
  return p.weeks.map((w) => (isHeld(p, l) ? 0 : l.budget * w.weight));
}

export function weightTotal(p: MediaPlan) {
  return p.weeks.reduce((s, w) => s + w.weight, 0);
}

export function flowTotals(p: MediaPlan) {
  const byWeek = p.weeks.map((_, i) => p.lines.reduce((s, l) => s + weekly(p, l)[i], 0));
  let run = 0;
  const cumulative = byWeek.map((v) => (run += v));
  return { byWeek, cumulative, cumulativePct: cumulative.map((v) => (p.totalBudget ? v / p.totalBudget : 0)) };
}

// Keep the flowchart the same length as the flight when the dates change.
export function fitWeeks(p: MediaPlan) {
  const n = weekCount(p);
  if (p.weeks.length === n) return;
  if (p.weeks.length > n) p.weeks.splice(n);
  else while (p.weeks.length < n) p.weeks.push({ weight: 0, moment: '' });
}

// Even spend per day: each week's weight is its share of the flight's days.
export function evenWeights(p: MediaPlan): number[] {
  const days = flightDays(p);
  const w = Array.from({ length: weekCount(p) }, (_, i) => Math.round((daysInWeek(p, i) / days) * 10000) / 10000);
  w[w.length - 1] = Math.round((1 - w.slice(0, -1).reduce((s, v) => s + v, 0)) * 10000) / 10000;
  return w;
}

export function spreadEvenly(p: MediaPlan) {
  const w = evenWeights(p);
  p.weeks.forEach((wk, i) => (wk.weight = w[i] ?? 0));
}

// Pacing, as the tracker computes it: each flowchart week is prorated by how much of
// it has elapsed, so "planned to date" moves day by day.

export function weekElapsed(p: MediaPlan, pace: Pacing): number[] {
  return p.weeks.map((_, i) => Math.max(0, Math.min(1, (daysBetween(weekStart(p, i), pace.dataThrough) + 1) / daysInWeek(p, i))));
}

export function currentWeekIndex(p: MediaPlan, pace: Pacing): number {
  const i = Math.floor(daysBetween(p.flightStart, pace.dataThrough) / 7);
  return Math.max(0, Math.min(p.weeks.length - 1, i));
}

export type PaceStatus = 'Held' | 'Overpacing' | 'Underpacing' | 'On pace';

const EMPTY: LineActual = { spend: 0, yesterday: 0, impressions: 0, conversions: 0, note: '' };

export function paceLine(p: MediaPlan, pace: Pacing, l: PlanLine) {
  const a = pace.actuals[l.id] ?? EMPTY;
  const elapsed = weekElapsed(p, pace);
  const planned = weekly(p, l).reduce((s, v, i) => s + v * elapsed[i], 0);
  const pacing = planned > 0 ? a.spend / planned : null;
  const status: PaceStatus =
    planned === 0 ? 'Held' : pacing! > pace.overPace ? 'Overpacing' : pacing! < pace.underPace ? 'Underpacing' : 'On pace';
  const cpa = a.conversions > 0 ? a.spend / a.conversions : null;
  return {
    line: l,
    actual: a,
    planned,
    pacing,
    status,
    spentPct: l.budget > 0 ? a.spend / l.budget : 0,
    remaining: l.budget - a.spend,
    dailyTarget: weekly(p, l)[currentWeekIndex(p, pace)] / daysInWeek(p, currentWeekIndex(p, pace)),
    cpa,
    cpaVsTarget: cpa === null || !p.targetCpa ? null : cpa / p.targetCpa - 1
  };
}

export type PacedLine = ReturnType<typeof paceLine>;

export function paceAll(p: MediaPlan, pace: Pacing) {
  const rows = p.lines.map((l) => paceLine(p, pace, l));
  const sum = (f: (r: PacedLine) => number) => rows.reduce((s, r) => s + f(r), 0);
  const spend = sum((r) => r.actual.spend);
  const planned = sum((r) => r.planned);
  const conversions = sum((r) => r.actual.conversions);
  const perf = rows.filter((r) => r.line.role === 'performance');
  const perfSpend = perf.reduce((s, r) => s + r.actual.spend, 0);
  const perfConv = perf.reduce((s, r) => s + r.actual.conversions, 0);
  const cpa = conversions > 0 ? spend / conversions : null;
  return {
    rows,
    spend,
    planned,
    pacing: planned > 0 ? spend / planned : null,
    budgetPct: p.totalBudget ? spend / p.totalBudget : 0,
    remaining: sum((r) => r.remaining),
    yesterday: sum((r) => r.actual.yesterday),
    dailyTarget: sum((r) => r.dailyTarget),
    impressions: sum((r) => r.actual.impressions),
    conversions,
    cpa,
    cpaVsTarget: cpa === null || !p.targetCpa ? null : cpa / p.targetCpa - 1,
    performanceCpa: perfConv > 0 ? perfSpend / perfConv : null,
    daysElapsed: daysBetween(p.flightStart, pace.dataThrough) + 1,
    daysRemaining: daysBetween(pace.dataThrough, p.flightEnd),
    flightDays: flightDays(p)
  };
}

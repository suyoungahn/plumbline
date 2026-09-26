import { cad, lineName, pct, signedPct, type PacedLine } from './calc';
import { lineRecommendation } from './recommend';
import type { LineSuggestion } from './pacing-jev';
import type { DecisionEntry, MediaPlan, Pacing, Provenance, Ruling } from './types';

// How a suggestion is presented to someone new to AI tools: as what to do about it,
// with the probability behind it one hover away rather than up front.

export type Band = { key: 'clear' | 'judgment' | 'unsure'; label: string; hint: string };

export function band(confidence: number): Band {
  if (confidence >= 0.7) return { key: 'clear', label: 'High confidence', hint: 'Strong evidence.' };
  if (confidence >= 0.5) return { key: 'judgment', label: 'Medium confidence', hint: 'Check the details.' };
  return { key: 'unsure', label: 'Low confidence', hint: 'Options are close.' };
}

export const SOURCE_LABEL: Record<Provenance, string> = {
  jev: 'Jev',
  jev_recorded: 'Jev',
  stand_in: 'Rules'
};

export const RULING_LABEL = { approved: 'Approved', overruled: 'Declined', auto: 'Applied automatically', shadow: 'Would apply automatically' } as const;

// The one or two facts that drove a pacing suggestion, in the manager's own terms.
export function pacingWhy(r: PacedLine, target: number): string {
  // Lead with what is actually off: pacing when the line is outside its band, cost
  // when it is on pace but expensive.
  const pacing = r.pacing !== null ? `${pct(r.pacing)} of plan to date` : null;
  const fill = r.actual.booked && r.actual.spend / r.actual.booked < 0.95 ? `only ${pct(r.actual.spend / r.actual.booked)} of booked spend delivered` : null;
  const cost = r.line.role === 'performance' && r.cpa !== null ? `CPA ${cad(r.cpa, 2)}, ${signedPct(r.cpa / target - 1)} vs target` : null;
  const facts = r.status === 'On pace' ? [cost, pacing] : [pacing, fill ?? cost];
  return facts.filter(Boolean).join('; ');
}

export const pacingKey = (date: string, lineId: string) => `${date}:pacing:${lineId}`;
export const termKey = (termId: string) => `term:${termId}`;
export const campaignKey = (date: string) => `${date}:campaign`;

export function upsert(list: DecisionEntry[], entry: DecisionEntry) {
  const i = list.findIndex((d) => d.key === entry.key);
  if (i === -1) list.push(entry);
  else list[i] = entry;
}

export function remove(list: DecisionEntry[], key: string) {
  const i = list.findIndex((d) => d.key === key);
  if (i !== -1) list.splice(i, 1);
}

export const subjectFor = (r: PacedLine) => lineName(r.line);

// Builders shared by every place a suggestion can be ruled on (the Inbox, the Pacing
// tab, the campaign Overview), so a ruling means the same thing wherever it is made.
export function pacingEntry(
  plan: MediaPlan,
  pace: Pacing,
  r: PacedLine,
  s: LineSuggestion,
  ruling: Ruling
): DecisionEntry {
  return {
    key: pacingKey(pace.dataThrough, r.line.id),
    date: pace.dataThrough,
    kind: 'pacing',
    lever: s.lever,
    subject: lineName(r.line),
    action: lineRecommendation(r, s.lever),
    why: pacingWhy(r, plan.targetCpa),
    gate: s.gateProbability,
    confidence: s.confidence,
    source: s.source === 'sim' ? 'stand_in' : 'jev',
    ruling,
    ruledBy: ruling === 'auto' || ruling === 'shadow' ? 'rules' : 'manager',
    note: r.actual.note || undefined
  };
}

export function campaignEntry(
  date: string,
  subject: string,
  action: string,
  why: string,
  p: { gateProbability: number; leverConfidence: number; source: string; lever?: string },
  ruling: 'approved' | 'overruled' | 'auto'
): DecisionEntry {
  return {
    key: campaignKey(date),
    date,
    kind: 'campaign',
    lever: p.lever,
    subject,
    action,
    why,
    gate: p.gateProbability,
    confidence: p.leverConfidence,
    source: p.source === 'replay' ? 'jev_recorded' : p.source === 'sim' ? 'stand_in' : 'jev',
    ruling,
    ruledBy: ruling === 'auto' ? 'rules' : 'manager'
  };
}

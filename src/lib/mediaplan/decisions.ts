import { cad, lineName, pct, signedPct, type PacedLine } from './calc';
import type { DecisionEntry, Provenance } from './types';

// How a suggestion is presented to someone new to AI tools: as what to do about it,
// with the probability behind it one hover away rather than up front.

export type Band = { key: 'clear' | 'judgment' | 'unsure'; label: string; hint: string };

export function band(confidence: number): Band {
  if (confidence >= 0.7) return { key: 'clear', label: 'Clear call', hint: 'The evidence points one way. Approve unless you know something the data does not.' };
  if (confidence >= 0.5) return { key: 'judgment', label: 'Judgment call', hint: 'The leading option is likely but not certain. Check the reason before approving.' };
  return { key: 'unsure', label: 'Unsure', hint: 'The options are close. Compare them; the pick below is only slightly ahead.' };
}

export const SOURCE_LABEL: Record<Provenance, string> = {
  jev: 'Jev',
  jev_recorded: 'Jev (recorded)',
  stand_in: 'Stand-in rules'
};

export const RULING_LABEL = { approved: 'Approved', overruled: 'Overruled', auto: 'Applied automatically', shadow: 'Would apply automatically' } as const;

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

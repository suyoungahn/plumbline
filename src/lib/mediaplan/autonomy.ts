import { LEVERS, type LeverId } from '$lib/domain';
import { TERM_ACTIONS, type TermActionId } from '$lib/keywords';
import type { DecisionEntry } from './types';

// Autonomy is earned per kind of action. Each starts manual; it can be switched to
// automatic only once people have ruled on enough of them and agreed often enough.

export const MIN_RULINGS = 20;
export const MIN_AGREEMENT = 0.9;

export type ActionType = { id: string; label: string; group: 'Campaign and pacing' | 'Search terms'; locked?: string };

export const ACTION_TYPES: ActionType[] = [
  ...(['shift_budget', 'adjust_bid', 'swap_creative', 'expand_audience', 'pause_placement', 'spill_to_offsite'] as LeverId[]).map((id) => ({
    id,
    label: LEVERS[id].label,
    group: 'Campaign and pacing' as const
  })),
  { id: 'escalate_to_client', label: LEVERS.escalate_to_client.label, group: 'Campaign and pacing', locked: 'Always reviewed. Client decision.' },
  ...(['add_negative', 'promote_to_exact', 'raise_bid', 'lower_bid'] as TermActionId[]).map((id) => ({
    id,
    label: TERM_ACTIONS[id].label,
    group: 'Search terms' as const
  })),
  { id: 'search_escalate', label: 'Competitor and brand-safety terms', group: 'Search terms', locked: 'Always reviewed. Client policy.' }
];

// The team's last 30 days before this demo, so the track record has something in it.
// Illustrative, like every figure in the scenario.
const HISTORY: Record<string, { approved: number; ruled: number }> = {
  shift_budget: { approved: 38, ruled: 41 },
  adjust_bid: { approved: 52, ruled: 55 },
  swap_creative: { approved: 12, ruled: 16 },
  expand_audience: { approved: 20, ruled: 22 },
  pause_placement: { approved: 9, ruled: 14 },
  spill_to_offsite: { approved: 6, ruled: 8 },
  add_negative: { approved: 211, ruled: 214 },
  promote_to_exact: { approved: 140, ruled: 143 },
  raise_bid: { approved: 33, ruled: 37 },
  lower_bid: { approved: 45, ruled: 49 }
};

export function trackRecord(id: string, decisions: DecisionEntry[]) {
  const mine = decisions.filter((d) => d.lever === id && d.ruledBy === 'manager');
  const h = HISTORY[id] ?? { approved: 0, ruled: 0 };
  const approved = h.approved + mine.filter((d) => d.ruling === 'approved').length;
  const ruled = h.ruled + mine.length;
  const rate = ruled ? approved / ruled : 0;
  return { approved, ruled, rate, eligible: ruled >= MIN_RULINGS && rate >= MIN_AGREEMENT };
}

// Does this suggestion apply without a person? Only with learning mode off, the action
// type switched to automatic, and the model at least fairly sure.
export function autoApplies(lever: string, confidence: number, s: { shadow: boolean; autonomy: Record<string, 'auto' | 'manual'> }) {
  return !s.shadow && s.autonomy[lever] === 'auto' && confidence >= 0.5;
}

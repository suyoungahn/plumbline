import { LEVERS, SEVERITY_RUBRIC, type LeverId } from '$lib/domain';
import type { JevQuestion } from '$lib/jev-types';
import { CHANNELS, type MediaPlan, type Pacing } from './types';
import type { PacedLine } from './calc';

// The daily pacing read, asked of Jev one line at a time. Same closed lever set as the
// rest of the product, so a suggestion here means the same thing as one on Today.

export const PACING_LEVERS: LeverId[] = [
  'shift_budget',
  'adjust_bid',
  'pause_placement',
  'swap_creative',
  'expand_audience',
  'escalate_to_client',
  'no_action'
];

export const PACING_QUESTIONS: Record<string, JevQuestion> = {
  gate: {
    type: 'noul',
    instructions:
      'Does this media line need the campaign manager to act today? Judge pacing against the 90 to 110 percent band and cost per conversion against target, but only hold performance lines to the CPA target. Held and non-working lines never need action.'
  },
  lever: {
    type: 'choice',
    instructions: [
      'Which single lever best corrects this line?',
      'Underpacing on a finite retail or publisher line is a supply limit: move budget elsewhere rather than bidding harder.',
      'Underpacing on an auction channel is usually reach: widen the audience or raise the bid.',
      'Overpacing with cost per conversion above target means moving budget to a cheaper line.',
      'Anything that changes total budget or releases held money is the client decision.'
    ].join(' '),
    criteria: Object.fromEntries(PACING_LEVERS.map((id) => [id, LEVERS[id].meaning]))
  },
  severity: {
    type: 'score',
    instructions: 'How far is this line from its plan, judged on pacing and, for performance lines, cost per conversion?',
    criteria: SEVERITY_RUBRIC
  }
};

export function pacingLineState(p: MediaPlan, pace: Pacing, r: PacedLine) {
  const ch = CHANNELS[r.line.channel];
  return {
    kind: 'pacing_line',
    channel: ch.label,
    partner: r.line.partner,
    role: r.line.role,
    held: r.status === 'Held',
    inventory_bounded: !!ch.surface && ch.surface !== 'programmatic',
    net_budget: r.line.budget,
    planned_to_date: Math.round(r.planned),
    actual_to_date: r.actual.spend,
    pacing: r.pacing === null ? null : Number(r.pacing.toFixed(3)),
    over_pace_threshold: pace.overPace,
    under_pace_threshold: pace.underPace,
    conversions: r.actual.conversions,
    cpa: r.cpa === null ? null : Number(r.cpa.toFixed(2)),
    target_cpa: p.targetCpa,
    cpa_vs_target: r.cpaVsTarget === null ? null : Number(r.cpaVsTarget.toFixed(3)),
    days_remaining: Math.max(0, Math.round((new Date(`${p.flightEnd}T00:00:00Z`).getTime() - new Date(`${pace.dataThrough}T00:00:00Z`).getTime()) / 86_400_000)),
    manager_note: r.actual.note
  };
}

export type LineSuggestion = {
  gateProbability: number;
  needsYou: boolean;
  lever: LeverId;
  confidence: number;
  severity: number;
  costUsd: number;
  source: 'live' | 'replay' | 'sim';
};

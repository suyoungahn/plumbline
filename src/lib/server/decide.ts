import { askJev, resolveMode } from './jev';
import { narrate } from './narrate';
import { GATE_THRESHOLD, LEVERS, SEVERITY_RUBRIC, type LeverId, type Policy, type Proposal, type Tick } from '$lib/domain';
import type { ChoiceAnswer, JevQuestion, NoulAnswer, ScoreAnswer } from '$lib/jev-types';

function leverCriteria(policy: Policy): Record<string, string> {
  const out: Record<string, string> = {};
  for (const id of policy.permittedLevers) out[id] = LEVERS[id].meaning;
  return out;
}

function stateFor(policy: Policy, tick: Tick, previous?: Tick) {
  const daysRemaining = policy.flightDays - tick.day;
  const evenPaceSpend = (tick.budgetEur / policy.flightDays) * tick.day;
  const remainingBudget = tick.budgetEur - tick.spendToDateEur;
  const burnPerDay = previous
    ? (tick.spendToDateEur - previous.spendToDateEur) / (tick.day - previous.day)
    : tick.spendToDateEur / tick.day;
  const daysOfBudgetLeft = burnPerDay > 0 ? remainingBudget / burnPerDay : daysRemaining;
  const exhaustionDay = Math.round(tick.day + daysOfBudgetLeft);

  const ctrChangePct = (l: Tick['lineItems'][number]) => {
    const before = previous?.lineItems.find((p) => p.id === l.id);
    if (!before) return null;
    return Number((((l.ctr - before.ctr) / before.ctr) * 100).toFixed(1));
  };

  return {
    objective: policy.objective,
    target_cpa_eur: policy.targetCpaEur,
    pacing_tolerance: policy.pacingTolerance,
    brand_safety: policy.brandSafety,
    delivery_commitments: policy.commitments,

    day: tick.day,
    flight_days: policy.flightDays,
    days_remaining: daysRemaining,

    budget_eur: tick.budgetEur,
    spend_to_date_eur: tick.spendToDateEur,
    even_pace_spend_eur: Math.round(evenPaceSpend),
    remaining_budget_eur: remainingBudget,
    burn_rate_eur_per_day: Math.round(burnPerDay),
    projected_exhaustion_day: exhaustionDay,
    dark_days_if_unchanged: Math.max(0, policy.flightDays - exhaustionDay),

    pacing_index: tick.pacingIndex,
    pacing_within_tolerance:
      tick.pacingIndex >= policy.pacingTolerance[0] && tick.pacingIndex <= policy.pacingTolerance[1],

    cpa_eur: tick.cpaEur,
    cpa_vs_target_pct: Number((((tick.cpaEur - policy.targetCpaEur) / policy.targetCpaEur) * 100).toFixed(1)),
    ctr: tick.ctr,
    conversions: tick.conversions,

    budget_change_permitted: false,
    objective_change_permitted: false,

    throttling_would_breach_commitment: exhaustionDay < policy.flightDays,

    line_items_above_target_cpa: tick.lineItems.filter((l) => l.cpaEur > policy.targetCpaEur).length,

    efficient_line_items_with_headroom: tick.lineItems.filter(
      (l) => l.cpaEur <= policy.targetCpaEur && l.headroom >= 0.2
    ).length,
    line_items_losing_ctr: tick.lineItems.filter((l) => {
      const before = previous?.lineItems.find((p) => p.id === l.id);
      return before ? (l.ctr - before.ctr) / before.ctr <= -0.15 : false;
    }).length,
    line_items_overbidding: tick.lineItems.filter((l) => l.bidVsJustified > 1.05).length,

    line_items: tick.lineItems.map((l) => ({
      id: l.id,
      platform: l.platform,
      audience: l.audience,
      placement: l.placement,
      share_of_spend: l.shareOfSpend,
      cpa_eur: l.cpaEur,
      cpa_vs_target_pct: Number((((l.cpaEur - policy.targetCpaEur) / policy.targetCpaEur) * 100).toFixed(1)),
      ctr: l.ctr,
      ctr_change_pct_since_last_tick: ctrChangePct(l),

      headroom: l.headroom,
      bid_vs_cpa_justified: l.bidVsJustified,
      note: l.note
    }))
  };
}

export type DecideOptions = {
  mode?: 'live' | 'replay' | 'sim';

  withRationale?: boolean;

  previous?: Tick;
};

export async function decide(
  policy: Policy,
  tick: Tick,
  options: DecideOptions = {}
): Promise<Proposal> {
  const questions: Record<string, JevQuestion> = {
    gate: {
      type: 'noul',
      instructions:
        'Does this campaign require operator intervention right now? Consider it against its stated objective, its CPA target and its pacing tolerance, not against a general notion of good performance.'
    },
    lever: {
      type: 'choice',
      instructions: [
        'Which single lever best corrects this campaign against its objective?',
        'Shifting budget only helps if a cheaper line item still has headroom to absorb it. A line item with headroom at or near 0 is exhausted and cannot take more spend.',
        'Expanding audience adds reachable supply but it also increases burn rate. It is the lever when the binding constraint is supply. It is the wrong lever when the binding constraint is remaining budget, because spending the remainder faster makes that worse.',
        'Swapping creative is the lever when a line item has lost click through rate since the last tick at flat frequency.',
        'Adjusting bid is the lever when bid_vs_cpa_justified is away from 1.',
        'Escalating to the client is a LAST RESORT and must not be chosen while any other permitted lever could still materially improve the outcome. Choose it only when line_items_above_target_cpa is 0, line_items_losing_ctr is 0, line_items_overbidding is 0 and efficient_line_items_with_headroom is 0, so that no efficiency lever has anything left to act on, AND the budget still will not cover the flight. Fixing efficiency also reduces waste, so prefer an efficiency lever whenever one is available.',
        'Choosing no action is correct when pacing is within tolerance, CPA is at or under target, nothing has lost click through rate, and nothing is out of headroom.'
      ].join(' '),
      criteria: leverCriteria(policy)
    },
    severity: {
      type: 'score',
      instructions:
        'How severe is the gap between current performance and the stated objective? Judge it against the CPA target and the pacing tolerance, not against a general notion of good performance.',
      criteria: SEVERITY_RUBRIC
    }
  };

  const result = await askJev(stateFor(policy, tick, options.previous), questions, {
    mode: options.mode,
    fixture: `nuvola-day-${tick.day}`
  });

  const gate = result.answers.gate as NoulAnswer;
  const lever = result.answers.lever as ChoiceAnswer;
  const severity = result.answers.severity as ScoreAnswer;

  const proposal: Proposal = {
    id: `p-${tick.day}`,
    day: tick.day,
    gateProbability: gate.probability,
    gateOpen: gate.probability >= GATE_THRESHOLD,
    lever: lever.selected as LeverId,
    leverDistribution: lever.probabilities,
    leverConfidence: lever.confidence,
    severity: severity.score,
    severityConfidence: severity.confidence,
    targetLineItemId: pickTarget(lever.selected as LeverId, tick, policy, options.previous),
    costUsd: result.usage.cost,
    source: result.simulated ? 'sim' : result.replayed ? 'replay' : 'live'
  };

  if (options.withRationale !== false) {
    proposal.rationale = await narrate(
      policy,
      tick,
      proposal,
      resolveMode(options.mode),
      `nuvola-day-${tick.day}`
    );
  }

  return proposal;
}

function pickTarget(lever: LeverId, tick: Tick, policy: Policy, previous?: Tick): string | undefined {
  const items = tick.lineItems;
  if (items.length === 0) return undefined;

  const wasted = (l: (typeof items)[number]) => l.shareOfSpend * Math.max(l.cpaEur - policy.targetCpaEur, 0);

  const mostWasteful = [...items].sort((a, b) => wasted(b) - wasted(a))[0];
  const worstCpa = [...items].sort((a, b) => b.cpaEur - a.cpaEur)[0];
  const best = [...items].sort((a, b) => a.cpaEur - b.cpaEur)[0];

  const ctrChange = (l: (typeof items)[number]) => {
    const before = previous?.lineItems.find((p) => p.id === l.id);
    return before ? (l.ctr - before.ctr) / before.ctr : 0;
  };
  const fatiguing = [...items].sort((a, b) => ctrChange(a) - ctrChange(b))[0];

  switch (lever) {
    case 'shift_budget':
    case 'pause_placement':
      return mostWasteful.id;
    case 'adjust_bid':

      return worstCpa.id;
    case 'expand_audience':
      return best.id;
    case 'swap_creative':
      return fatiguing.id;
    default:
      return undefined;
  }
}

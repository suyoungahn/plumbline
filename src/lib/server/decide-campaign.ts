import { askJev } from './jev';
import { GATE_THRESHOLD, LEVERS, SEVERITY_RUBRIC, type LeverId } from '$lib/domain';
import { SURFACES } from '$lib/placements';
import { DEFAULT_MEASUREMENT, metrics, type Campaign } from '$lib/scenario/campaigns';
import type { ChoiceAnswer, JevQuestion, NoulAnswer, ScoreAnswer } from '$lib/jev-types';

export type CampaignProposal = {
  campaignId: string;
  gateProbability: number;
  gateOpen: boolean;
  lever: LeverId;
  leverDistribution: Record<string, number>;
  leverConfidence: number;
  severity: number;
  severityConfidence: number;
  targetSurface?: string;
  costUsd: number;
  source: 'live' | 'replay' | 'sim';
};

export const PERMITTED: LeverId[] = [
  'shift_budget',
  'spill_to_offsite',
  'adjust_bid',
  'pause_placement',
  'swap_creative',
  'expand_audience',
  'escalate_to_client',
  'no_action'
];

function stateFor(c: Campaign) {
  const m = metrics(c);
  const burnPerDay = c.day > 0 ? m.delivered / c.day : 0;
  const remaining = c.budgetEur - m.delivered;
  const exhaustionDay = burnPerDay > 0 ? Math.round(c.day + remaining / burnPerDay) : c.flightDays;

  return {
    objective: c.objective,
    target_cpa_eur: c.targetCpaEur,
    budget_eur: c.budgetEur,
    flight_days: c.flightDays,
    day: c.day,
    days_remaining: m.daysRemaining,

    allocated_eur: m.allocated,
    delivered_eur: m.delivered,

    underfill_eur: m.underfillEur,
    underfill_pct: m.underfillPct,

    blended_cpa_eur: m.cpa,
    cpa_vs_target_pct: m.cpaVsTargetPct,
    pacing_index: m.pacing,
    pacing_within_tolerance: m.pacing >= 0.9 && m.pacing <= 1.15,
    projected_exhaustion_day: exhaustionDay,
    dark_days_if_unchanged: Math.max(0, c.flightDays - exhaustionDay),

    budget_change_permitted: false,
    objective_change_permitted: false,

    spend_at_risk_eur: m.spendAtRisk,
    spend_at_risk_pct: m.delivered > 0 ? Number((m.spendAtRisk / m.delivered).toFixed(3)) : 0,
    lines_losing_ctr: c.lines.filter((l) => l.ctrChangePct <= -15).length,
    lines_above_target_cpa: c.lines.filter((l) => l.cpaEur > c.targetCpaEur).length,
    lines_underfilling: c.lines.filter((l) => l.deliveredEur < l.allocatedEur * 0.9).length,
    lines_overbidding: c.lines.filter((l) => l.bidVsJustified > 1.05).length,
    programmatic_cpa_eur: c.lines.find((l) => l.surface === 'programmatic')?.cpaEur ?? null,
    cheapest_line_cpa_eur: Math.min(...c.lines.map((l) => l.cpaEur)),

    attributed_sales_eur: m.attributedSales,
    roas: m.roas,
    measurement_basis: c.measurement ?? DEFAULT_MEASUREMENT,

    max_discrepancy_pct: m.maxDiscrepancy,
    discrepancy_breaches_contract: m.discrepancyBreachesContract,
    max_ivt_pct: m.maxIvt,

    lines: c.lines.map((l) => ({
      surface: l.surface,
      surface_supply: SURFACES[l.surface].supply,
      retailer: l.retailer,
      audience: l.audience,
      allocated_eur: l.allocatedEur,
      delivered_eur: l.deliveredEur,
      fill_rate: Number((l.deliveredEur / l.allocatedEur).toFixed(3)),
      cpa_eur: l.cpaEur,
      cpa_vs_target_pct: Number((((l.cpaEur - c.targetCpaEur) / c.targetCpaEur) * 100).toFixed(1)),
      ctr: l.ctr,
      bid_vs_cpa_justified: l.bidVsJustified,
      ctr_change_pct: l.ctrChangePct,
      frequency: l.frequency,
      frequency_change_pct: l.frequencyChangePct,
      attributed_sales_eur: l.attributedSalesEur,
      discrepancy_pct: l.discrepancyPct,
      ivt_pct: l.ivtPct,
      note: l.note
    }))
  };
}

function leverCriteria(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const id of PERMITTED) out[id] = LEVERS[id].meaning;
  return out;
}

const LEVER_INSTRUCTIONS = [
  'Which single lever best corrects this campaign against its objective?',
  'Retailer onsite (sponsored display), retailer in-app and off-app publisher deals all have FINITE supply. A fill rate well below 1 means the inventory does not exist, so bidding harder and shifting more budget in will not help. Programmatic supply (The Trade Desk, DV360) is effectively unbounded and always costs more per outcome.',
  'Shift budget only when a line at or under target CPA still has fill headroom to absorb it.',
  'Spill to programmatic when a finite-supply line cannot deliver its allocation and recovering that delivery is worth the higher cost per outcome that programmatic charges. Do not spill when doing so would push blended CPA past the target, because that trades a delivery problem for a cost problem.',
  'Adjust bid when bid_vs_cpa_justified is away from 1.',
  'Read spend_at_risk_pct, not just blended CPA. A blended average at target can still conceal a third of spend running at double target on one line, and that line is the decision.',
  'Click through rate is a WEAK signal and must never justify a lever on its own. A falling CTR with sharply rising frequency is audience exhaustion, not creative wearout, and swapping the creative will not fix it. Swap creative only when CTR has fallen while frequency stayed roughly flat, which is the frequency-matched case.',
  'A discrepancy above 10 percent is a contractual reconciliation event under the IAB and 4A\'s Standard Terms, not an optimisation problem, so escalate rather than trying to optimise through it.',
  'Expand audience when the constraint is reachable supply rather than remaining budget.',
  'Escalate to the client as a LAST RESORT, only when every permitted lever is exhausted or would breach the target. Underfill that cannot be recovered inside the CPA target is this case, because the choice between under-delivering and accepting a worse CPA belongs to the advertiser.',
  'Choose no action when pacing is inside tolerance, blended CPA is at or under target, no line is underfilling, none has lost click through rate and none is overbidding.'
].join(' ');

export async function decideCampaign(
  c: Campaign,
  options: { mode?: 'live' | 'replay' | 'sim' } = {}
): Promise<CampaignProposal> {
  const questions: Record<string, JevQuestion> = {
    gate: {
      type: 'noul',
      instructions:
        'Does this campaign require a decision from the campaign manager right now? Judge it against its own objective, CPA target and pacing tolerance, not against a general notion of good performance.'
    },
    lever: { type: 'choice', instructions: LEVER_INSTRUCTIONS, criteria: leverCriteria() },
    severity: {
      type: 'score',
      instructions:
        'How severe is the gap between current performance and the stated objective, judged against the CPA target and the pacing tolerance?',
      criteria: SEVERITY_RUBRIC
    }
  };

  const result = await askJev(stateFor(c), questions, {
    mode: options.mode,
    fixture: `campaign-${c.id}`
  });

  const gate = result.answers.gate as NoulAnswer;
  const lever = result.answers.lever as ChoiceAnswer;
  const severity = result.answers.severity as ScoreAnswer;

  return {
    campaignId: c.id,
    gateProbability: gate.probability,
    gateOpen: gate.probability >= GATE_THRESHOLD,
    lever: lever.selected as LeverId,
    leverDistribution: lever.probabilities,
    leverConfidence: lever.confidence,
    severity: severity.score,
    severityConfidence: severity.confidence,
    targetSurface: pickSurface(lever.selected as LeverId, c),
    costUsd: result.usage.cost,
    source: result.simulated ? 'sim' : result.replayed ? 'replay' : 'live'
  };
}

function pickSurface(lever: LeverId, c: Campaign): string | undefined {
  const byWaste = [...c.lines].sort(
    (a, b) =>
      b.deliveredEur * Math.max(b.cpaEur - c.targetCpaEur, 0) -
      a.deliveredEur * Math.max(a.cpaEur - c.targetCpaEur, 0)
  );
  const byUnderfill = [...c.lines].sort(
    (a, b) => b.allocatedEur - b.deliveredEur - (a.allocatedEur - a.deliveredEur)
  );
  const byCtr = [...c.lines].sort((a, b) => a.ctrChangePct - b.ctrChangePct);
  const byBid = [...c.lines].sort((a, b) => b.bidVsJustified - a.bidVsJustified);

  switch (lever) {
    case 'spill_to_offsite':
      return byUnderfill[0]?.surface;
    case 'shift_budget':
    case 'pause_placement':
      return byWaste[0]?.surface;
    case 'adjust_bid':
      return byBid[0]?.surface;
    case 'swap_creative':
      return byCtr[0]?.surface;
    case 'expand_audience':
      return 'programmatic';
    default:
      return undefined;
  }
}

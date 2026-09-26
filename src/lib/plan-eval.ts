import { allocationTotal, approvalsRequired, creativeCoverage, type PlanDraft } from '$lib/plan';
import { availableEur, poolFor } from '$lib/supply';
import { REQUIRED_LANGUAGES } from '$lib/portfolio';
import { SEVERITY_RUBRIC } from '$lib/domain';
import type { JevQuestion } from '$lib/jev-types';

const PLAN_LEVERS: Record<string, string> = {
  approve_as_is: 'The plan is deliverable and priced correctly. Send it for approval unchanged',
  rebalance_to_offsite:
    'Move the undeliverable onsite allocation to offsite inventory, accepting a higher cost per outcome to keep the budget working',
  extend_flight:
    'Lengthen the flight so the same onsite budget has more weeks of inventory to spend against',
  add_retailer:
    'Add another retailer network to widen the onsite pool rather than over-allocating one retailer',
  reduce_budget:
    'Reduce the total budget to what the requested placements can actually deliver, and return the remainder',
  relax_cpa_target: 'Raise the CPA target so cheaper-to-reach inventory qualifies',
  escalate_to_client:
    'The plan cannot be fixed inside the agency mandate because it needs a change to budget, objective or target that belongs to the advertiser'
};

export const GATE_INSTRUCTION =
  'Is this media plan deliverable as specified? It is NOT deliverable if the plan asks any inventory-bounded placement for materially more budget than is actually available over the flight, or if any required creative language is missing for a requested surface. Judge deliverability, not whether the plan is a good idea.';

export const RISK_INSTRUCTION =
  'How much delivery risk does this plan carry as written, judged against its budget and flight?';

export const LEVER_INSTRUCTIONS = [
'Which single change would best fix this plan before it goes to approval?',
        'Read requested_over_available per placement. A value above 1 on an inventory-bounded surface means the plan asks for budget that does not exist, and no amount of bidding will spend it.',
        'Choose approve_as_is only when undeliverable_eur is zero and creative_ready is true.',
        'Prefer a change inside the agency mandate over escalating. Escalate only when the fix requires changing total budget, the objective or the CPA target, which belong to the advertiser.'
].join(' ');

export function stateFor(plan: PlanDraft) {
  const placements = plan.placements.map((p) => {
    const available = availableEur(p.retailer, p.surface, plan.flightDays);
    const pool = poolFor(p.retailer, p.surface);
    return {
      retailer: p.retailer,
      surface: p.surface,
      requested_eur: p.requestedEur,
      available_eur: available,

      requested_over_available: available > 0 ? Number((p.requestedEur / available).toFixed(2)) : null,
      shortfall_eur: Math.max(0, p.requestedEur - available),
      typical_cpa_eur: pool?.typicalCpaEur ?? null,
      inventory_bounded: p.surface !== 'offsite'
    };
  });

  const requested = allocationTotal(plan);
  const shortfall = placements.reduce((s, p) => s + p.shortfall_eur, 0);

  const weighted = placements.reduce((s, p) => s + (p.typical_cpa_eur ?? 0) * p.requested_eur, 0);
  const expectedCpa = requested > 0 ? weighted / requested : 0;

  const cov = creativeCoverage(plan);

  return {
    objective: plan.objective,
    objective_type: plan.objectiveType,
    budget_eur: plan.budgetEur,
    flight_days: plan.flightDays,
    target_cpa_eur: plan.targetCpaEur,

    allocated_eur: requested,
    unallocated_eur: plan.budgetEur - requested,

    undeliverable_eur: shortfall,
    undeliverable_pct: plan.budgetEur > 0 ? Number((shortfall / plan.budgetEur).toFixed(3)) : 0,

    expected_blended_cpa_eur: Number(expectedCpa.toFixed(2)),
    expected_cpa_vs_target_pct: Number((((expectedCpa - plan.targetCpaEur) / plan.targetCpaEur) * 100).toFixed(1)),

    placements,

    creative_count: plan.creatives.length,
    surfaces_requested: cov.requested,
    market: plan.market,
    required_languages: REQUIRED_LANGUAGES[plan.market],

    creative_language_gaps: cov.gaps,
    creatives_not_in_a_required_language: cov.unusable.map((c) => c.filename),
    creative_ready: cov.ready,

    approvals: approvalsRequired(plan.budgetEur),
    budget_change_permitted: false,
    objective_change_permitted: false
  };
}

export function planQuestions(): Record<string, JevQuestion> {
  return {
    gate: { type: 'noul', instructions: GATE_INSTRUCTION },
    lever: { type: 'choice', instructions: LEVER_INSTRUCTIONS, criteria: PLAN_LEVERS },
    severity: { type: 'score', instructions: RISK_INSTRUCTION, criteria: SEVERITY_RUBRIC }
  };
}

export { PLAN_LEVERS };

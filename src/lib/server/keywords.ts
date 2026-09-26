// The search-term report, evaluated term by term. Shared by the all-campaigns view and
// each campaign's Search terms tab.
import { decideTerm } from '$lib/server/decide-term';
import { campaignById } from '$lib/scenario/campaigns';
import { SEARCH_TERMS } from '$lib/scenario/search-terms';
import { CLIENTS } from '$lib/portfolio';
import { JEV_COST_PER_CALL_USD, TERM_ACTIONS, type TermActionId } from '$lib/keywords';


export async function keywordsReport(campaignId?: string) {
  const rows = await Promise.all(
    SEARCH_TERMS.filter((t) => !campaignId || t.campaignId === campaignId).map(async (t) => {
      const c = campaignById(t.campaignId)!;
      const decision = await decideTerm(t, c);
      return {
        term: t,
        campaign: { id: c.id, clientId: c.clientId, name: c.name, client: CLIENTS[c.clientId].name, targetCpaEur: c.targetCpaEur },
        decision
      };
    })
  );

  const queue = rows
    .filter((r) => r.decision.gateOpen)
    .sort((a, b) => b.decision.severity - a.decision.severity || b.term.spendEur - a.term.spendEur);
  const handled = rows.filter((r) => !r.decision.gateOpen);

  const groups = (Object.keys(TERM_ACTIONS) as TermActionId[])
    .map((action) => {
      const mine = handled.filter((r) => r.decision.action === action);
      return {
        action,
        count: mine.length,
        spendEur: Math.round(mine.reduce((s, r) => s + r.term.spendEur, 0)),
        conversions: mine.reduce((s, r) => s + r.term.conversions, 0),
        examples: [...mine].sort((a, b) => b.term.spendEur - a.term.spendEur).slice(0, 12)
      };
    })
    .filter((g) => g.count > 0 && g.action !== 'escalate_to_client');

  const sources = new Set(rows.map((r) => r.decision.source));
  const simulated = sources.has('sim');
  const recordedCost = rows.reduce((s, r) => s + (r.decision.source === 'sim' ? 0 : r.decision.costUsd), 0);
  const simCalls = rows.filter((r) => r.decision.source === 'sim').length;

  return {
    queue,
    groups,
    summary: {
      terms: rows.length,
      campaigns: new Set(rows.map((r) => r.term.campaignId)).size,
      needsHuman: queue.length,
      autoApplied: handled.filter((r) => r.decision.action !== 'no_action').length,
      leftAlone: handled.filter((r) => r.decision.action === 'no_action').length,
      spendEvaluated: Math.round(rows.reduce((s, r) => s + r.term.spendEur, 0)),
      wastedStopped: Math.round(
        handled.filter((r) => r.decision.action === 'add_negative').reduce((s, r) => s + r.term.spendEur, 0)
      ),
      frenchTerms: rows.filter((r) => r.term.language === 'fr-CA').length,
      decisionCostUsd: Number((recordedCost + simCalls * JEV_COST_PER_CALL_USD).toFixed(6)),
      costEstimated: simulated,
      source: simulated ? (sources.size > 1 ? 'mixed' : 'sim') : sources.has('live') ? 'live' : 'replay'
    }
  };
}

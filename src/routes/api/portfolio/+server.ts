import { STATIC_BUILD } from '$lib/build-target';

export const prerender = STATIC_BUILD;

import { json } from '@sveltejs/kit';
import { decideCampaign } from '$lib/server/decide-campaign';
import { CAMPAIGNS, metrics } from '$lib/scenario/campaigns';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  const mode = undefined;

  const results = await Promise.all(
    CAMPAIGNS.map(async (c) => {
      const proposal = await decideCampaign(c, { mode });
      return { campaign: { ...c, metrics: metrics(c) }, proposal };
    })
  );

  const needsHuman = results.filter((r) => r.proposal.gateOpen);
  const handled = results.filter((r) => !r.proposal.gateOpen);
  const totalCost = results.reduce((s, r) => s + r.proposal.costUsd, 0);

  return json({
    rows: results,
    summary: {
      campaigns: results.length,
      needsHuman: needsHuman.length,
      handled: handled.length,
      underManagement: CAMPAIGNS.reduce((s, c) => s + c.budgetEur, 0),
      spendAtRisk: needsHuman.reduce((s, r) => s + r.campaign.metrics.spendAtRisk, 0),
      underfill: needsHuman.reduce((s, r) => s + r.campaign.metrics.underfillEur, 0),
      decisionCostUsd: Number(totalCost.toFixed(6)),
      source: results[0]?.proposal.source ?? 'sim'
    }
  });
};

import { STATIC_BUILD } from '$lib/build-target';

export const prerender = STATIC_BUILD;

import { json } from '@sveltejs/kit';
import { decideCampaign } from '$lib/server/decide-campaign';
import { CAMPAIGNS, metrics } from '$lib/scenario/campaigns';
import { CLIENTS, type ClientId } from '$lib/portfolio';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  const mode = undefined;

  const evaluated = await Promise.all(
    CAMPAIGNS.map(async (c) => ({ c, m: metrics(c), p: await decideCampaign(c, { mode }) }))
  );

  const byClient = (Object.keys(CLIENTS) as ClientId[]).map((id) => {
    const mine = evaluated.filter((e) => e.c.clientId === id);
    const budget = mine.reduce((s, e) => s + e.c.budgetEur, 0);
    const delivered = mine.reduce((s, e) => s + e.m.delivered, 0);
    const conversions = mine.reduce((s, e) => s + e.m.conversions, 0);
    const weightedTarget =
      mine.reduce((s, e) => s + e.c.targetCpaEur * e.m.delivered, 0) / (delivered || 1);

    return {
      id,
      name: CLIENTS[id].name,
      category: CLIENTS[id].category,
      campaigns: mine.length,
      budget,
      delivered,
      conversions,
      cpa: conversions > 0 ? Number((delivered / conversions).toFixed(2)) : 0,
      targetCpa: Number(weightedTarget.toFixed(2)),
      underfillEur: mine.reduce((s, e) => s + e.m.underfillEur, 0),
      spendAtRisk: mine.reduce((s, e) => s + e.m.spendAtRisk, 0),
      decisions: mine.length,
      neededHuman: mine.filter((e) => e.p.gateOpen).length,
      clearedAlone: mine.filter((e) => !e.p.gateOpen).length,
      costUsd: Number(mine.reduce((s, e) => s + e.p.costUsd, 0).toFixed(6)),

      leverMix: mine
        .filter((e) => e.p.gateOpen)
        .reduce<Record<string, number>>((acc, e) => {
          acc[e.p.lever] = (acc[e.p.lever] ?? 0) + 1;
          return acc;
        }, {})
    };
  });

  return json({
    clients: byClient,
    totals: {
      clients: byClient.length,
      campaigns: evaluated.length,
      budget: byClient.reduce((s, c) => s + c.budget, 0),
      delivered: byClient.reduce((s, c) => s + c.delivered, 0),
      decisions: evaluated.length,
      neededHuman: evaluated.filter((e) => e.p.gateOpen).length,
      costUsd: Number(evaluated.reduce((s, e) => s + e.p.costUsd, 0).toFixed(6)),
      source: evaluated[0]?.p.source ?? 'sim'
    }
  });
};

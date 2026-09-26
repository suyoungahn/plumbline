import { STATIC_BUILD } from '$lib/build-target';

export const prerender = STATIC_BUILD;

import { json, error } from '@sveltejs/kit';
import { decideCampaign } from '$lib/server/decide-campaign';
import { CAMPAIGNS, campaignById, metrics } from '$lib/scenario/campaigns';
import type { RequestHandler } from './$types';

export const entries = () => CAMPAIGNS.map((c) => ({ id: c.id }));

export const GET: RequestHandler = async ({ params }) => {
  const c = campaignById(params.id);
  if (!c) throw error(404, `No campaign ${params.id}`);
  const proposal = await decideCampaign(c);
  return json({ campaign: { ...c, metrics: metrics(c) }, proposal });
};

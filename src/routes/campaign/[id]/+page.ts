import { CAMPAIGNS } from '$lib/scenario/campaigns';

export const entries = () => CAMPAIGNS.map((c) => ({ id: c.id }));
export const prerender = true;

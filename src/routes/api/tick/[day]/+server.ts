import { STATIC_BUILD } from '$lib/build-target';

export const prerender = STATIC_BUILD;

import { json, error } from '@sveltejs/kit';
import { decide } from '$lib/server/decide';
import { POLICY, TICKS } from '$lib/scenario/nuvola';
import type { RequestHandler } from './$types';

export const entries = () => TICKS.map((t) => ({ day: String(t.day) }));

export const GET: RequestHandler = async ({ params }) => {
  const index = TICKS.findIndex((t) => String(t.day) === params.day);
  if (index === -1) throw error(404, `No tick for day ${params.day}`);
  return json(await decide(POLICY, TICKS[index], { previous: TICKS[index - 1] }));
};

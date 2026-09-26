import { json, error } from '@sveltejs/kit';
import { decide } from '$lib/server/decide';
import { POLICY, TICKS } from '$lib/scenario/nuvola';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
  const { day, mode } = (await request.json()) as { day: number; mode?: 'live' | 'replay' | 'sim' };
  const index = TICKS.findIndex((t) => t.day === day);
  if (index === -1) throw error(404, `No tick for day ${day}`);
  const tick = TICKS[index];
  const previous = index > 0 ? TICKS[index - 1] : undefined;

  try {
    return json(await decide(POLICY, tick, { mode, previous }));
  } catch (e) {
    throw error(502, e instanceof Error ? e.message : 'Decision failed');
  }
};

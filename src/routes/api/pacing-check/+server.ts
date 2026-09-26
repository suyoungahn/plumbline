import { json } from '@sveltejs/kit';
import { askJev, resolveMode } from '$lib/server/jev';
import { GATE_THRESHOLD, type LeverId } from '$lib/domain';
import { PACING_QUESTIONS, type LineSuggestion } from '$lib/mediaplan/pacing-jev';
import type { ChoiceAnswer, NoulAnswer, ScoreAnswer } from '$lib/jev-types';
import type { RequestHandler } from './$types';

// Pacing states change every morning, so there is nothing to replay: Jev is called live
// when JEV_MODE=live, and the heuristic stand-in answers otherwise.
export const POST: RequestHandler = async ({ request }) => {
  const { states } = (await request.json()) as { states: Record<string, unknown>[] };
  const mode = resolveMode() === 'live' ? 'live' : 'sim';
  const suggestions: LineSuggestion[] = await Promise.all(
    states.map(async (state) => {
      const r = await askJev(state, PACING_QUESTIONS, { mode });
      const gate = r.answers.gate as NoulAnswer;
      const lever = r.answers.lever as ChoiceAnswer;
      const severity = r.answers.severity as ScoreAnswer;
      return {
        gateProbability: gate.probability,
        needsYou: gate.probability >= GATE_THRESHOLD,
        lever: lever.selected as LeverId,
        confidence: lever.confidence,
        severity: severity.score,
        costUsd: r.usage.cost,
        source: r.simulated ? 'sim' : r.replayed ? 'replay' : 'live'
      };
    })
  );
  return json({ suggestions });
};

import { json } from '@sveltejs/kit';
import { askJev } from '$lib/server/jev';
import { GATE_THRESHOLD } from '$lib/domain';
import { PLAN_LEVERS, planQuestions, stateFor } from '$lib/plan-eval';
import { DRAFT } from '$lib/scenario/draft-plan';
import type { ChoiceAnswer, NoulAnswer, ScoreAnswer } from '$lib/jev-types';
import type { PlanDraft } from '$lib/plan';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, url }) => {
  const body = (await request.json().catch(() => ({}))) as { plan?: PlanDraft };
  const plan = body.plan ?? DRAFT;
  const mode = (url.searchParams.get('mode') ?? undefined) as 'live' | 'replay' | 'sim' | undefined;

  const questions = planQuestions();

  const result = await askJev(stateFor(plan), questions, { mode });

  const gate = result.answers.gate as NoulAnswer;
  const lever = result.answers.lever as ChoiceAnswer;
  const severity = result.answers.severity as ScoreAnswer;

  return json({
    plan,
    state: stateFor(plan),
    check: {
      deliverableProbability: gate.probability,
      deliverable: gate.probability >= GATE_THRESHOLD,
      recommendation: lever.selected,
      recommendationLabel: PLAN_LEVERS[lever.selected] ?? lever.selected,
      distribution: lever.probabilities,
      confidence: lever.confidence,
      riskScore: severity.score,
      riskConfidence: severity.confidence,
      costUsd: result.usage.cost,
      latencyMs: result.latencyMs,
      source: result.simulated ? 'sim' : result.replayed ? 'replay' : 'live'
    }
  });
};

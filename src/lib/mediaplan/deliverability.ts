import type { PlanDraft } from '$lib/plan';
import type { ClientId } from '$lib/portfolio';
import { CHANNELS, type MediaPlan, type PlanLine } from './types';
import { flightDays } from './calc';

// Retail onsite, retail in-app, off-app publishers and programmatic are the lines whose
// supply Jev can check: they draw on a pool with a known capacity. CTV, social, search
// and audio are bought in auctions the agency cannot size in advance, so they are not
// part of this check.

export const retailLines = (p: MediaPlan): PlanLine[] => p.lines.filter((l) => CHANNELS[l.channel].surface);

export function toPlanDraft(p: MediaPlan): PlanDraft {
  const lines = retailLines(p);
  return {
    clientId: 'agropur' as ClientId,
    market: 'CA',
    name: p.campaign,
    objectiveType: 'volume',
    objective: p.objective,
    budgetEur: lines.reduce((s, l) => s + l.budget, 0),
    flightDays: flightDays(p),
    targetCpaEur: p.targetCpa,
    placements: lines.map((l) => ({ retailer: l.partner, surface: CHANNELS[l.channel].surface!, requestedEur: l.budget })),
    audiences: lines.map((l) => l.targeting),
    creatives: p.creatives,
    status: 'draft'
  };
}

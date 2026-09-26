import { FORMAT_SURFACES } from '$lib/plan';
import { SURFACES } from '$lib/placements';
import { CLIENTS } from '$lib/portfolio';
import type { Campaign } from '$lib/scenario/campaigns';
import { addDays, evenWeights } from './calc';
import type { MediaPlan, Pacing, PlanLine, WeeklyReport } from './types';

// Every campaign in the book, expressed as the same record the Plan, Flowchart,
// Pacing and Report tabs work on. The scenario gives a snapshot: each line's spend
// booked to date and delivered to date. Here that becomes a full-flight line budget
// (booked share of the campaign budget), an even flowchart, and actuals to date.

export const SCENARIO_TODAY = '2026-11-23';

const CPM: Record<string, number> = { sponsored_display: 14, in_app: 12, off_app: 20, programmatic: 6 };

export function recordFromCampaign(c: Campaign): { plan: MediaPlan; pacing: Pacing; report: WeeklyReport } {
  const flightStart = addDays(SCENARIO_TODAY, -(c.day - 1));
  const booked = c.lines.reduce((s, l) => s + l.allocatedEur, 0);
  const client = CLIENTS[c.clientId].name;

  const lines: PlanLine[] = c.lines.map((l, i) => ({
    id: `${c.id}-${i}`,
    channel: l.surface,
    partner: l.retailer ?? 'The Trade Desk',
    tactic: SURFACES[l.surface].label,
    targeting: l.audience,
    kpi: 'Conversions (CPA)',
    buyType: 'CPM',
    rate: CPM[l.surface],
    budget: Math.round((c.budgetEur * l.allocatedEur) / booked),
    role: 'performance'
  }));

  const plan: MediaPlan = {
    client,
    campaign: c.name,
    preparedFor: `${client} marketing`,
    status: 'Live',
    objective: c.objective,
    conversionName: 'conversion',
    targetCpa: c.targetCpaEur,
    flightStart,
    flightEnd: addDays(flightStart, c.flightDays - 1),
    totalBudget: c.budgetEur,
    lines,
    weeks: [],
    heldLineIds: [],
    creatives: [
      { id: `${c.id}-cr-en`, filename: `${c.id}_300x250_en.jpg`, format: '300x250', sizeKb: 90, eligibleSurfaces: FORMAT_SURFACES['300x250'], language: 'en' },
      { id: `${c.id}-cr-fr`, filename: `${c.id}_300x250_fr.jpg`, format: '300x250', sizeKb: 92, eligibleSurfaces: FORMAT_SURFACES['300x250'], language: 'fr-CA' }
    ],
    notes: ['Live campaign imported from the book. Line budgets are each line\'s booked share of the campaign budget.'],
    approval: { name: '', title: '', date: '' }
  };
  plan.weeks = evenWeights(plan).map((weight) => ({ weight, moment: '' }));

  const pacing: Pacing = { dataThrough: SCENARIO_TODAY, overPace: 1.1, underPace: 0.9, actuals: {} };
  c.lines.forEach((l, i) => {
    pacing.actuals[`${c.id}-${i}`] = {
      spend: l.deliveredEur,
      yesterday: Math.round(l.deliveredEur / c.day),
      impressions: Math.round((l.deliveredEur / CPM[l.surface]) * 1000),
      conversions: Math.round(l.deliveredEur / l.cpaEur),
      booked: l.allocatedEur,
      note: l.note ?? ''
    };
  });

  const report: WeeklyReport = {
    number: Math.max(1, Math.ceil(c.day / 7)),
    sentDate: addDays(SCENARIO_TODAY, 1),
    headline: '',
    summary: [],
    changes: [],
    decisions: [],
    comingUp: [],
    footer: 'Questions? Reply to this email or reach your campaign manager directly. The full line-item detail is in the attached media plan.'
  };

  return { plan, pacing, report };
}

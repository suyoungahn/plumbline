import { SURFACES } from '$lib/placements';
import { SUPPLY } from '$lib/supply';
import type { ClientInfo } from '$lib/portfolio';
import { addDays, evenWeights } from './calc';
import { SCENARIO_TODAY } from './book';
import { CHANNELS, type BuyType, type ChannelId, type MediaPlan, type PlanLine } from './types';

// Everything the "New campaign" flow needs to turn a few answers into a full record,
// ready to refine on the Plan tab.

export type Goal = 'sign-up' | 'sale' | 'conversion';

export type DraftLine = { channel: ChannelId; partner: string; budget: number };

export type Template = 'retail' | 'full' | 'blank';

export const TEMPLATES: Record<Template, { label: string; mix: { channel: ChannelId; partner?: string; share: number }[] }> = {
  retail: {
    label: 'Retail media',
    mix: [
      { channel: 'sponsored_display', share: 0.35 },
      { channel: 'in_app', share: 0.25 },
      { channel: 'off_app', partner: 'Taboola', share: 0.15 },
      { channel: 'programmatic', partner: 'The Trade Desk', share: 0.25 }
    ]
  },
  full: {
    label: 'Full funnel',
    mix: [
      { channel: 'ctv', partner: 'The Trade Desk', share: 0.2 },
      { channel: 'paid_social', partner: 'Meta', share: 0.2 },
      { channel: 'paid_search', partner: 'Google Ads', share: 0.2 },
      { channel: 'sponsored_display', share: 0.15 },
      { channel: 'in_app', share: 0.1 },
      { channel: 'programmatic', partner: 'The Trade Desk', share: 0.15 }
    ]
  },
  blank: { label: 'Blank', mix: [] }
};

// Default seller for a channel: the client's first retail partner that sells it,
// otherwise the first seller that does.
export function defaultPartner(channel: ChannelId, client?: ClientInfo): string {
  const surface = CHANNELS[channel].surface;
  if (!surface) return '';
  const sellers = [...new Set(SUPPLY.filter((s) => s.surface === surface).map((s) => s.retailer))];
  return client?.retailers.find((r) => sellers.includes(r)) ?? sellers[0] ?? '';
}

export function templateLines(t: Template, budget: number, client?: ClientInfo): DraftLine[] {
  const lines = TEMPLATES[t].mix.map((m) => ({
    channel: m.channel,
    partner: m.partner ?? defaultPartner(m.channel, client),
    budget: Math.round((budget * m.share) / 1000) * 1000
  }));
  // Put any rounding difference on the largest line so the total matches the budget.
  if (lines.length) {
    const diff = budget - lines.reduce((s, l) => s + l.budget, 0);
    lines.sort((a, b) => b.budget - a.budget)[0].budget += diff;
  }
  return lines;
}

export type Pattern = 'even' | 'front' | 'back';

export const PATTERNS: Record<Pattern, string> = { even: 'Even', front: 'Front-loaded', back: 'Back-loaded' };

export function patternWeights(plan: Pick<MediaPlan, 'flightStart' | 'flightEnd'>, pattern: Pattern): number[] {
  const even = evenWeights(plan as MediaPlan);
  if (pattern === 'even' || even.length < 2) return even;
  const n = even.length;
  // A linear tilt from 1.5x to 0.5x (or the reverse) across the weeks.
  const tilt = even.map((w, i) => w * (pattern === 'front' ? 1.5 - i / (n - 1) : 0.5 + i / (n - 1)));
  const total = tilt.reduce((s, v) => s + v, 0);
  const w = tilt.map((v) => Math.round((v / total) * 10000) / 10000);
  w[n - 1] = Math.round((1 - w.slice(0, -1).reduce((s, v) => s + v, 0)) * 10000) / 10000;
  return w;
}

const RATE: Partial<Record<ChannelId, { buyType: BuyType; rate: number }>> = {
  sponsored_display: { buyType: 'CPM', rate: 14 },
  in_app: { buyType: 'CPM', rate: 12 },
  off_app: { buyType: 'CPM', rate: 20 },
  programmatic: { buyType: 'CPM', rate: 6 },
  ctv: { buyType: 'CPM', rate: 38 },
  online_video: { buyType: 'CPM', rate: 16 },
  paid_social: { buyType: 'CPM', rate: 10 },
  paid_search: { buyType: 'CPC', rate: 1.6 },
  digital_audio: { buyType: 'CPM', rate: 20 },
  podcast: { buyType: 'CPM', rate: 25 },
  ad_serving: { buyType: 'Flat', rate: 0 },
  reserve: { buyType: 'TBD', rate: 0 }
};

export const defaultStart = () => addDays(SCENARIO_TODAY, 7);
export const defaultEnd = () => addDays(SCENARIO_TODAY, 7 + 34);

export function buildCampaign(input: {
  client: ClientInfo;
  name: string;
  objective: string;
  goal: Goal;
  targetCpa: number;
  budget: number;
  flightStart: string;
  flightEnd: string;
  lines: DraftLine[];
  pattern: Pattern;
}) {
  const id = () => `l-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const lines: PlanLine[] = input.lines.map((l) => {
    const ch = CHANNELS[l.channel];
    const r = RATE[l.channel] ?? { buyType: 'CPM' as BuyType, rate: 10 };
    return {
      id: id(),
      channel: l.channel,
      partner: l.partner,
      tactic: ch.surface ? SURFACES[ch.surface].label : ch.label,
      targeting: '',
      kpi: ch.role === 'awareness' ? 'Reach' : `${input.goal[0].toUpperCase()}${input.goal.slice(1)}s (CPA)`,
      buyType: r.buyType,
      rate: r.rate,
      budget: l.budget,
      role: ch.role
    };
  });

  const plan: MediaPlan = {
    client: input.client.name,
    campaign: input.name,
    preparedFor: `${input.client.name} marketing`,
    status: 'Draft',
    objective: input.objective,
    conversionName: input.goal,
    targetCpa: input.targetCpa,
    flightStart: input.flightStart,
    flightEnd: input.flightEnd,
    totalBudget: input.budget,
    lines,
    weeks: [],
    heldLineIds: lines.filter((l) => l.role === 'reserve').map((l) => l.id),
    creatives: [],
    notes: [],
    approval: { name: input.client.contact?.name ?? '', title: '', date: '' }
  };
  plan.weeks = patternWeights(plan, input.pattern).map((weight) => ({ weight, moment: '' }));

  return {
    plan,
    pacing: {
      dataThrough: SCENARIO_TODAY,
      overPace: 1.1,
      underPace: 0.9,
      actuals: Object.fromEntries(lines.map((l) => [l.id, { spend: 0, yesterday: 0, impressions: 0, conversions: 0, note: '' }]))
    },
    report: {
      number: 1,
      sentDate: addDays(input.flightStart, 7),
      headline: '',
      summary: [],
      changes: [],
      decisions: [],
      comingUp: [],
      footer: 'Questions? Reply to this email or reach your campaign manager directly.'
    }
  };
}

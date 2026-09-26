import type { SurfaceId } from '$lib/placements';
import type { CreativeAsset } from '$lib/plan';

export type ChannelId =
  | 'sponsored_display'
  | 'in_app'
  | 'off_app'
  | 'programmatic'
  | 'ctv'
  | 'online_video'
  | 'paid_social'
  | 'paid_search'
  | 'digital_audio'
  | 'podcast'
  | 'ad_serving'
  | 'reserve';

// Funnel role decides how a line is read in the report: performance lines are held to
// the CPA target, awareness lines are not, and non-working and reserve are neither.
export type FunnelRole = 'performance' | 'awareness' | 'non_working' | 'reserve';

export const CHANNELS: Record<ChannelId, { label: string; short: string; role: FunnelRole; surface?: SurfaceId }> = {
  sponsored_display: { label: 'Retail onsite (sponsored display)', short: 'Retail onsite', role: 'performance', surface: 'sponsored_display' },
  in_app: { label: 'Retail in-app', short: 'Retail in-app', role: 'performance', surface: 'in_app' },
  off_app: { label: 'Off-app publisher', short: 'Off-app', role: 'performance', surface: 'off_app' },
  programmatic: { label: 'Programmatic display', short: 'Programmatic display', role: 'performance', surface: 'programmatic' },
  ctv: { label: 'CTV', short: 'CTV', role: 'awareness' },
  online_video: { label: 'Online video', short: 'Online video', role: 'awareness' },
  paid_social: { label: 'Paid social', short: 'Paid social', role: 'performance' },
  paid_search: { label: 'Paid search', short: 'Search', role: 'performance' },
  digital_audio: { label: 'Digital audio', short: 'Audio', role: 'awareness' },
  podcast: { label: 'Podcast', short: 'Podcast', role: 'awareness' },
  ad_serving: { label: 'Ad serving & verification', short: 'Ad serving & verification', role: 'non_working' },
  reserve: { label: 'Test & learn reserve', short: 'Test & learn reserve', role: 'reserve' }
};

export type BuyType = 'CPM' | 'CPC' | 'Flat' | 'TBD';

export type PlanLine = {
  id: string;
  channel: ChannelId;
  partner: string;
  tactic: string;
  targeting: string;
  kpi: string;
  buyType: BuyType;
  rate: number;
  budget: number;
  role: FunnelRole;
};

export type FlightWeek = {
  weight: number;
  moment: string;
};

export type MediaPlan = {
  client: string;
  campaign: string;
  preparedFor: string;
  status: string;
  objective: string;
  conversionName: string;
  targetCpa: number;
  flightStart: string;
  flightEnd: string;
  totalBudget: number;
  lines: PlanLine[];
  weeks: FlightWeek[];
  heldLineIds: string[];
  creatives: CreativeAsset[];
  notes: string[];
  approval: { name: string; title: string; date: string };
};

export type LineActual = {
  spend: number;
  yesterday: number;
  impressions: number;
  conversions: number;
  // Spend the seller confirmed for this line to date. Delivered ÷ booked is the fill
  // rate, which shows supply running out; pacing shows spend against the flowchart.
  booked?: number;
  note: string;
};

export type Pacing = {
  dataThrough: string;
  overPace: number;
  underPace: number;
  actuals: Record<string, LineActual>;
};

export type Decision = { request: string; why: string; neededBy: string; highlight: boolean };

export type WeeklyReport = {
  number: number;
  sentDate: string;
  headline: string;
  summary: string[];
  changes: string[];
  decisions: Decision[];
  comingUp: string[];
  footer: string;
};

// One entry per suggestion that was ruled on or applied. Every kind of suggestion
// (a campaign-level lever, a pacing line, a search term) lands in the same record,
// and the weekly report's "What we changed" is written from it.
export type DecisionKind = 'campaign' | 'pacing' | 'search_term';
// 'shadow' = a routine change the rules would have applied, recorded but not applied
// because the team is running in shadow mode.
export type Ruling = 'approved' | 'overruled' | 'auto' | 'shadow';
export type Provenance = 'jev' | 'jev_recorded' | 'stand_in';

export type DecisionEntry = {
  key: string;
  date: string;
  kind: DecisionKind;
  // The action type (a lever or search-term action id), for the autonomy track record.
  lever?: string;
  subject: string;
  action: string;
  why: string;
  gate: number;
  confidence: number;
  source: Provenance;
  ruling: Ruling;
  ruledBy: 'manager' | 'rules';
  note?: string;
};

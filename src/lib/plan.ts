import type { SurfaceId } from './placements';
import { REQUIRED_LANGUAGES, type ClientId, type Market } from './portfolio';

export type CampaignStatus =
  | 'draft'
  | 'pending_internal'
  | 'pending_client'
  | 'approved'
  | 'live'
  | 'complete';

export const STATUS_LABEL: Record<CampaignStatus, string> = {
  draft: 'Draft',
  pending_internal: 'Internal review',
  pending_client: 'With client',
  approved: 'Approved',
  live: 'Live',
  complete: 'Complete'
};

export type ObjectiveType = 'trial' | 'volume' | 'share_defence' | 'launch';

export const OBJECTIVES: Record<ObjectiveType, { label: string; primaryMetric: string; note: string }> = {
  trial: { label: 'Drive trial', primaryMetric: 'Cost per acquisition', note: 'New-to-brand share matters more than raw volume' },
  volume: { label: 'Drive volume', primaryMetric: 'Cost per acquisition', note: 'Efficiency first, reach second' },
  share_defence: { label: 'Defend share', primaryMetric: 'Share of voice', note: 'Presence against a named competitor, not efficiency' },
  launch: { label: 'Launch', primaryMetric: 'Reach at frequency', note: 'Coverage and frequency, CPA is a guardrail not a goal' }
};

export type CreativeFormat = '300x250' | '728x90' | '160x600' | 'app_native' | 'web_native' | 'video_15s';

export type CreativeAsset = {
  id: string;
  filename: string;
  format: CreativeFormat;
  sizeKb: number;

  eligibleSurfaces: SurfaceId[];
  language: string;

  review?: { pass: boolean; confidence: number; flags: string[] };
};

export const FORMAT_SURFACES: Record<CreativeFormat, SurfaceId[]> = {
  '300x250': ['sponsored_display', 'in_app', 'off_app', 'programmatic'],
  '728x90': ['sponsored_display', 'off_app', 'programmatic'],
  '160x600': ['off_app', 'programmatic'],
  app_native: ['in_app'],
  web_native: ['off_app'],
  video_15s: ['off_app', 'programmatic']
};

export type PlacementRequest = {
  retailer: string;
  surface: SurfaceId;
  requestedEur: number;
};

export type PlanDraft = {
  clientId: ClientId;
  market: Market;
  name: string;
  objectiveType: ObjectiveType;
  objective: string;
  budgetEur: number;
  flightDays: number;
  targetCpaEur: number;
  placements: PlacementRequest[];
  audiences: string[];
  creatives: CreativeAsset[];
  status: CampaignStatus;
};

export function approvalsRequired(budgetEur: number): { internal: boolean; client: boolean; reason: string } {
  if (budgetEur >= 150_000)
    return { internal: true, client: true, reason: 'Over CA$150,000 requires trading director and client sign-off' };
  if (budgetEur >= 50_000)
    return { internal: true, client: false, reason: 'Over CA$50,000 requires trading director sign-off' };
  return { internal: false, client: false, reason: 'Within the campaign manager mandate' };
}

export function allocationTotal(p: PlanDraft): number {
  return p.placements.reduce((s, x) => s + x.requestedEur, 0);
}

export function creativeCoverage(p: PlanDraft) {
  const required = REQUIRED_LANGUAGES[p.market];
  const requested = [...new Set(p.placements.filter((x) => x.requestedEur > 0).map((x) => x.surface))];

  const gaps: { language: string; surfaces: SurfaceId[] }[] = [];
  for (const lang of required) {
    const covered = [
      ...new Set(p.creatives.filter((c) => c.language === lang).flatMap((c) => c.eligibleSurfaces))
    ];
    const missing = requested.filter((s) => !covered.includes(s));
    if (missing.length) gaps.push({ language: lang, surfaces: missing });
  }

  const missingLanguages = required.filter((l) => !p.creatives.some((c) => c.language === l));
  const unusable = p.creatives.filter((c) => !required.includes(c.language));

  return {
    required,
    requested,
    gaps,
    missingLanguages,
    unusable,
    ready: requested.length > 0 && gaps.length === 0
  };
}

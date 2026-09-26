import { paceLine } from './calc';
import { FORMAT_SURFACES } from '$lib/plan';
import type { MediaPlan, Pacing, PlanLine, WeeklyReport } from './types';

// Illustrative. The structure follows a real agency media plan; every figure is invented.

const line = (
  id: string,
  channel: PlanLine['channel'],
  partner: string,
  tactic: string,
  targeting: string,
  kpi: string,
  buyType: PlanLine['buyType'],
  rate: number,
  budget: number,
  role: PlanLine['role']
): PlanLine => ({ id, channel, partner, tactic, targeting, kpi, buyType, rate, budget, role });

export const SEED_PLAN: MediaPlan = {
  client: 'Loblaw Companies — PC Express Pass',
  campaign: 'PC Express Pass Holiday Membership Drive',
  preparedFor: 'PC Express Pass Marketing',
  status: 'Draft v1 for client review',
  objective: 'Drive new PC Express Pass paid memberships during peak holiday grocery and gifting',
  conversionName: 'sign-up',
  targetCpa: 22,
  flightStart: '2026-11-09',
  flightEnd: '2026-12-20',
  totalBudget: 1_000_000,
  lines: [
    line('ctv', 'ctv', 'The Trade Desk', 'Premium streaming (Crave, CBC Gem, Roku, Tubi) :15/:30', 'A25-54 HHI $60-150K; non-member households (1P audience)', 'Reach / incremental sign-ups', 'CPM', 38, 150_000, 'awareness'),
    line('yt', 'online_video', 'YouTube (DV360)', 'Skippable in-stream + Shorts :15', 'Holiday shoppers, grocery delivery intenders', 'Completed views / reach', 'CPM', 16, 60_000, 'awareness'),
    line('meta', 'paid_social', 'Meta (FB / IG)', 'Reels + Stories, Advantage+ conversion', 'Broad A25-54 + lookalikes of recent joiners', 'Sign-ups (CPA)', 'CPM', 10, 130_000, 'performance'),
    line('tiktok', 'paid_social', 'TikTok', 'In-feed + Spark Ads (creator-led)', 'A18-34 grocery haul and meal-prep engagers', 'Sign-ups (CPA)', 'CPM', 9, 70_000, 'performance'),
    line('google', 'paid_search', 'Google Ads', 'Brand + non-brand (grocery delivery, free delivery)', 'Keyword intent; RLSA on site visitors', 'Sign-ups / CPA', 'CPC', 1.8, 140_000, 'performance'),
    line('msft', 'paid_search', 'Microsoft Ads', 'Brand + non-brand mirror of Google', 'Keyword intent', 'Sign-ups / CPA', 'CPC', 1.4, 25_000, 'performance'),
    line('onsite', 'sponsored_display', 'Loblaw', 'PC.ca and Shoppers homepage and search takeovers', 'PC Optimum members without a pass', 'Sign-ups / CPA', 'CPM', 14, 90_000, 'performance'),
    line('inapp', 'in_app', 'Loblaw', 'PC Optimum app offer tiles + basket banner', 'App users who have tried delivery once', 'Sign-ups / CPA', 'CPM', 12, 60_000, 'performance'),
    line('globe', 'off_app', 'The Globe and Mail', 'Homepage + Food section native', 'Contextual: food, family, holiday', 'Sign-ups / CPA', 'CPM', 22, 40_000, 'performance'),
    line('lapresse', 'off_app', 'La Presse', 'Native + display, French creative', 'Quebec readers, contextual food and family', 'Sign-ups / CPA', 'CPM', 20, 30_000, 'performance'),
    line('ttd', 'programmatic', 'The Trade Desk', 'Display + native retargeting', 'Site visitors without a pass, cart abandoners', 'Sign-ups / CPA', 'CPM', 6, 90_000, 'performance'),
    line('spotify', 'digital_audio', 'Spotify', 'Audio :30 + companion banner', 'A18-44 holiday playlist listeners', 'Reach / listen-through', 'CPM', 20, 25_000, 'awareness'),
    line('adserving', 'ad_serving', 'CM360 / DoubleVerify', 'Ad serving, brand safety, viewability', 'All lines', 'Non-working media', 'Flat', 0, 20_000, 'non_working'),
    line('reserve', 'reserve', 'TBD', 'Held; released only with client sign-off', '—', 'Scale best performer', 'TBD', 0, 70_000, 'reserve')
  ],
  weeks: [
    { weight: 0.12, moment: 'Launch / early deals' },
    { weight: 0.16, moment: 'Pre-Black Friday' },
    { weight: 0.24, moment: 'Black Friday week (11/27)' },
    { weight: 0.2, moment: 'Cyber Monday (11/30)' },
    { weight: 0.16, moment: 'Mid-December gifting' },
    { weight: 0.12, moment: 'Last delivery slots before the holidays' }
  ],
  heldLineIds: ['reserve'],
  creatives: [
    { id: 'cr-1', filename: 'pcexpress_300x250_en.jpg', format: '300x250', sizeKb: 92, eligibleSurfaces: FORMAT_SURFACES['300x250'], language: 'en' },
    { id: 'cr-2', filename: 'pcexpress_728x90_en.jpg', format: '728x90', sizeKb: 70, eligibleSurfaces: FORMAT_SURFACES['728x90'], language: 'en' },
    { id: 'cr-3', filename: 'pcexpress_app_tile_en.json', format: 'app_native', sizeKb: 16, eligibleSurfaces: FORMAT_SURFACES.app_native, language: 'en' },
    { id: 'cr-4', filename: 'pcexpress_300x250_fr.jpg', format: '300x250', sizeKb: 95, eligibleSurfaces: FORMAT_SURFACES['300x250'], language: 'fr-CA' },
    { id: 'cr-5', filename: 'pcexpress_native_fr.json', format: 'web_native', sizeKb: 12, eligibleSurfaces: FORMAT_SURFACES.web_native, language: 'fr-CA' }
  ],
  notes: [
    'Rates are estimated net rates based on 2025 holiday benchmarks; final rates confirmed at IO.',
    'Est. Impressions = Budget ÷ CPM × 1,000. Est. Clicks = Budget ÷ CPC. Black Friday week CPMs typically run 20–40% higher.',
    'Sign-up attribution uses Loblaw first-party membership data (7-day click / 1-day view); platform-reported conversions are directional only.',
    'Quebec delivery requires French creative on every line that reaches Quebec (Charter of the French Language). La Presse runs French only.',
    'Test & Learn Reserve (CA$70K) is not committed. Agency will recommend a reallocation after the Week 2 read; funds move only with written client approval.',
    'Creative: client to deliver final :15/:30 video, social cut-downs, audio and French versions by 10/26/26 for trafficking and QA.'
  ],
  approval: { name: '', title: '', date: '' }
};

// Where each line stood on the morning of day 15, as a multiple of planned spend to date,
// and its cost per sign-up as a multiple of the CA$22 target.
const STANDING: Record<string, { pace: number; cpa: number; imprPerDollar: number; note: string }> = {
  ctv: { pace: 0.82, cpa: 2.5, imprPerDollar: 29, note: 'Underpacing: loosened frequency cap 3→4/wk, added Crave + Tubi private deals. Recheck tomorrow.' },
  yt: { pace: 0.98, cpa: 2.1, imprPerDollar: 72, note: '' },
  meta: { pace: 1.15, cpa: 1.03, imprPerDollar: 105, note: 'Overpacing + CPA rising. Paused 2 fatigued ads; shifted CA$15K to TikTok. New creative requested.' },
  tiktok: { pace: 0.98, cpa: 0.88, imprPerDollar: 126, note: 'Best social CPA. Receiving CA$15K from Meta.' },
  google: { pace: 0.99, cpa: 0.82, imprPerDollar: 0, note: 'Competitor bidding on "PC Express Pass free trial"; raised brand bids 15%, added negatives ("cancel PC Express").' },
  msft: { pace: 0.86, cpa: 0.83, imprPerDollar: 0, note: 'Slightly under: expanded to broad match on top 20 non-brand terms.' },
  onsite: { pace: 0.93, cpa: 0.8, imprPerDollar: 70, note: 'Takeover inventory sold out on 11/20; Jev flagged at planning that this line asked for more than exists.' },
  inapp: { pace: 0.84, cpa: 0.76, imprPerDollar: 82, note: 'App offer tiles capped by sessions. Cheapest sign-ups in the plan but cannot absorb more.' },
  globe: { pace: 1.01, cpa: 0.95, imprPerDollar: 45, note: '' },
  lapresse: { pace: 0.97, cpa: 0.9, imprPerDollar: 50, note: 'French creative live 11/9. Quebec sign-ups tracking with the rest of Canada.' },
  ttd: { pace: 1.02, cpa: 0.97, imprPerDollar: 199, note: '' },
  spotify: { pace: 0.99, cpa: 2.35, imprPerDollar: 55, note: '' },
  adserving: { pace: 0.92, cpa: 0, imprPerDollar: 0, note: 'Non-working; bills on delivered impressions.' },
  reserve: { pace: 0, cpa: 0, imprPerDollar: 0, note: 'Held. Recommending CA$50K → CTV for Hockey Night in Canada on 11/28 and 12/5 (pending client approval).' }
};

function seedPacing(): Pacing {
  const pace: Pacing = { dataThrough: '2026-11-23', overPace: 1.1, underPace: 0.9, actuals: {} };
  for (const l of SEED_PLAN.lines) {
    const s = STANDING[l.id];
    const planned = paceLine(SEED_PLAN, pace, l).planned;
    const spend = Math.round((planned * s.pace) / 100) * 100;
    pace.actuals[l.id] = {
      spend,
      yesterday: Math.round((spend / 15) * 1.1 / 50) * 50,
      impressions: Math.round((spend * s.imprPerDollar) / 1000) * 1000,
      conversions: s.cpa > 0 ? Math.round(spend / (SEED_PLAN.targetCpa * s.cpa) / 10) * 10 : 0,
      note: s.note
    };
  }
  return pace;
}

export const SEED_PACING: Pacing = seedPacing();

export const SEED_REPORT: WeeklyReport = {
  number: 2,
  sentDate: '2026-11-24',
  headline: '',
  summary: [],
  changes: [
    '**CTV (82% paced):** raised the frequency cap from 3 to 4 per week and added Crave and Tubi private deals. Delivery should be back in range by 11/27.',
    '**Meta (115% paced, CPA rising):** paused two ads showing creative fatigue (frequency 4.8, CTR down 22%) and moved CA$15K to TikTok, which is converting cheaper. Spend stays within the approved social total.',
    '**Google search:** a competitor began bidding on "PC Express Pass free trial". We raised brand bids 15% and added negative keywords (e.g. "cancel PC Express").',
    '**Retail in-app and onsite:** both are delivering the cheapest sign-ups in the plan and both are out of inventory, as Jev flagged at planning. We are not bidding harder into supply that does not exist.',
    '**Brand safety:** DoubleVerify flagged 0.8% of display impressions next to product-recall news. That category is now blocked, with no impact on delivery.'
  ],
  decisions: [
    {
      request: 'Approve CA$50K from the Test & Learn Reserve → CTV (Hockey Night in Canada, 11/28 and 12/5)',
      why: 'Highest-reach TV moments of the flight; the added reach supports the Black Friday push. Reserve would drop to CA$20K.',
      neededBy: 'Wed 11/25, 12pm ET',
      highlight: true
    },
    {
      request: 'Approve 2 new Meta creative variants (Cyber Monday cut-downs), English and French',
      why: 'Replaces the fatigued ads before the Cyber Monday cost spike',
      neededBy: 'Fri 11/27',
      highlight: false
    }
  ],
  comingUp: [],
  footer: 'Questions? Reply to this email or reach your campaign manager directly. The full line-item detail is in the attached media plan.'
};

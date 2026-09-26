import type { SurfaceId } from '$lib/placements';
import type { ClientId, Market } from '$lib/portfolio';

export type SurfaceLine = {
  surface: SurfaceId;
  retailer?: string;
  audience: string;

  allocatedEur: number;

  deliveredEur: number;
  cpaEur: number;
  ctr: number;
  bidVsJustified: number;

  ctrChangePct: number;

  frequency: number;

  frequencyChangePct: number;

  attributedSalesEur: number;

  discrepancyPct: number;

  ivtPct: number;
  note?: string;
};

export type MeasurementBasis = {
  attributionWindowDays: number;

  ntbLookbackDays: number;
  impressionBasis: 'served' | 'viewable';
};

export const DEFAULT_MEASUREMENT: MeasurementBasis = {
  attributionWindowDays: 14,
  ntbLookbackDays: 365,
  impressionBasis: 'viewable'
};

export type Campaign = {
  id: string;
  clientId: ClientId;
  name: string;
  objective: string;
  targetCpaEur: number;
  budgetEur: number;
  flightDays: number;
  day: number;
  market: Market;
  lines: SurfaceLine[];
  headline: string;

  measurement?: MeasurementBasis;
};

function line(
  surface: SurfaceId,
  retailer: string | undefined,
  audience: string,
  allocatedEur: number,
  deliveredEur: number,
  cpaEur: number,
  ctr: number,
  bidVsJustified = 1,
  ctrChangePct = 0,
  note?: string,
  extra: Partial<Pick<SurfaceLine, 'frequency' | 'frequencyChangePct' | 'attributedSalesEur' | 'discrepancyPct' | 'ivtPct'>> = {}
): SurfaceLine {
  const conversions = deliveredEur / cpaEur;
  return {
    surface, retailer, audience, allocatedEur, deliveredEur, cpaEur, ctr, bidVsJustified, ctrChangePct, note,
    frequency: extra.frequency ?? 3.4,
    frequencyChangePct: extra.frequencyChangePct ?? 0,

    attributedSalesEur: extra.attributedSalesEur ?? Math.round(conversions * 46),
    discrepancyPct: extra.discrepancyPct ?? 3.1,
    ivtPct: extra.ivtPct ?? 1.4
  };
}

export function metrics(c: Campaign) {
  const allocated = c.lines.reduce((s, l) => s + l.allocatedEur, 0);
  const delivered = c.lines.reduce((s, l) => s + l.deliveredEur, 0);
  const conversions = c.lines.reduce((s, l) => s + l.deliveredEur / l.cpaEur, 0);
  const cpa = conversions > 0 ? delivered / conversions : 0;
  const evenPace = (c.budgetEur / c.flightDays) * c.day;
  const pacing = evenPace > 0 ? delivered / evenPace : 0;
  const underfillEur = Math.max(0, allocated - delivered);
  const underfillPct = allocated > 0 ? underfillEur / allocated : 0;
  const attributedSales = c.lines.reduce((s, l) => s + l.attributedSalesEur, 0);
  const roas = delivered > 0 ? attributedSales / delivered : 0;
  const maxDiscrepancy = Math.max(0, ...c.lines.map((l) => l.discrepancyPct));
  const maxIvt = Math.max(0, ...c.lines.map((l) => l.ivtPct));
  const spendAtRisk = c.lines
    .filter((l) => l.cpaEur > c.targetCpaEur)
    .reduce((s, l) => s + l.deliveredEur * ((l.cpaEur - c.targetCpaEur) / l.cpaEur), 0);
  return {
    allocated,
    delivered,
    conversions: Math.round(conversions),
    cpa: Number(cpa.toFixed(2)),
    cpaVsTargetPct: Number((((cpa - c.targetCpaEur) / c.targetCpaEur) * 100).toFixed(1)),
    pacing: Number(pacing.toFixed(3)),
    underfillEur: Math.round(underfillEur),
    underfillPct: Number(underfillPct.toFixed(3)),
    attributedSales: Math.round(attributedSales),
    roas: Number(roas.toFixed(2)),
    maxDiscrepancy: Number(maxDiscrepancy.toFixed(1)),

    discrepancyBreachesContract: maxDiscrepancy > 10,
    discrepancyBreachesMrc: maxDiscrepancy > 5,
    maxIvt: Number(maxIvt.toFixed(1)),
    ivtBreachesMrc: maxIvt > 5,
    daysRemaining: c.flightDays - c.day,
    spendAtRisk: Math.round(spendAtRisk)
  };
}

const gmCheerios: Campaign = {
  id: 'generalmills-pantry-reset',
  clientId: 'generalmills',
  name: 'Cheerios pantry reset',
  objective: 'Drive household penetration on the family-size Cheerios range ahead of the pantry reset',
  targetCpaEur: 9.5,
  budgetEur: 420_000,
  flightDays: 28,
  day: 12,
  market: 'US',
  headline:
    'Walmart Connect onsite is bid to the ceiling and still cannot spend its allocation. 76,000 dollars of the plan has nowhere to go, and the only surface with supply left costs nearly twice as much per acquisition.',
  lines: [
    line('sponsored_display', 'Walmart', 'Cereal and breakfast category browsers', 180_000, 104_000, 7.9, 0.0088, 1.0, 0,
      'Bid raised twice, win rate flat. This is inventory scarcity, not a bidding problem'),
    line('sponsored_display', 'Target', 'Search: cereal, oatmeal, breakfast', 92_000, 92_000, 8.6, 0.0101, 1.0, 0, 'Fully delivered'),
    line('in_app', 'Walmart', 'Walmart app, pantry basket affinity', 74_000, 74_000, 9.9, 0.0069, 1.0, 0, 'Fully delivered, no headroom'),
    line('offsite', undefined, 'Walmart audience extension, open web', 48_000, 48_000, 16.2, 0.002, 1.0, 0,
      'Available at scale, CPA 105 percent above the onsite equivalent')
  ]
};

const folgersClassic: Campaign = {
  id: 'folgers-classic-roast',
  clientId: 'folgers',
  name: 'Classic Roast always-on',
  objective: 'Defend share against private label in ground coffee',
  targetCpaEur: 9.5,
  budgetEur: 560_000,
  flightDays: 90,
  day: 41,
  market: 'CA',
  headline:
    'Offsite is a third of spend at double the target CPA while Kroger onsite still has fill headroom. Its click through rate is falling too, but frequency is up 41 percent, so that is audience exhaustion rather than creative wearout.',
  lines: [
    line('sponsored_display', 'Kroger', 'Coffee category browsers', 96_000, 91_200, 7.8, 0.0094, 1.0, 0, 'Fill rate 95 percent, headroom available'),
    line('in_app', 'Loblaw', 'PC Optimum members, coffee repertoire', 62_000, 60_100, 9.2, 0.0079),
    line('offsite', undefined, 'Kroger audience extension', 88_000, 88_000, 19.6, 0.0018, 1.18, -24,
      'Bid 18 percent above the level its CPA justifies, and 106 percent above target CPA on a third of spend. CTR is falling but frequency is up 41 percent, so this is audience exhaustion',
      { frequency: 7.8, frequencyChangePct: 41, discrepancyPct: 11.4 })
  ]
};

const kraftKetchup: Campaign = {
  id: 'kraftheinz-grilling',
  clientId: 'kraftheinz',
  name: 'Heinz grilling season',
  objective: 'Hold volume through the grilling season',
  targetCpaEur: 7.5,
  budgetEur: 235_000,
  flightDays: 60,
  day: 33,
  market: 'US',
  headline: 'On plan on every surface.',
  lines: [
    line('sponsored_display', 'Kroger', 'Condiments and grilling browsers', 64_000, 62_500, 6.8, 0.0099),
    line('in_app', 'Walmart', 'Walmart app, grilling basket affinity', 34_000, 33_200, 7.1, 0.0086),
    line('offsite', undefined, 'Kroger audience extension', 29_000, 28_500, 8.9, 0.003)
  ]
};

const danoneOikos: Campaign = {
  id: 'danone-oikos-protein',
  clientId: 'danone',
  name: 'Oikos protein launch',
  objective: 'Drive trial of the high-protein Oikos 4 pack',
  targetCpaEur: 13.0,
  budgetEur: 280_000,
  flightDays: 30,
  day: 13,
  market: 'CA',
  headline: 'In-app has lost a third of its click through rate in four days at flat frequency, which is the frequency-matched case for creative wearout.',
  lines: [
    line('sponsored_display', 'Kroger', 'Yogurt and dairy category browsers', 52_000, 51_000, 11.2, 0.0076),
    line('in_app', 'Loblaw', 'PC Optimum, breakfast basket affinity', 44_000, 43_600, 14.8, 0.0039, 1.0, -31,
      'Same creative serving for 13 days. Frequency flat, so the CTR fall is not simply audience exhaustion',
      { frequency: 4.1, frequencyChangePct: 2 }),
    line('offsite', undefined, 'Kroger audience extension, lookalike 2 percent', 32_000, 31_000, 15.4, 0.0023)
  ]
};

const cloroxWipes: Campaign = {
  id: 'clorox-wipes-peak',
  clientId: 'clorox',
  name: 'Disinfecting wipes peak',
  objective: 'Capture the cold and flu season peak',
  targetCpaEur: 6.5,
  budgetEur: 190_000,
  flightDays: 30,
  day: 22,
  market: 'US',
  headline:
    'Every surface is at or under target CPA and every one is out of supply, so no efficiency lever has anything left to pull. At this burn the budget is gone on day 26 of a 30 day flight.',
  lines: [
    line('sponsored_display', 'Walmart', 'Household cleaning browsers', 72_000, 71_400, 5.9, 0.0108, 1.0, 0, 'At full available supply'),
    line('in_app', 'Albertsons', 'Albertsons app, household basket', 51_000, 50_600, 6.2, 0.0091, 1.0, 0, 'At full available supply'),
    line('offsite', undefined, 'Albertsons audience extension', 38_000, 37_700, 6.4, 0.0036, 1.0, 0, 'Already widened, further widening breaches target')
  ]
};

const fritoDoritos: Campaign = {
  id: 'fritolay-game-day',
  clientId: 'fritolay',
  name: 'Doritos game day',
  objective: 'Own the game day snacking occasion',
  targetCpaEur: 5.5,
  budgetEur: 165_000,
  flightDays: 45,
  day: 19,
  market: 'US',
  headline: 'Slight CPA drift on one surface, nothing out of tolerance yet.',
  lines: [
    line('sponsored_display', 'Target', 'Salty snacks browsers', 38_000, 37_400, 5.1, 0.0118),
    line('in_app', 'Albertsons', 'Albertsons app, snacking affinity', 22_000, 21_700, 5.9, 0.009),
    line('offsite', undefined, 'Target audience extension', 12_000, 11_850, 7.2, 0.0039, 1.06)
  ]
};

export const FEATURED: Campaign[] = [
  gmCheerios,
  folgersClassic,
  danoneOikos,
  cloroxWipes,
  fritoDoritos,
  kraftKetchup
];

const FILLER_SPECS: [ClientId, string, string, number, number, number, number, Market][] = [
  ['generalmills', 'Nature Valley bars weekly', 'Weekly volume on granola bars', 8.0, 190_000, 60, 27, 'US'],
  ['generalmills', 'Pillsbury holiday baking', 'Own the holiday baking occasion', 7.5, 240_000, 45, 21, 'US'],
  ['generalmills', 'Annie\'s organic trial', 'Trial in organic mac and cheese', 14.0, 96_000, 30, 11, 'CA'],
  ['kraftheinz', 'Kraft Mac and Cheese staple', 'Defend the core SKU', 6.5, 280_000, 90, 52, 'US'],
  ['kraftheinz', 'Philadelphia cross-sell', 'Cross-sell into spreads', 9.0, 168_000, 45, 18, 'US'],
  ['kraftheinz', 'Lunchables back to school', 'Back to school occasion', 11.5, 124_000, 30, 14, 'US'],
  ['fritolay', 'Lay\'s summer grilling', 'Summer snacking occasions', 5.8, 152_000, 60, 44, 'US'],
  ['fritolay', 'Tostitos dip pairing', 'Basket pairing with dips', 6.4, 88_000, 45, 16, 'US'],
  ['fritolay', 'SunChips better-for-you', 'Premium tier awareness', 10.5, 74_000, 30, 9, 'CA'],
  ['danone', 'Silk plant-based weekly', 'Weekly volume on plant-based milk', 6.9, 210_000, 90, 61, 'US'],
  ['danone', 'Activia gut health', 'Grow the digestive health line', 12.5, 106_000, 45, 23, 'CA'],
  ['clorox', 'Pine-Sol spring cleaning', 'Own spring cleaning', 7.2, 196_000, 60, 31, 'US'],
  ['clorox', 'Burt\'s Bees lip care', 'Range awareness', 9.1, 98_000, 30, 12, 'US'],
  ['clorox', 'Glad kitchen bags', 'Multipack volume', 6.0, 138_000, 45, 26, 'CA'],
  ['folgers', 'Folgers instant trial', 'Trial on instant', 8.4, 86_000, 45, 17, 'US'],
  ['folgers', 'Cafe Bustelo espresso', 'Hold share in espresso', 9.8, 116_000, 60, 38, 'US'],
  ['folgers', 'Dunkin at-home beans', 'Grow at-home beans', 10.6, 158_000, 45, 19, 'US'],
  ['danone', 'Horizon organic kids', 'Kids dairy occasions', 11.2, 94_000, 30, 8, 'CA']
];

function fillerCampaign(
  [clientId, name, objective, targetCpa, budget, flight, day, market]: (typeof FILLER_SPECS)[number],
  i: number
): Campaign {
  const wobble = ((i * 7) % 11) / 100;
  const spentShare = (day / flight) * (0.97 + wobble * 0.4);
  const spend = Math.round(budget * spentShare);
  const split = [0.45, 0.32, 0.23];
  const cpaFactor = [0.82 + wobble, 0.93 + wobble, 1.0 + wobble * 0.5];
  const fill = [0.98, 0.97, 0.99];
  const surfaces: SurfaceId[] = ['sponsored_display', 'in_app', 'offsite'];

  return {
    id: `${clientId}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    clientId,
    name,
    objective,
    targetCpaEur: targetCpa,
    budgetEur: budget,
    flightDays: flight,
    day,
    market,
    headline: 'On plan on every surface.',
    lines: surfaces.map((surface, s) => {
      const delivered = Math.round(spend * split[s]);
      return line(
        surface,
        undefined,
        surface === 'offsite' ? 'Retailer audience extension' : 'Category browsers',
        Math.round(delivered / fill[s]),
        delivered,
        Number((targetCpa * cpaFactor[s]).toFixed(2)),
        0.006
      );
    })
  };
}

export const CAMPAIGNS: Campaign[] = [
  ...FEATURED,
  ...FILLER_SPECS.map((spec, i) => fillerCampaign(spec, i))
];

export function campaignById(id: string): Campaign | undefined {
  return CAMPAIGNS.find((c) => c.id === id);
}

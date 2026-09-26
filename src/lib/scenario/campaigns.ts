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
  // The situation in a few words, for the Inbox card. The headline stays the detail.
  summary?: string;

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

const mccainFries: Campaign = {
  id: 'mccain-freezer-reset',
  summary: 'Walmart onsite ran out of inventory',
  clientId: 'mccain',
  name: 'Superfries freezer reset',
  objective: 'Drive household penetration on the family-size Superfries range ahead of the freezer reset',
  targetCpaEur: 9.5,
  budgetEur: 420_000,
  flightDays: 28,
  day: 25,
  market: 'CA',
  headline:
    'Walmart Connect onsite is bid to the ceiling and still cannot spend its allocation. CA$76,000 of the plan has nowhere to go, the Taboola deal is already at its cap, and the only surface with supply left is programmatic at nearly twice the cost per acquisition.',
  lines: [
    line('sponsored_display', 'Walmart Canada', 'Frozen potato and sides browsers', 180_000, 104_000, 7.9, 0.0088, 1.0, 0,
      'Bid raised twice, win rate flat. This is inventory scarcity, not a bidding problem'),
    line('sponsored_display', 'Metro', 'Search: fries, frozen sides, family meals', 92_000, 92_000, 8.6, 0.0101, 1.0, 0, 'Fully delivered'),
    line('in_app', 'Walmart Canada', 'Walmart app, freezer basket affinity', 74_000, 74_000, 9.9, 0.0069, 1.0, 0, 'Fully delivered, no headroom'),
    line('off_app', 'Taboola', 'Family meal recipe readers, native', 18_000, 18_000, 12.4, 0.0031, 1.0, 0, 'Publisher deal delivered to its cap'),
    line('programmatic', 'The Trade Desk', 'Walmart audience extension, open web and CTV', 30_000, 30_000, 16.2, 0.002, 1.0, 0,
      'Available at scale, CPA 105 percent above the onsite equivalent')
  ]
};

const timsOriginal: Campaign = {
  id: 'timhortons-original-blend',
  summary: 'Programmatic costs double the target',
  clientId: 'timhortons',
  name: 'Original Blend always-on',
  objective: 'Defend share against private label in ground coffee',
  targetCpaEur: 9.5,
  budgetEur: 560_000,
  flightDays: 90,
  day: 41,
  market: 'CA',
  headline:
    'Programmatic is a third of spend at double the target CPA while Sobeys onsite still has fill headroom. Its click through rate is falling too, but frequency is up 41 percent, so that is audience exhaustion rather than creative wearout.',
  lines: [
    line('sponsored_display', 'Sobeys', 'Coffee category browsers', 96_000, 91_200, 7.8, 0.0094, 1.0, 0, 'Fill rate 95 percent, headroom available'),
    line('in_app', 'Loblaw', 'PC Optimum members, coffee repertoire', 62_000, 60_100, 9.2, 0.0079),
    line('programmatic', 'DV360', 'Sobeys audience extension', 88_000, 88_000, 19.6, 0.0018, 1.18, -24,
      'Bid 18 percent above the level its CPA justifies, and 106 percent above target CPA on a third of spend. CTR is falling but frequency is up 41 percent, so this is audience exhaustion',
      { frequency: 7.8, frequencyChangePct: 41, discrepancyPct: 11.4 })
  ]
};

const mapleLeafGrilling: Campaign = {
  id: 'mapleleaf-grilling',
  summary: 'On plan everywhere',
  clientId: 'mapleleaf',
  name: 'Schneiders grilling season',
  objective: 'Hold volume on sausages and burgers through the grilling season',
  targetCpaEur: 7.5,
  budgetEur: 235_000,
  flightDays: 60,
  day: 33,
  market: 'CA',
  headline: 'On plan on every surface.',
  lines: [
    line('sponsored_display', 'Sobeys', 'BBQ and grilling browsers', 64_000, 62_500, 6.8, 0.0099),
    line('in_app', 'Walmart Canada', 'Walmart app, grilling basket affinity', 34_000, 33_200, 7.1, 0.0086),
    line('off_app', 'The Globe and Mail', 'Food and drink section readers', 11_000, 10_800, 7.3, 0.0041),
    line('programmatic', 'The Trade Desk', 'Sobeys audience extension', 18_000, 17_700, 8.9, 0.003)
  ]
};

const natrelProtein: Campaign = {
  id: 'agropur-natrel-protein',
  summary: 'In-app creative is wearing out',
  clientId: 'agropur',
  name: 'Natrel protein milk launch',
  objective: 'Drive trial of the new high-protein Natrel milk',
  targetCpaEur: 13.0,
  budgetEur: 280_000,
  flightDays: 30,
  day: 13,
  market: 'CA',
  headline: 'In-app has lost a third of its click through rate in four days at flat frequency, which is the frequency-matched case for creative wearout.',
  lines: [
    line('sponsored_display', 'Sobeys', 'Dairy category browsers', 52_000, 51_000, 11.2, 0.0076),
    line('in_app', 'Loblaw', 'PC Optimum, breakfast basket affinity', 44_000, 43_600, 14.8, 0.0039, 1.0, -31,
      'Same creative serving for 13 days. Frequency flat, so the CTR fall is not simply audience exhaustion',
      { frequency: 4.1, frequencyChangePct: 2 }),
    line('off_app', 'La Presse', 'Food and wellness readers, Quebec, French creative', 12_000, 11_600, 12.6, 0.0034),
    line('programmatic', 'DV360', 'Sobeys audience extension, lookalike 2 percent', 20_000, 19_400, 15.4, 0.0023)
  ]
};

const scottiesPeak: Campaign = {
  id: 'kruger-scotties-peak',
  summary: 'Budget runs out 4 days early',
  clientId: 'kruger',
  name: 'Scotties cold and flu peak',
  objective: 'Capture the cold and flu season peak on facial tissue',
  targetCpaEur: 6.5,
  budgetEur: 190_000,
  flightDays: 30,
  day: 22,
  market: 'CA',
  headline:
    'Every surface is at or under target CPA and every one is out of supply, so no efficiency lever has anything left to pull. At this burn the budget is gone on day 26 of a 30 day flight.',
  lines: [
    line('sponsored_display', 'Walmart Canada', 'Cough, cold and tissue browsers', 72_000, 71_400, 5.9, 0.0108, 1.0, 0, 'At full available supply'),
    line('in_app', 'Shoppers Drug Mart', 'PC Optimum app, cold and flu basket', 51_000, 50_600, 6.2, 0.0091, 1.0, 0, 'At full available supply'),
    line('off_app', 'Taboola', 'Health content readers, native', 14_000, 13_900, 6.3, 0.0038, 1.0, 0, 'Publisher deal at its cap'),
    line('programmatic', 'The Trade Desk', 'Shoppers Drug Mart audience extension', 24_000, 23_800, 6.4, 0.0036, 1.0, 0, 'Already widened, further widening breaches target')
  ]
};

const oldDutchGameDay: Campaign = {
  id: 'olddutch-game-day',
  summary: 'Slight cost drift on programmatic',
  clientId: 'olddutch',
  name: 'Old Dutch game day',
  objective: 'Own the game day snacking occasion',
  targetCpaEur: 5.5,
  budgetEur: 165_000,
  flightDays: 45,
  day: 19,
  market: 'CA',
  headline: 'Slight CPA drift on one surface, nothing out of tolerance yet.',
  lines: [
    line('sponsored_display', 'Metro', 'Salty snacks browsers', 38_000, 37_400, 5.1, 0.0118),
    line('in_app', 'Loblaw', 'PC Optimum app, snacking affinity', 22_000, 21_700, 5.9, 0.009),
    line('off_app', 'Taboola', 'Sports content readers, native', 4_000, 3_950, 6.8, 0.0042),
    line('programmatic', 'The Trade Desk', 'Metro audience extension', 8_000, 7_900, 7.2, 0.0039, 1.06)
  ]
};

export const FEATURED: Campaign[] = [
  mccainFries,
  timsOriginal,
  natrelProtein,
  scottiesPeak,
  oldDutchGameDay,
  mapleLeafGrilling
];

const FILLER_SPECS: [ClientId, string, string, number, number, number, number, Market][] = [
  ['mccain', 'Superfries weekly', 'Weekly volume on frozen fries', 8.0, 190_000, 60, 27, 'CA'],
  ['mccain', 'Deep n Delicious holiday', 'Own the holiday dessert occasion', 7.5, 240_000, 45, 21, 'CA'],
  ['mccain', 'Plant-based sides trial', 'Trial in plant-based sides', 14.0, 96_000, 30, 11, 'CA'],
  ['mapleleaf', 'Maple Leaf bacon staple', 'Defend the core SKU', 6.5, 280_000, 90, 52, 'CA'],
  ['mapleleaf', 'Greenfield cross-sell', 'Cross-sell into natural meats', 9.0, 168_000, 45, 18, 'CA'],
  ['mapleleaf', 'Natural Selections back to school', 'Back to school lunch occasion', 11.5, 124_000, 30, 14, 'CA'],
  ['olddutch', 'Old Dutch summer grilling', 'Summer snacking occasions', 5.8, 152_000, 60, 44, 'CA'],
  ['olddutch', 'Arriba tortilla dip pairing', 'Basket pairing with dips', 6.4, 88_000, 45, 16, 'CA'],
  ['olddutch', 'Old Dutch baked better-for-you', 'Premium tier awareness', 10.5, 74_000, 30, 9, 'CA'],
  ['agropur', 'Natrel lactose-free weekly', 'Weekly volume on lactose-free milk', 6.9, 210_000, 90, 61, 'CA'],
  ['agropur', 'OKA cheese premium', 'Grow the specialty cheese line', 12.5, 106_000, 45, 23, 'CA'],
  ['kruger', 'SpongeTowels spring cleaning', 'Own spring cleaning', 7.2, 196_000, 60, 31, 'CA'],
  ['kruger', 'Cashmere range awareness', 'Range awareness', 9.1, 98_000, 30, 12, 'CA'],
  ['kruger', 'Purex bathroom tissue multipack', 'Multipack volume', 6.0, 138_000, 45, 26, 'CA'],
  ['timhortons', 'Tim Hortons pods trial', 'Trial on single-serve pods', 8.4, 86_000, 45, 17, 'CA'],
  ['timhortons', 'Dark Roast share hold', 'Hold share in dark roast', 9.8, 116_000, 60, 38, 'CA'],
  ['timhortons', 'Whole bean at-home', 'Grow at-home beans', 10.6, 158_000, 45, 19, 'CA'],
  ['agropur', 'Natrel organic kids', 'Kids dairy occasions', 11.2, 94_000, 30, 8, 'CA']
];

function fillerCampaign(
  [clientId, name, objective, targetCpa, budget, flight, day, market]: (typeof FILLER_SPECS)[number],
  i: number
): Campaign {
  const wobble = ((i * 7) % 11) / 100;
  const spentShare = (day / flight) * (0.97 + wobble * 0.4);
  const spend = Math.round(budget * spentShare);
  const split = [0.4, 0.28, 0.12, 0.2];
  const cpaFactor = [0.82 + wobble, 0.93 + wobble, 0.96 + wobble * 0.5, 1.0 + wobble * 0.5];
  const fill = [0.98, 0.97, 0.98, 0.99];
  const surfaces: SurfaceId[] = ['sponsored_display', 'in_app', 'off_app', 'programmatic'];
  const audiences: Record<SurfaceId, string> = {
    sponsored_display: 'Category browsers',
    in_app: 'Retailer app, category affinity',
    off_app: 'Publisher readers, contextual',
    programmatic: 'Retailer audience extension'
  };

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
        audiences[surface],
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

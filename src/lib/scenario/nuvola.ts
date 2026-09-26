import type { LineItem, Policy, Tick } from '$lib/domain';

export const POLICY: Policy = {
  objective: 'Drive trial of the high-protein Natrel range in Canada ahead of the spring reset',
  targetCpaEur: 14.0,
  pacingTolerance: [0.9, 1.15],
  budgetEur: 120_000,
  flightDays: 30,
  permittedLevers: [
    'shift_budget',
    'adjust_bid',
    'pause_placement',
    'swap_creative',
    'expand_audience',
    'escalate_to_client',
    'no_action'
  ],
  brandSafety: [
    'No adjacency to weight loss or diet content',
    'No user generated content placements',
    'Canada only. English and French creative required for Quebec'
  ],
  commitments: [
    'Continuous presence for all 30 days, no dark days',
    'No reduction below 80 percent of planned weekly weight without client approval'
  ]
};

export const ADVERTISER = {
  brand: 'Natrel',
  product: 'High-protein milk',
  market: 'Canada',
  agency: 'Northfield Media'
};

function li(
  id: string,
  platform: LineItem['platform'],
  audience: string,
  placement: string,
  shareOfSpend: number,
  cpaEur: number,
  ctr: number,
  headroom: number,
  bidVsJustified = 1,
  note?: string
): LineItem {
  return { id, platform, audience, placement, shareOfSpend, cpaEur, ctr, headroom, bidVsJustified, note };
}

export const TICKS: Tick[] = [
  {
    day: 9,
    budgetEur: 120_000,
    spendToDateEur: 46_800,
    pacingIndex: 1.3,
    cpaEur: 16.95,
    ctr: 0.0031,
    conversions: 2761,
    headline: 'Overspending against plan and missing CPA. The largest line item by spend is the worst performer, and the efficient lines still have room to absorb budget.',
    lineItems: [
      li('dv-grocery', 'DV360', 'IAB Shoppers > Grocery & Food', 'Open web display', 0.61, 24.1, 0.0026, 0.9),
      li('ttd-retarget', 'The Trade Desk', 'Walmart Canada: cart abandoners 30d', 'Display + native', 0.18, 9.2, 0.0068, 0.7),
      li('rm-dairy', 'Retail Media', 'Sobeys: dairy category browsers', 'Sponsored display', 0.14, 11.8, 0.0054, 0.55),
      li('dv-prospect', 'DV360', 'IAB Interest > Nutrition', 'Open web display', 0.07, 31.0, 0.0019, 0.95)
    ]
  },
  {
    day: 11,
    budgetEur: 120_000,
    spendToDateEur: 57_200,
    pacingIndex: 1.3,
    cpaEur: 14.54,
    ctr: 0.0037,
    conversions: 3933,
    headline: 'Budget moved to retargeting and CPA is improving, but retargeting is now exhausted. Every efficient line item is out of headroom, so there is nowhere left to shift budget to.',
    lineItems: [
      li('dv-grocery', 'DV360', 'IAB Shoppers > Grocery & Food', 'Open web display', 0.44, 23.6, 0.0027, 0.88, 1, 'Budget reduced on day 9'),
      li('ttd-retarget', 'The Trade Desk', 'Walmart Canada: cart abandoners 30d', 'Display + native', 0.33, 9.6, 0.0071, 0.03, 1, 'Budget increased on day 9. Segment is exhausted, win rate falling, cannot absorb more spend'),
      li('rm-dairy', 'Retail Media', 'Sobeys: dairy category browsers', 'Sponsored display', 0.16, 11.9, 0.0053, 0.06, 1, 'Near full category coverage'),
      li('dv-prospect', 'DV360', 'IAB Interest > Nutrition', 'Open web display', 0.07, 30.4, 0.0019, 0.9)
    ]
  },
  {
    day: 13,
    budgetEur: 120_000,
    spendToDateEur: 66_300,
    pacingIndex: 1.275,
    cpaEur: 14.62,
    ctr: 0.0041,
    conversions: 4535,
    headline: 'Lookalike expansion restored supply. CPA is still above target, and the best performing line item has lost a third of its click through rate in four days at flat frequency.',
    lineItems: [
      li('dv-grocery', 'DV360', 'IAB Shoppers > Grocery & Food', 'Open web display', 0.38, 23.1, 0.0027, 0.85),
      li('ttd-retarget', 'The Trade Desk', 'Walmart Canada: cart abandoners 30d', 'Display + native', 0.28, 10.1, 0.0049, 0.5, 1, 'CTR down 31 percent over four days at flat frequency. Creative has been serving 13 days'),
      li('ttd-lookalike', 'The Trade Desk', 'Walmart Canada lookalike: abandoner seed, 2 percent', 'Display + native', 0.12, 13.4, 0.0058, 0.6, 1, 'Added on day 11'),
      li('rm-dairy', 'Retail Media', 'Sobeys: dairy category browsers', 'Sponsored display', 0.15, 11.6, 0.0055, 0.4),
      li('dv-prospect', 'DV360', 'IAB Interest > Nutrition', 'Open web display', 0.07, 29.8, 0.0018, 0.88)
    ]
  },
  {
    day: 16,
    budgetEur: 120_000,
    spendToDateEur: 71_700,
    pacingIndex: 1.12,
    cpaEur: 13.82,
    ctr: 0.0052,
    conversions: 5187,
    headline: 'Creative refresh landed. Pacing is back inside tolerance, CPA is within two percent of target, no line item has lost click through rate, and nothing is out of headroom.',
    lineItems: [
      li('dv-grocery', 'DV360', 'IAB Shoppers > Grocery & Food', 'Open web display', 0.35, 15.1, 0.0034, 0.75),
      li('ttd-retarget', 'The Trade Desk', 'Walmart Canada: cart abandoners 30d', 'Display + native', 0.27, 12.4, 0.0079, 0.45, 1, 'Creative swapped on day 13, CTR recovered'),
      li('ttd-lookalike', 'The Trade Desk', 'Walmart Canada lookalike: abandoner seed, 2 percent', 'Display + native', 0.16, 13.9, 0.0061, 0.5),
      li('rm-dairy', 'Retail Media', 'Sobeys: dairy category browsers', 'Sponsored display', 0.15, 13.1, 0.0058, 0.35),
      li('dv-prospect', 'DV360', 'IAB Interest > Nutrition', 'Open web display', 0.07, 15.8, 0.0021, 0.85)
    ]
  },
  {
    day: 20,
    budgetEur: 120_000,
    spendToDateEur: 93_000,
    pacingIndex: 1.1625,
    cpaEur: 13.65,
    ctr: 0.0054,
    conversions: 6814,
    headline: 'Every line item is at or under target CPA and all of them are out of headroom, so there is no efficiency lever left to pull. At the current burn rate the budget is exhausted on day 25 against a 30 day flight . Correcting it means changing total budget or accepting five dark days, and neither is an agency decision.',
    lineItems: [
      li('dv-grocery', 'DV360', 'IAB Shoppers > Grocery & Food', 'Open web display', 0.34, 13.95, 0.0035, 0.08, 1, 'At full available supply for this segment'),
      li('ttd-retarget', 'The Trade Desk', 'Walmart Canada: cart abandoners 30d', 'Display + native', 0.27, 13.1, 0.0081, 0.05, 1, 'Segment exhausted'),
      li('ttd-lookalike', 'The Trade Desk', 'Walmart Canada lookalike: abandoner seed, 2 percent', 'Display + native', 0.17, 13.8, 0.0063, 0.06, 1, 'Already widened to 2 percent, further widening breaches the CPA target'),
      li('rm-dairy', 'Retail Media', 'Sobeys: dairy category browsers', 'Sponsored display', 0.15, 13.4, 0.0059, 0.04, 1, 'Full category coverage reached'),
      li('dv-prospect', 'DV360', 'IAB Interest > Nutrition', 'Open web display', 0.07, 13.9, 0.0022, 0.07, 1, 'At full available supply')
    ]
  },
  {
    day: 24,
    budgetEur: 150_000,
    spendToDateEur: 118_000,
    pacingIndex: 0.983,
    cpaEur: 15.31,
    ctr: 0.0051,
    conversions: 7708,
    headline:
      'Client approved a CA$30,000 uplift on day 20, taking the budget to CA$150,000. Pacing is back inside tolerance and every line item has headroom again. Blended CPA has drifted 9 percent above target, and it is driven by one line item that is a quarter of spend, bidding 24 percent above what its own CPA justifies.',
    lineItems: [
      li('dv-grocery', 'DV360', 'IAB Shoppers > Grocery & Food', 'Open web display', 0.3, 13.6, 0.0036, 0.6),
      li('ttd-retarget', 'The Trade Desk', 'Walmart Canada: cart abandoners 30d', 'Display + native', 0.23, 12.9, 0.0082, 0.35),
      li('ttd-lookalike', 'The Trade Desk', 'Walmart Canada lookalike: abandoner seed, 2 percent', 'Display + native', 0.15, 13.4, 0.0064, 0.4),
      li('rm-dairy', 'Retail Media', 'Sobeys: dairy category browsers', 'Sponsored display', 0.07, 13.2, 0.006, 0.28),
      li(
        'dv-prospect',
        'DV360',
        'IAB Interest > Nutrition',
        'Open web display',
        0.25,
        28.0,
        0.0023,
        0.55,
        1.24,
        'Bid is 24 percent above the level this line item CPA justifies. At 25 percent of spend it is the only line item above target and is the sole driver of the blended CPA drift'
      )
    ]
  }
];

export const BUDGET_UPLIFT_EUR = 30_000;

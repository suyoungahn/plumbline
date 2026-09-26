export type LeverId =
  | 'shift_budget'
  | 'adjust_bid'
  | 'pause_placement'
  | 'swap_creative'
  | 'expand_audience'
  | 'spill_to_offsite'
  | 'escalate_to_client'
  | 'no_action';

export const LEVERS: Record<LeverId, { label: string; meaning: string; agencyAuthority: boolean }> =
  {
    shift_budget: {
      label: 'Shift budget',
      meaning: 'Move budget between line items that are already live',
      agencyAuthority: true
    },
    adjust_bid: {
      label: 'Adjust bid',
      meaning: 'Raise or lower bids on existing line items',
      agencyAuthority: true
    },
    pause_placement: {
      label: 'Pause placement',
      meaning: 'Stop delivery on an underperforming placement or line item',
      agencyAuthority: true
    },
    swap_creative: {
      label: 'Swap creative',
      meaning: 'Replace the creative currently serving',
      agencyAuthority: true
    },
    spill_to_offsite: {
      label: 'Spill to programmatic',
      meaning:
        'Move allocation that a finite-supply surface (retailer onsite, retailer in-app or an off-app publisher deal) cannot deliver onto programmatic inventory, knowingly accepting a higher cost per outcome in order to recover the delivery',
      agencyAuthority: true
    },
    expand_audience: {
      label: 'Expand audience',
      meaning: 'Add or broaden an audience segment to increase reachable supply',
      agencyAuthority: true
    },
    escalate_to_client: {
      label: 'Escalate to client',
      meaning:
        'The correcting action changes total budget or campaign objective, which is the client decision and not the agency mandate',
      agencyAuthority: false
    },
    no_action: {
      label: 'No action',
      meaning: 'The campaign is within tolerance and should be left alone',
      agencyAuthority: true
    }
  };

export const SEVERITY_RUBRIC: string[] = [
  'On plan. No deviation worth an operator looking at it',
  'Minor drift, within tolerance, likely self correcting',
  'Material drift. Needs attention this week',
  'Serious. The objective is at risk without action today',
  'Critical. Budget is actively being wasted right now'
];

export const SEVERITY_MAX = SEVERITY_RUBRIC.length - 1;

export function severityLabel(score: number): string {
  const i = Math.min(SEVERITY_MAX, Math.max(0, Math.round(score)));
  return SEVERITY_RUBRIC[i];
}

export type LineItem = {
  id: string;
  platform: 'DV360' | 'The Trade Desk' | 'Retail Media' | 'Publisher direct';
  audience: string;
  placement: string;
  shareOfSpend: number;
  cpaEur: number;
  ctr: number;

  headroom: number;

  bidVsJustified: number;

  note?: string;
};

export type Policy = {
  objective: string;
  targetCpaEur: number;

  pacingTolerance: [number, number];
  budgetEur: number;
  flightDays: number;

  permittedLevers: LeverId[];
  brandSafety: string[];

  commitments: string[];
};

export type Tick = {
  day: number;

  budgetEur: number;
  spendToDateEur: number;
  pacingIndex: number;
  cpaEur: number;
  ctr: number;
  conversions: number;
  lineItems: LineItem[];

  headline: string;
};

export type Proposal = {
  id: string;
  day: number;

  gateProbability: number;

  gateOpen: boolean;
  lever: LeverId;

  leverDistribution: Record<string, number>;
  leverConfidence: number;

  severity: number;
  severityConfidence: number;
  targetLineItemId?: string;

  rationale?: string;
  costUsd: number;

  source: 'live' | 'replay' | 'sim';
};

export type Ruling = 'approved' | 'rejected' | 'auto_executed';

export type LedgerEntry = {
  proposal: Proposal;
  ruling: Ruling;
  ruledAt: string;

  ruledBy: 'operator' | 'threshold';
};

export type Thresholds = Record<LeverId, number>;

export const GATE_THRESHOLD = 0.5;

export function agreementRate(ledger: LedgerEntry[], lever: LeverId): number | null {
  const ruled = ledger.filter((e) => e.proposal.lever === lever && e.ruledBy === 'operator');
  if (ruled.length === 0) return null;
  return ruled.filter((e) => e.ruling === 'approved').length / ruled.length;
}

import { SEVERITY_RUBRIC } from '$lib/domain';
import type { JevQuestion } from '$lib/jev-types';

export type MatchType = 'exact' | 'phrase' | 'broad';

// The closed set Jev chooses from for every search term. Adding an action here is a
// product decision, the same way adding a campaign lever is.
export type TermActionId =
  | 'promote_to_exact'
  | 'add_negative'
  | 'raise_bid'
  | 'lower_bid'
  | 'escalate_to_client'
  | 'no_action';

export const TERM_ACTIONS: Record<TermActionId, { label: string; done: string; meaning: string }> = {
  promote_to_exact: {
    label: 'Promote to exact match',
    done: 'Promoted to exact match',
    meaning: 'The search term converts under target through a broad or phrase keyword. Add it as its own exact-match keyword so it can be bid on directly'
  },
  add_negative: {
    label: 'Add as negative',
    done: 'Added as negatives',
    meaning: 'Stop the ads showing for this search term, because it is irrelevant, unsafe for the brand, or has spent without selling'
  },
  raise_bid: {
    label: 'Raise bid',
    done: 'Bids raised',
    meaning: 'The term converts well under target CPA and more volume is worth buying'
  },
  lower_bid: {
    label: 'Lower bid',
    done: 'Bids lowered',
    meaning: 'The term converts, but above target CPA. Pay less for it rather than drop it'
  },
  escalate_to_client: {
    label: 'Ask the client',
    done: 'Sent to the client',
    meaning: 'The right action depends on client policy, such as bidding on a competitor or retailer private-label brand, which is not the agency decision to make'
  },
  no_action: {
    label: 'Leave it',
    done: 'Left alone',
    meaning: 'Not enough data to act, or already performing inside tolerance'
  }
};

export type SearchTerm = {
  id: string;
  campaignId: string;
  retailer: string;
  term: string;
  keyword: string;
  matchType: MatchType;
  language: 'en' | 'fr-CA';
  impressions: number;
  clicks: number;
  spendEur: number;
  conversions: number;
  salesEur: number;
};

export type TermDecision = {
  gateProbability: number;
  gateOpen: boolean;
  action: TermActionId;
  distribution: Record<string, number>;
  confidence: number;
  severity: number;
  costUsd: number;
  source: 'live' | 'replay' | 'sim';
};

export const TERM_QUESTIONS: Record<string, JevQuestion> = {
  gate: {
    type: 'noul',
    instructions:
      'Does this search term need the campaign manager to look at it before anything changes? Routine negatives, promotions and bid moves inside the agency mandate do not. A competitor or retailer private-label brand, a term on the brand-safety list, or material spend where the right action is genuinely unclear does.'
  },
  action: {
    type: 'choice',
    instructions: [
      'Which single action is right for this search term?',
      'Judge relevance from the search term against the product category terms. A term outside the category should be a negative however it performs.',
      'Fewer than 10 clicks is not enough evidence to act on.',
      'Promote to exact only when the term converts under target CPA through a broad or phrase keyword.',
      'A term that mentions a competitor or retailer private-label brand is a client policy question, not an optimisation.',
      'A term on the brand-safety list should not keep serving ads.'
    ].join(' '),
    criteria: Object.fromEntries(Object.entries(TERM_ACTIONS).map(([k, v]) => [k, v.meaning]))
  },
  severity: {
    type: 'score',
    instructions: 'How much money or brand risk is this search term carrying right now, judged against the target CPA?',
    criteria: SEVERITY_RUBRIC
  }
};

// Jev's published price per call, used to estimate the cost of a pass that ran on the
// heuristic stand-in instead.
export const JEV_COST_PER_CALL_USD = 0.00007;

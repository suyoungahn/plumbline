import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { askJev, resolveMode } from './jev';
import { GATE_THRESHOLD } from '$lib/domain';
import { TERM_QUESTIONS, type SearchTerm, type TermActionId, type TermDecision } from '$lib/keywords';
import type { Campaign } from '$lib/scenario/campaigns';
import { LEXICON } from '$lib/scenario/search-terms';
import { CLIENTS } from '$lib/portfolio';
import type { ChoiceAnswer, NoulAnswer, ScoreAnswer } from '$lib/jev-types';

const FIXTURE_DIR = join(process.cwd(), 'fixtures', 'jev');

export function termState(t: SearchTerm, c: Campaign) {
  const lex = LEXICON[c.clientId];
  const lower = t.term.toLowerCase();
  const cpa = t.conversions > 0 ? Number((t.spendEur / t.conversions).toFixed(2)) : null;
  return {
    kind: 'search_term',
    search_term: t.term,
    language: t.language,
    triggering_keyword: t.keyword,
    match_type: t.matchType,
    retailer: t.retailer,

    advertiser: CLIENTS[c.clientId].name,
    campaign_objective: c.objective,
    product_category_terms: lex.categoryWords,
    competitor_brands: lex.competitorBrands,
    brand_safety_list: lex.brandSafety,

    mentions_competitor_brand: lex.competitorBrands.some((b) => lower.includes(b)),
    on_brand_safety_list: lex.brandSafety.some((b) => lower.includes(b)),
    matches_category: lex.categoryWords.some((w) => lower.includes(w)),

    impressions: t.impressions,
    clicks: t.clicks,
    ctr: t.impressions > 0 ? Number((t.clicks / t.impressions).toFixed(4)) : 0,
    spend_eur: t.spendEur,
    conversions: t.conversions,
    cpa_eur: cpa,
    target_cpa_eur: c.targetCpaEur,
    cpa_vs_target_pct: cpa === null ? null : Number((((cpa - c.targetCpaEur) / c.targetCpaEur) * 100).toFixed(1)),
    attributed_sales_eur: t.salesEur,
    roas: t.spendEur > 0 ? Number((t.salesEur / t.spendEur).toFixed(2)) : 0
  };
}

export async function decideTerm(t: SearchTerm, c: Campaign): Promise<TermDecision> {
  const fixture = `kw-${t.id}`;
  // A search-term report is thousands of rows. Only call Jev when asked to explicitly;
  // otherwise replay what was recorded, and fall back to the heuristic for the rest.
  const mode =
    resolveMode() === 'live' ? 'live' : existsSync(join(FIXTURE_DIR, `${fixture}.json`)) ? 'replay' : 'sim';

  const result = await askJev(termState(t, c), TERM_QUESTIONS, { mode, fixture });
  const gate = result.answers.gate as NoulAnswer;
  const action = result.answers.action as ChoiceAnswer;
  const severity = result.answers.severity as ScoreAnswer;

  return {
    gateProbability: gate.probability,
    gateOpen: gate.probability >= GATE_THRESHOLD,
    action: action.selected as TermActionId,
    distribution: action.probabilities,
    confidence: action.confidence,
    severity: severity.score,
    costUsd: result.usage.cost,
    source: result.simulated ? 'sim' : result.replayed ? 'replay' : 'live'
  };
}

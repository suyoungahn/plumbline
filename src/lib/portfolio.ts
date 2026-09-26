export type Market = 'US' | 'CA';

export type ClientId = 'generalmills' | 'kraftheinz' | 'fritolay' | 'danone' | 'clorox' | 'folgers';

export const MANAGER = {
  name: 'Dana Whitfield',
  role: 'Campaign Manager, Retail Media',
  agency: 'Northfield Media',

  bookUsedToNeed: 3
};

export const CLIENTS: Record<
  ClientId,
  { name: string; category: string; retailers: string[]; markets: Market[] }
> = {
  generalmills: { name: 'General Mills', category: 'Cereal and baking', retailers: ['Walmart', 'Target'], markets: ['US', 'CA'] },
  kraftheinz: { name: 'Kraft Heinz', category: 'Condiments and sauces', retailers: ['Kroger', 'Walmart'], markets: ['US'] },
  fritolay: { name: 'Frito-Lay', category: 'Salty snacks', retailers: ['Target', 'Albertsons'], markets: ['US'] },
  danone: { name: 'Danone North America', category: 'Yogurt and dairy', retailers: ['Kroger', 'Loblaw'], markets: ['US', 'CA'] },
  clorox: { name: 'Clorox', category: 'Household cleaning', retailers: ['Walmart', 'Albertsons'], markets: ['US'] },
  folgers: { name: 'Folgers', category: 'Coffee', retailers: ['Kroger', 'Loblaw'], markets: ['US', 'CA'] }
};

export const REQUIRED_LANGUAGES: Record<Market, string[]> = {
  US: ['en'],
  CA: ['en', 'fr-CA']
};

export const MARKET_LABEL: Record<Market, string> = {
  US: 'United States',
  CA: 'Canada, including Quebec'
};

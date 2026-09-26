export type Market = 'CA';

export type ClientId = 'mccain' | 'mapleleaf' | 'olddutch' | 'agropur' | 'kruger' | 'timhortons' | 'loblaw';

export const MANAGER = {
  name: 'Suyoung Ahn',
  role: 'Campaign Manager, Retail Media',
  agency: 'Northfield Media',
  bookUsedToNeed: 3
};

export type ClientInfo = {
  name: string;
  category: string;
  retailers: string[];
  markets: Market[];
  contact?: { name: string; email: string };
  since?: string;
};

export const CLIENTS: Record<ClientId, ClientInfo> = {
  mccain: { name: 'McCain Foods', category: 'Frozen foods', retailers: ['Walmart Canada', 'Metro'], markets: ['CA'] },
  mapleleaf: { name: 'Maple Leaf Foods', category: 'Packaged meats', retailers: ['Sobeys', 'Walmart Canada'], markets: ['CA'] },
  olddutch: { name: 'Old Dutch Foods', category: 'Salty snacks', retailers: ['Metro', 'Loblaw'], markets: ['CA'] },
  agropur: { name: 'Agropur', category: 'Dairy', retailers: ['Sobeys', 'Loblaw'], markets: ['CA'] },
  kruger: { name: 'Kruger Products', category: 'Household paper', retailers: ['Walmart Canada', 'Shoppers Drug Mart'], markets: ['CA'] },
  timhortons: { name: 'Tim Hortons at-home', category: 'Coffee', retailers: ['Sobeys', 'Loblaw'], markets: ['CA'] },
  loblaw: { name: 'Loblaw (PC Express Pass)', category: 'Grocery delivery membership', retailers: ['Loblaw', 'Shoppers Drug Mart'], markets: ['CA'] }
};

export const REQUIRED_LANGUAGES: Record<Market, string[]> = {
  CA: ['en', 'fr-CA']
};

export const MARKET_LABEL: Record<Market, string> = {
  CA: 'Canada, including Quebec'
};

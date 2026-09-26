// Every figure in the scenario is Canadian dollars. Jev bills in US dollars, so
// decision costs are converted at a fixed illustrative rate.
export const CUR = 'CA$';
export const USD_TO_CAD = 1.37;

export const money = (n: number): string =>
  n >= 1_000_000 ? `${CUR}${(n / 1_000_000).toFixed(2)}M` : n >= 1000 ? `${CUR}${Math.round(n / 1000)}k` : `${CUR}${Math.round(n)}`;

export const dollars = (n: number): string => `${CUR}${n.toFixed(2)}`;

export const decisionCost = (usd: number): string => `${CUR}${(usd * USD_TO_CAD).toFixed(6)}`;

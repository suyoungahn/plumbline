import type { SurfaceId } from './placements';

export type SupplyPool = {
  // Who sells the inventory: a retailer for onsite and in-app, a publisher for
  // off-app, a buying platform for programmatic.
  retailer: string;
  network: string;
  surface: SurfaceId;

  monthlyCapacityEur: number;
  typicalCpaEur: number;

  committedPct: number;
};

export const SUPPLY: SupplyPool[] = [
  { retailer: 'Walmart Canada', network: 'Walmart Connect', surface: 'sponsored_display', monthlyCapacityEur: 620_000, typicalCpaEur: 8.4, committedPct: 0.71 },
  { retailer: 'Walmart Canada', network: 'Walmart Connect', surface: 'in_app', monthlyCapacityEur: 240_000, typicalCpaEur: 9.6, committedPct: 0.58 },
  { retailer: 'Metro', network: 'Metro retail media', surface: 'sponsored_display', monthlyCapacityEur: 310_000, typicalCpaEur: 9.1, committedPct: 0.64 },
  { retailer: 'Metro', network: 'Metro retail media', surface: 'in_app', monthlyCapacityEur: 128_000, typicalCpaEur: 10.4, committedPct: 0.47 },
  { retailer: 'Sobeys', network: 'Sobeys retail media', surface: 'sponsored_display', monthlyCapacityEur: 265_000, typicalCpaEur: 9.8, committedPct: 0.59 },
  { retailer: 'Sobeys', network: 'Sobeys retail media', surface: 'in_app', monthlyCapacityEur: 96_000, typicalCpaEur: 11.2, committedPct: 0.41 },
  { retailer: 'Shoppers Drug Mart', network: 'Loblaw Advance', surface: 'sponsored_display', monthlyCapacityEur: 142_000, typicalCpaEur: 10.2, committedPct: 0.52 },
  { retailer: 'Shoppers Drug Mart', network: 'Loblaw Advance', surface: 'in_app', monthlyCapacityEur: 54_000, typicalCpaEur: 11.9, committedPct: 0.36 },
  { retailer: 'Loblaw', network: 'Loblaw Advance', surface: 'sponsored_display', monthlyCapacityEur: 118_000, typicalCpaEur: 10.6, committedPct: 0.49 },
  { retailer: 'Loblaw', network: 'Loblaw Advance', surface: 'in_app', monthlyCapacityEur: 46_000, typicalCpaEur: 12.1, committedPct: 0.34 },

  { retailer: 'Taboola', network: 'Publisher direct, native', surface: 'off_app', monthlyCapacityEur: 180_000, typicalCpaEur: 13.2, committedPct: 0.3 },
  { retailer: 'The Globe and Mail', network: 'Publisher direct', surface: 'off_app', monthlyCapacityEur: 72_000, typicalCpaEur: 14.1, committedPct: 0.55 },
  { retailer: 'The New York Times', network: 'Publisher direct, Canadian audience', surface: 'off_app', monthlyCapacityEur: 48_000, typicalCpaEur: 15.0, committedPct: 0.4 },
  { retailer: 'La Presse', network: 'Publisher direct, French only', surface: 'off_app', monthlyCapacityEur: 40_000, typicalCpaEur: 13.8, committedPct: 0.45 },

  { retailer: 'The Trade Desk', network: 'Programmatic, audience extension', surface: 'programmatic', monthlyCapacityEur: 20_000_000, typicalCpaEur: 16.8, committedPct: 0 },
  { retailer: 'DV360', network: 'Programmatic, audience extension', surface: 'programmatic', monthlyCapacityEur: 20_000_000, typicalCpaEur: 17.2, committedPct: 0 }
];

export function availableEur(retailer: string, surface: SurfaceId, flightDays: number): number {
  const pool = SUPPLY.find((p) => p.retailer === retailer && p.surface === surface);
  if (!pool) return 0;
  return Math.round(pool.monthlyCapacityEur * (flightDays / 30) * (1 - pool.committedPct));
}

export function poolFor(retailer: string, surface: SurfaceId): SupplyPool | undefined {
  return SUPPLY.find((p) => p.retailer === retailer && p.surface === surface);
}

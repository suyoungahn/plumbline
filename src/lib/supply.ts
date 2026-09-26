import type { SurfaceId } from './placements';

export type SupplyPool = {
  retailer: string;
  network: string;
  surface: SurfaceId;

  monthlyCapacityEur: number;
  typicalCpaEur: number;

  committedPct: number;
};

export const SUPPLY: SupplyPool[] = [
  { retailer: 'Walmart', network: 'Walmart Connect', surface: 'sponsored_display', monthlyCapacityEur: 620_000, typicalCpaEur: 8.4, committedPct: 0.71 },
  { retailer: 'Walmart', network: 'Walmart Connect', surface: 'in_app', monthlyCapacityEur: 240_000, typicalCpaEur: 9.6, committedPct: 0.58 },
  { retailer: 'Target', network: 'Roundel', surface: 'sponsored_display', monthlyCapacityEur: 310_000, typicalCpaEur: 9.1, committedPct: 0.64 },
  { retailer: 'Target', network: 'Roundel', surface: 'in_app', monthlyCapacityEur: 128_000, typicalCpaEur: 10.4, committedPct: 0.47 },
  { retailer: 'Kroger', network: 'Kroger Precision Marketing', surface: 'sponsored_display', monthlyCapacityEur: 265_000, typicalCpaEur: 9.8, committedPct: 0.59 },
  { retailer: 'Kroger', network: 'Kroger Precision Marketing', surface: 'in_app', monthlyCapacityEur: 96_000, typicalCpaEur: 11.2, committedPct: 0.41 },
  { retailer: 'Albertsons', network: 'Albertsons Media Collective', surface: 'sponsored_display', monthlyCapacityEur: 142_000, typicalCpaEur: 10.2, committedPct: 0.52 },
  { retailer: 'Albertsons', network: 'Albertsons Media Collective', surface: 'in_app', monthlyCapacityEur: 54_000, typicalCpaEur: 11.9, committedPct: 0.36 },
  { retailer: 'Loblaw', network: 'Loblaw Media', surface: 'sponsored_display', monthlyCapacityEur: 118_000, typicalCpaEur: 10.6, committedPct: 0.49 },
  { retailer: 'Loblaw', network: 'Loblaw Media', surface: 'in_app', monthlyCapacityEur: 46_000, typicalCpaEur: 12.1, committedPct: 0.34 },

  { retailer: 'Open web (DV360, TTD)', network: 'Audience extension', surface: 'offsite', monthlyCapacityEur: 20_000_000, typicalCpaEur: 16.8, committedPct: 0 }
];

export function availableEur(retailer: string, surface: SurfaceId, flightDays: number): number {
  const pool = SUPPLY.find((p) => p.retailer === retailer && p.surface === surface);
  if (!pool) return 0;
  return Math.round(pool.monthlyCapacityEur * (flightDays / 30) * (1 - pool.committedPct));
}

export function poolFor(retailer: string, surface: SurfaceId): SupplyPool | undefined {
  return SUPPLY.find((p) => p.retailer === retailer && p.surface === surface);
}

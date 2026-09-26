export type SurfaceId = 'sponsored_display' | 'in_app' | 'offsite';

export const SURFACES: Record<
  SurfaceId,
  { label: string; short: string; where: string; supply: string; note: string }
> = {
  sponsored_display: {
    label: 'Sponsored display',
    short: 'Onsite',
    where: 'Retailer web and app, search and category pages',
    supply: 'Finite. Bounded by retailer traffic and shelf placements',
    note: 'Highest intent and lowest CPA, but it runs out. Bidding harder does not create more of it'
  },
  in_app: {
    label: 'In-app',
    short: 'In-app',
    where: 'Inside the retailer app, flyer and basket surfaces',
    supply: 'Finite. Bounded by app sessions',
    note: 'Strong intent, smaller pool, and heavily skewed to loyalty app users'
  },
  offsite: {
    label: 'Offsite',
    short: 'Offsite',
    where: 'Open web and CTV via DV360 and The Trade Desk, retailer audiences extended',
    supply: 'Effectively unbounded',
    note: 'Always available and always more expensive per outcome. The release valve when onsite underfills'
  }
};

export function underfillPct(allocatedEur: number, deliveredEur: number): number {
  if (allocatedEur <= 0) return 0;
  return Math.max(0, (allocatedEur - deliveredEur) / allocatedEur);
}

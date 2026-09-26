export type SurfaceId = 'sponsored_display' | 'in_app' | 'off_app' | 'programmatic';

export const SURFACES: Record<
  SurfaceId,
  { label: string; short: string; where: string; supply: string; note: string }
> = {
  sponsored_display: {
    label: 'Sponsored display',
    short: 'Onsite',
    where: 'Retailer websites: search, category and product pages',
    supply: 'Finite. Bounded by retailer traffic and shelf placements',
    note: 'Highest intent and lowest CPA, but it runs out. Bidding harder does not create more of it'
  },
  in_app: {
    label: 'In-app',
    short: 'In-app',
    where: 'Ad slots inside retailer apps (PC Optimum, Walmart, Sobeys, Metro): flyer, search and basket surfaces',
    supply: 'Finite. Bounded by app sessions',
    note: 'Strong intent, smaller pool, and heavily skewed to loyalty app users'
  },
  off_app: {
    label: 'Off-app publishers',
    short: 'Off-app',
    where: 'Publisher sites bought direct: Taboola, The Globe and Mail, The New York Times, La Presse',
    supply: 'Finite per deal. Bounded by what each publisher reserves for us',
    note: 'Quality editorial context at a mid-range CPA. Cheaper than programmatic, but every deal has a cap and its own creative specs'
  },
  programmatic: {
    label: 'Programmatic',
    short: 'Programmatic',
    where: 'The Trade Desk and DV360: retailer audiences extended across the open web and CTV',
    supply: 'Effectively unbounded',
    note: 'Always available and always the most expensive per outcome. The release valve when the finite surfaces underfill'
  }
};

export const INVENTORY_BOUNDED: Record<SurfaceId, boolean> = {
  sponsored_display: true,
  in_app: true,
  off_app: true,
  programmatic: false
};

export function underfillPct(allocatedEur: number, deliveredEur: number): number {
  if (allocatedEur <= 0) return 0;
  return Math.max(0, (allocatedEur - deliveredEur) / allocatedEur);
}

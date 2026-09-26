import { FORMAT_SURFACES, type PlanDraft } from '$lib/plan';

export const DRAFT: PlanDraft = {
  clientId: 'agropur',
  name: 'Natrel protein spring reload',
  objectiveType: 'trial',
  objective: 'Drive trial of the reformulated high-protein Natrel range ahead of the spring reset',
  market: 'CA',
  budgetEur: 520_000,
  flightDays: 28,
  targetCpaEur: 13.0,
  audiences: [
    'Walmart Canada: dairy category browsers',
    'Walmart Canada: lapsed protein-drink purchasers, 90 day',
    'Sobeys: Scene+ members, high-protein affinity',
    'Loblaw: PC Optimum members, breakfast basket',
    'The Globe and Mail: food and wellness readers'
  ],
  placements: [
    { retailer: 'Walmart Canada', surface: 'sponsored_display', requestedEur: 260_000 },
    { retailer: 'Sobeys', surface: 'sponsored_display', requestedEur: 120_000 },
    { retailer: 'Loblaw', surface: 'in_app', requestedEur: 80_000 },
    { retailer: 'The Globe and Mail', surface: 'off_app', requestedEur: 20_000 },
    { retailer: 'The Trade Desk', surface: 'programmatic', requestedEur: 40_000 }
  ],
  creatives: [
    { id: 'cr-1', filename: 'natrel_300x250_en.jpg', format: '300x250', sizeKb: 88, eligibleSurfaces: FORMAT_SURFACES['300x250'], language: 'en' },
    { id: 'cr-2', filename: 'natrel_728x90_en.jpg', format: '728x90', sizeKb: 64, eligibleSurfaces: FORMAT_SURFACES['728x90'], language: 'en' },
    { id: 'cr-3', filename: 'natrel_app_native_en.json', format: 'app_native', sizeKb: 14, eligibleSurfaces: FORMAT_SURFACES.app_native, language: 'en' }
  ],
  status: 'draft'
};

import { FORMAT_SURFACES, type PlanDraft } from '$lib/plan';

export const DRAFT: PlanDraft = {
  clientId: 'danone',
  name: 'Oikos protein spring reload',
  objectiveType: 'trial',
  objective: 'Drive trial of the reformulated high-protein Oikos range ahead of the spring reset',
  market: 'CA',
  budgetEur: 520_000,
  flightDays: 28,
  targetCpaEur: 13.0,
  audiences: [
    'Walmart: yogurt and dairy category browsers',
    'Walmart: lapsed protein-snack purchasers, 90 day',
    'Kroger: 84.51 household panel, high-protein affinity',
    'Loblaw: PC Optimum members, breakfast basket'
  ],
  placements: [
    { retailer: 'Walmart', surface: 'sponsored_display', requestedEur: 260_000 },
    { retailer: 'Kroger', surface: 'sponsored_display', requestedEur: 120_000 },
    { retailer: 'Loblaw', surface: 'in_app', requestedEur: 80_000 },
    { retailer: 'Open web (DV360, TTD)', surface: 'offsite', requestedEur: 60_000 }
  ],
  creatives: [
    { id: 'cr-1', filename: 'oikos_300x250_en.jpg', format: '300x250', sizeKb: 88, eligibleSurfaces: FORMAT_SURFACES['300x250'], language: 'en' },
    { id: 'cr-2', filename: 'oikos_728x90_en.jpg', format: '728x90', sizeKb: 64, eligibleSurfaces: FORMAT_SURFACES['728x90'], language: 'en' },
    { id: 'cr-3', filename: 'oikos_app_native_en.json', format: 'app_native', sizeKb: 14, eligibleSurfaces: FORMAT_SURFACES.app_native, language: 'en' }
  ],
  status: 'draft'
};

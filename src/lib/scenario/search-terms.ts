import type { ClientId } from '$lib/portfolio';
import type { MatchType, SearchTerm } from '$lib/keywords';
import { FEATURED, type Campaign } from './campaigns';

// What shoppers typed into retailer search, onsite and in-app, over the last 14 days.
// Invented, but shaped like a real search-term report: a long tail with too little
// data to act on, and a handful of terms that matter.

type Lexicon = {
  // Client-supplied lists. Jev reads these as policy, the way it reads a CPA target.
  categoryWords: string[];
  competitorBrands: string[];
  brandSafety: string[];

  products: string[];
  modifiers: string[];
  french: string[];
  competitorTerms: string[];
  offCategory: string[];
  sensitive: string[];
};

export const LEXICON: Record<ClientId, Lexicon> = {
  mccain: {
    categoryWords: ['fries', 'wedges', 'hash browns', 'onion rings', 'tots', 'frites', 'pommes de terre'],
    competitorBrands: ['cavendish', 'great value', 'no name'],
    brandSafety: ['recall', 'acrylamide'],
    products: ['fries', 'french fries', 'frozen fries', 'superfries', 'crinkle cut fries', 'straight cut fries', 'sweet potato fries', 'potato wedges', 'hash browns', 'onion rings', 'tater tots', 'seasoned fries'],
    modifiers: ['', 'family size', 'air fryer', 'crispy', 'bulk', '2kg', 'kids', 'gluten free', 'oven', 'extra crispy', 'quick', 'best', 'mccain', 'thick cut', 'on sale'],
    french: ['frites surgelées', 'frites pour friteuse à air', 'frites allumettes', 'pommes de terre rissolées'],
    competitorTerms: ['cavendish fries', 'great value fries', 'no name fries'],
    offCategory: ['fry pan', 'air fryer machine', 'french press', 'potato peeler'],
    sensitive: ['mccain recall', 'acrylamide in food']
  },
  mapleleaf: {
    categoryWords: ['sausage', 'bratwurst', 'burger', 'hot dog', 'smokies', 'bacon', 'saucisse', 'hot-dog'],
    competitorBrands: ["piller's", 'compliments', 'no name'],
    brandSafety: ['listeria', 'cancer'],
    products: ['sausages', 'bratwurst', 'burgers', 'hot dogs', 'smokies', 'italian sausage', 'beef burgers', 'chicken sausages', 'bacon', 'breakfast sausage', 'turkey bacon', 'cheese smokies'],
    modifiers: ['', 'bbq', 'grilling', 'family pack', 'frozen', 'fresh', 'spicy', 'honey garlic', 'schneiders', 'maple leaf', 'thick', 'natural', 'on sale', 'quarter pound', 'kids'],
    french: ['saucisses bbq', 'hot-dogs', 'burgers surgelés', 'bacon fumé'],
    competitorTerms: ["piller's sausage", 'compliments hot dogs', 'no name bacon'],
    offCategory: ['bbq grill', 'propane tank', 'grill brush', 'patio furniture'],
    sensitive: ['listeria recall', 'processed meat cancer']
  },
  olddutch: {
    categoryWords: ['chips', 'croustilles'],
    competitorBrands: ["lay's", 'lays', 'ruffles', 'miss vickies'],
    brandSafety: ['recall', 'sodium'],
    products: ['chips', 'potato chips', 'ketchup chips', 'all dressed chips', 'tortilla chips', 'salt and vinegar chips', 'ripple chips', 'dill pickle chips', 'kettle chips', 'bbq chips', 'sour cream chips', 'baked chips'],
    modifiers: ['', 'party size', 'family size', 'old dutch', 'big bag', 'snack pack', 'gluten free', 'arriba', 'spicy', 'on sale', 'best', 'multipack', 'mini', 'canadian', 'game day'],
    french: ['croustilles', 'croustilles ketchup', 'croustilles tout garni', 'croustilles sel et vinaigre'],
    competitorTerms: ['lays chips', 'ruffles all dressed', 'miss vickies chips'],
    offCategory: ['chip clip', 'poker set', 'computer chip', 'chipotle sauce'],
    sensitive: ['chips recall', 'sodium in snacks']
  },
  agropur: {
    categoryWords: ['milk', 'lait'],
    competitorBrands: ['fairlife', 'neilson', 'lactantia'],
    brandSafety: ['recall', 'hormones'],
    products: ['protein milk', 'milk', 'lactose free milk', 'high protein milk', '2% milk', 'chocolate milk', 'organic milk', 'ultrafiltered milk', 'skim milk', 'whole milk', '1% milk', 'protein chocolate milk'],
    modifiers: ['', '2l', '4l', 'natrel', 'fine filtered', 'high protein', 'kids', 'on sale', 'best', 'canadian', 'lactose free', 'organic', 'single serve', 'breakfast', 'gym'],
    french: ['lait protéiné', 'lait sans lactose', 'lait natrel', 'lait au chocolat'],
    competitorTerms: ['fairlife milk', 'neilson milk', 'lactantia milk'],
    offCategory: ['baby formula', 'breast pump', 'cheese grater', 'oat barista blend'],
    sensitive: ['milk recall', 'hormones in dairy']
  },
  kruger: {
    categoryWords: ['tissue', 'tissues', 'mouchoirs'],
    competitorBrands: ['kleenex', 'puffs', 'selection'],
    brandSafety: ['covid', 'deaths'],
    products: ['tissues', 'facial tissue', 'scotties tissue', 'lotion tissues', 'tissue box', 'cube tissue', 'soft tissues', 'tissues bulk', 'travel tissues', 'aloe tissues', 'tissue multipack', 'hypoallergenic tissue'],
    modifiers: ['', 'scotties', 'cold and flu', 'bulk', 'family pack', 'on sale', '3 ply', 'soft', 'best', 'unscented', '6 pack', '12 pack', 'kids', 'sensitive', 'large'],
    french: ['papiers mouchoirs', 'mouchoirs scotties', 'mouchoirs doux', 'boîte de mouchoirs'],
    competitorTerms: ['kleenex', 'puffs tissues', 'selection tissues'],
    offCategory: ['gift wrap', 'humidifier', 'cough syrup', 'toilet paper holder'],
    sensitive: ['covid symptoms', 'flu deaths']
  },
  timhortons: {
    categoryWords: ['coffee', 'café', 'pods', 'k cups'],
    competitorBrands: ['nabob', 'van houtte', 'starbucks'],
    brandSafety: ['cancer', 'overdose'],
    products: ['coffee', 'ground coffee', 'original blend coffee', 'tim hortons coffee', 'coffee pods', 'k cups', 'dark roast coffee', 'decaf coffee', 'whole bean coffee', 'medium roast coffee', 'coffee 930g', 'french vanilla coffee'],
    modifiers: ['', 'tim hortons', 'original', 'bulk', 'on sale', 'large can', 'decaf', 'best', 'canadian', '30 pack', 'fine grind', 'drip', 'morning', 'value size', 'fresh'],
    french: ['café moulu', 'café tim hortons', 'capsules café', 'café torréfaction foncée'],
    competitorTerms: ['nabob coffee', 'van houtte coffee', 'starbucks ground coffee'],
    offCategory: ['espresso machine repair', 'coffee table', 'tim hortons jobs', 'kettle'],
    sensitive: ['coffee cancer', 'caffeine overdose']
  }
};

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const slug = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

type Shape = 'thin' | 'winner' | 'exact_winner' | 'no_sales' | 'expensive' | 'at_target_big' | 'steady';

function shapeFor(r: number): Shape {
  if (r < 0.55) return 'thin';
  if (r < 0.69) return 'winner';
  if (r < 0.76) return 'exact_winner';
  if (r < 0.86) return 'no_sales';
  if (r < 0.93) return 'expensive';
  if (r < 0.945) return 'at_target_big';
  return 'steady';
}

function metricsFor(shape: Shape, target: number, rand: () => number) {
  const between = (lo: number, hi: number) => lo + (hi - lo) * rand();
  const cpc = between(0.55, 1.35);
  let clicks: number;
  let cpaFactor: number | null;
  switch (shape) {
    case 'thin': clicks = Math.floor(between(0, 10)); cpaFactor = rand() < 0.3 ? between(0.6, 1.8) : null; break;
    case 'winner': clicks = Math.floor(between(24, 140)); cpaFactor = between(0.45, 0.78); break;
    case 'exact_winner': clicks = Math.floor(between(40, 200)); cpaFactor = between(0.45, 0.72); break;
    case 'no_sales': clicks = Math.floor(between(16, 70)); cpaFactor = null; break;
    case 'expensive': clicks = Math.floor(between(25, 110)); cpaFactor = between(1.35, 2.1); break;
    case 'at_target_big': clicks = Math.floor(between(520, 900)); cpaFactor = between(0.96, 1.08); break;
    default: clicks = Math.floor(between(15, 60)); cpaFactor = between(0.85, 1.12);
  }
  const spend = Number((clicks * cpc).toFixed(2));
  const conversions = cpaFactor === null || spend === 0 ? 0 : Math.max(shape === 'thin' ? 0 : 1, Math.round(spend / (target * cpaFactor)));
  const impressions = Math.round(clicks / between(0.004, 0.02)) + Math.floor(between(20, 300));
  return { clicks, spend, conversions, impressions };
}

function termsFor(c: Campaign, index: number): SearchTerm[] {
  const lex = LEXICON[c.clientId];
  const rand = rng(1009 * (index + 1));
  const retailers = [...new Set(c.lines.filter((l) => l.surface === 'sponsored_display' || l.surface === 'in_app').map((l) => l.retailer!))];
  const out: SearchTerm[] = [];
  const seen = new Set<string>();

  const push = (term: string, shape: Shape, language: 'en' | 'fr-CA' = 'en') => {
    const retailer = retailers[Math.floor(rand() * retailers.length)];
    const id = `${c.id}-${slug(retailer)}-${slug(term)}`;
    if (seen.has(id)) return;
    seen.add(id);
    const product = lex.products.find((p) => term.includes(p));
    // Terms outside the product list only reach the ads through the broad head keyword.
    const matchType: MatchType = shape === 'exact_winner' ? 'exact' : !product ? 'broad' : rand() < 0.55 ? 'broad' : 'phrase';
    const base = product ?? lex.products[0];
    const m = metricsFor(shape, c.targetCpaEur, rand);
    out.push({
      id,
      campaignId: c.id,
      retailer,
      term,
      keyword: matchType === 'exact' ? term : base,
      matchType,
      language,
      impressions: m.impressions,
      clicks: m.clicks,
      spendEur: m.spend,
      conversions: m.conversions,
      salesEur: Math.round(m.conversions * c.targetCpaEur * (3.2 + rand() * 2.4))
    });
  };

  for (const p of lex.products) {
    for (const mod of lex.modifiers) {
      const term = mod ? (rand() < 0.5 ? `${mod} ${p}` : `${p} ${mod}`) : p;
      push(term, shapeFor(rand()));
    }
  }
  for (const t of lex.french) push(t, rand() < 0.6 ? 'winner' : 'thin', 'fr-CA');
  for (const t of lex.competitorTerms) push(t, rand() < 0.5 ? 'winner' : 'steady');
  for (const t of lex.offCategory) push(t, 'no_sales');
  for (const t of lex.sensitive) push(t, 'steady');
  return out;
}

export const SEARCH_TERMS: SearchTerm[] = FEATURED.flatMap((c, i) => termsFor(c, i));

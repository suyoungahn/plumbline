import { CAMPAIGNS } from '$lib/scenario/campaigns';
import { CLIENTS, type ClientInfo } from '$lib/portfolio';
import { recordFromCampaign } from './book';
import { SEED_PACING, SEED_PLAN, SEED_REPORT } from './seed';
import type { DecisionEntry, MediaPlan, Pacing, WeeklyReport } from './types';

// Every campaign is one record: its plan (brief, lines, flowchart, creative), its
// pacing actuals and its weekly report. The book's 24 live campaigns and the
// PC Express Pass sample all use the same shape and the same tabs. Edits are kept in
// this browser only, so a demo can be reset to the sample at any point.

const KEY = 'plumbline.records.v1';
const CREATED_KEY = 'plumbline.created.v1';

export type CampaignDoc = { plan: MediaPlan; pacing: Pacing; report: WeeklyReport; decisions: DecisionEntry[] };

export const SAMPLE_ID = 'pcexpress-holiday';

const BOOK_CLIENT: Record<string, string> = Object.fromEntries([
  [SAMPLE_ID, 'loblaw'],
  ...CAMPAIGNS.map((c) => [c.id, c.clientId])
]);

// Which client each campaign belongs to. Grows as campaigns are created.
export const RECORD_CLIENT = $state<Record<string, string>>({ ...BOOK_CLIENT });

// Every client: the book's six plus any the team onboards.
export const clients = $state<Record<string, ClientInfo>>(structuredClone(CLIENTS) as Record<string, ClientInfo>);

// Campaign ids, including ones created in this browser.
export const campaignIds = () => Object.keys(records);

function fresh(): Record<string, CampaignDoc> {
  return {
    [SAMPLE_ID]: structuredClone({ plan: SEED_PLAN, pacing: SEED_PACING, report: SEED_REPORT, decisions: [] }),
    ...Object.fromEntries(CAMPAIGNS.map((c) => [c.id, { ...recordFromCampaign(c), decisions: [] }]))
  };
}


export const records = $state<Record<string, CampaignDoc>>(fresh());

let restored = false;

// Team settings. Shadow mode is on for a new team: routine changes are recorded as
// what the rules would have done, and nothing is applied until the team turns it off.
const SETTINGS_KEY = 'plumbline.settings.v1';
export const settings = $state({
  shadow: true,
  welcomed: false,
  seenPlan: false,
  seenReport: false,
  introSeen: false,
  // Per action type: 'auto' lets that kind of change apply without a person once
  // learning mode is off. Everything starts manual.
  autonomy: {} as Record<string, 'auto' | 'manual'>
});

let settingsRestored = false;

export function restoreSettings() {
  if (settingsRestored) return;
  settingsRestored = true;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      Object.assign(settings, { ...saved, autonomy: { ...(saved.autonomy ?? {}) } });
    }
  } catch {
    // Storage blocked: defaults stand.
  }
}

export function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Storage blocked: settings last for this session.
  }
}

// Pages that fill in drafts wait for this, so a saved campaign is not overwritten.
export const ready = $state({ value: false });

export function restoreCampaigns() {
  if (restored) return;
  try {
    const extra = localStorage.getItem(CREATED_KEY);
    if (extra) {
      const saved = JSON.parse(extra) as { clients: Record<string, ClientInfo>; recordClient: Record<string, string> };
      Object.assign(clients, saved.clients ?? {});
      Object.assign(RECORD_CLIENT, saved.recordClient ?? {});
    }
    const raw = localStorage.getItem(KEY);
    if (raw) {
      // Fill anything a newer version added, so older saved campaigns still open.
      const saved = JSON.parse(raw) as Record<string, Partial<CampaignDoc>>;
      const base = fresh();
      for (const [id, doc] of Object.entries(saved)) {
        if (!base[id]) {
          // A campaign created in this browser.
          if (RECORD_CLIENT[id] && doc.plan && doc.pacing && doc.report) records[id] = { ...(doc as CampaignDoc), decisions: doc.decisions ?? [] };
          continue;
        }
        records[id] = {
          plan: { ...base[id].plan, ...doc.plan },
          pacing: { ...base[id].pacing, ...doc.pacing },
          report: { ...base[id].report, ...doc.report },
          decisions: doc.decisions ?? []
        };
      }
    }
  } catch {
    // Storage blocked or corrupt: keep the sample.
  }
  restored = true;
  ready.value = true;
}

export function saveCampaigns() {
  if (!restored) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(records));
    const createdClients = Object.fromEntries(Object.entries(clients).filter(([id]) => !(id in CLIENTS)));
    const createdLinks = Object.fromEntries(Object.entries(RECORD_CLIENT).filter(([id]) => !(id in BOOK_CLIENT)));
    localStorage.setItem(CREATED_KEY, JSON.stringify({ clients: createdClients, recordClient: createdLinks }));
  } catch {
    // Storage blocked: edits still work for this session.
  }
}

export function resetCampaign(id: string) {
  const base = fresh();
  if (base[id]) records[id] = base[id];
  saveCampaigns();
}

export function newLineId() {
  return `l-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

// Start the demo over: sample campaigns, no decisions, intro and checklist again.
export function resetDemo() {
  for (const id of Object.keys(records)) if (!(id in BOOK_CLIENT)) delete records[id];
  for (const id of Object.keys(RECORD_CLIENT)) if (!(id in BOOK_CLIENT)) delete RECORD_CLIENT[id];
  for (const id of Object.keys(clients)) if (!(id in CLIENTS)) delete clients[id];
  Object.assign(records, fresh());
  Object.assign(settings, { shadow: true, welcomed: false, seenPlan: false, seenReport: false, introSeen: false, autonomy: {} });
  saveCampaigns();
  saveSettings();
}

const slugify = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';

function uniqueId(base: string, taken: Record<string, unknown>) {
  let id = base;
  for (let n = 2; id in taken; n++) id = `${base}-${n}`;
  return id;
}

export function createClient(info: ClientInfo): string {
  const id = uniqueId(slugify(info.name), clients);
  clients[id] = info;
  saveCampaigns();
  return id;
}

export function createCampaign(clientId: string, doc: Omit<CampaignDoc, 'decisions'>): string {
  const id = uniqueId(`${clientId}-${slugify(doc.plan.campaign)}`, records);
  records[id] = { ...doc, decisions: [] };
  RECORD_CLIENT[id] = clientId;
  saveCampaigns();
  return id;
}

// In the browser, read saved data before any page renders, so a campaign created in
// this browser exists on a hard reload of its own URL.
if (typeof window !== 'undefined') {
  restoreSettings();
  restoreCampaigns();
}

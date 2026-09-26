import { CAMPAIGNS } from '$lib/scenario/campaigns';
import { recordFromCampaign } from './book';
import { SEED_PACING, SEED_PLAN, SEED_REPORT } from './seed';
import type { MediaPlan, Pacing, WeeklyReport } from './types';

// Every campaign is one record: its plan (brief, lines, flowchart, creative), its
// pacing actuals and its weekly report. The book's 24 live campaigns and the
// PC Express Pass sample all use the same shape and the same tabs. Edits are kept in
// this browser only, so a demo can be reset to the sample at any point.

const KEY = 'plumbline.records.v1';

export type CampaignDoc = { plan: MediaPlan; pacing: Pacing; report: WeeklyReport };

export const SAMPLE_ID = 'pcexpress-holiday';

// Which client each record belongs to, for the Campaigns table and the Inbox.
export const RECORD_CLIENT: Record<string, string> = Object.fromEntries([
  [SAMPLE_ID, 'loblaw'],
  ...CAMPAIGNS.map((c) => [c.id, c.clientId])
]);

function fresh(): Record<string, CampaignDoc> {
  return {
    [SAMPLE_ID]: structuredClone({ plan: SEED_PLAN, pacing: SEED_PACING, report: SEED_REPORT }),
    ...Object.fromEntries(CAMPAIGNS.map((c) => [c.id, recordFromCampaign(c)]))
  };
}

export const RECORD_IDS = Object.keys(RECORD_CLIENT);

export const records = $state<Record<string, CampaignDoc>>(fresh());

let restored = false;

// Pages that fill in drafts wait for this, so a saved campaign is not overwritten.
export const ready = $state({ value: false });

export function restoreCampaigns() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      // Fill anything a newer version added, so older saved campaigns still open.
      const saved = JSON.parse(raw) as Record<string, Partial<CampaignDoc>>;
      const base = fresh();
      for (const [id, doc] of Object.entries(saved)) {
        if (!base[id]) continue;
        records[id] = {
          plan: { ...base[id].plan, ...doc.plan },
          pacing: { ...base[id].pacing, ...doc.pacing },
          report: { ...base[id].report, ...doc.report }
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

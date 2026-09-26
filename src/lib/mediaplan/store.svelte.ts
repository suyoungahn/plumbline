import { CAMPAIGNS } from '$lib/scenario/campaigns';
import { recordFromCampaign } from './book';
import { SEED_PACING, SEED_PLAN, SEED_REPORT } from './seed';
import type { DecisionEntry, MediaPlan, Pacing, WeeklyReport } from './types';

// Every campaign is one record: its plan (brief, lines, flowchart, creative), its
// pacing actuals and its weekly report. The book's 24 live campaigns and the
// PC Express Pass sample all use the same shape and the same tabs. Edits are kept in
// this browser only, so a demo can be reset to the sample at any point.

const KEY = 'plumbline.records.v1';

export type CampaignDoc = { plan: MediaPlan; pacing: Pacing; report: WeeklyReport; decisions: DecisionEntry[] };

export const SAMPLE_ID = 'pcexpress-holiday';

// Which client each record belongs to, for the Campaigns table and the Inbox.
export const RECORD_CLIENT: Record<string, string> = Object.fromEntries([
  [SAMPLE_ID, 'loblaw'],
  ...CAMPAIGNS.map((c) => [c.id, c.clientId])
]);

function fresh(): Record<string, CampaignDoc> {
  return {
    [SAMPLE_ID]: structuredClone({ plan: SEED_PLAN, pacing: SEED_PACING, report: SEED_REPORT, decisions: [] }),
    ...Object.fromEntries(CAMPAIGNS.map((c) => [c.id, { ...recordFromCampaign(c), decisions: [] }]))
  };
}

export const RECORD_IDS = Object.keys(RECORD_CLIENT);

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

export function restoreSettings() {
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
  Object.assign(records, fresh());
  Object.assign(settings, { shadow: true, welcomed: false, seenPlan: false, seenReport: false, introSeen: false, autonomy: {} });
  saveCampaigns();
  saveSettings();
}

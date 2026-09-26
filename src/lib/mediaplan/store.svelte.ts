import { SEED_PACING, SEED_PLAN, SEED_REPORT } from './seed';
import type { MediaPlan, Pacing, WeeklyReport } from './types';

// One campaign flows through Plan → Flowchart → Pacing → Weekly report. Edits are kept
// in this browser only, so a demo can be reset to the sample at any point.

const KEY = 'plumbline.campaign.v2';

type CampaignDoc = { plan: MediaPlan; pacing: Pacing; report: WeeklyReport };

const fresh = (): CampaignDoc => structuredClone({ plan: SEED_PLAN, pacing: SEED_PACING, report: SEED_REPORT });

export const doc = $state<CampaignDoc>(fresh());

let restored = false;

// Pages that fill in drafts wait for this, so a saved campaign is not overwritten.
export const ready = $state({ value: false });

export function restoreCampaign() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      // Fill anything a newer version added, so older saved campaigns still open.
      const saved = JSON.parse(raw) as Partial<CampaignDoc>;
      const base = fresh();
      doc.plan = { ...base.plan, ...saved.plan };
      doc.pacing = { ...base.pacing, ...saved.pacing };
      doc.report = { ...base.report, ...saved.report };
    }
  } catch {
    // Storage blocked or corrupt: keep the sample.
  }
  restored = true;
  ready.value = true;
}

export function saveCampaign() {
  if (!restored) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(doc));
  } catch {
    // Storage blocked: edits still work for this session.
  }
}

export function resetCampaign() {
  Object.assign(doc, fresh());
  saveCampaign();
}

export function newLineId() {
  return `l-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

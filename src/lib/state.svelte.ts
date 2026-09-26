import { base } from '$app/paths';
import { LEVERS, agreementRate, type LedgerEntry, type LeverId, type Proposal, type Thresholds } from '$lib/domain';
import { TICKS } from '$lib/scenario/nuvola';

const SEED_HISTORY: Partial<Record<LeverId, { approved: number; total: number }>> = {
  adjust_bid: { approved: 47, total: 49 },

  shift_budget: { approved: 35, total: 36 },

  swap_creative: { approved: 14, total: 19 },
  expand_audience: { approved: 8, total: 14 }
};

export function thresholdFor(rate: number | null, n: number): number {
  if (rate === null) return 1;
  if (n >= 15 && rate >= 0.95) return 0.5;
  if (n >= 15 && rate >= 0.9) return 0.6;
  if (n >= 10 && rate >= 0.8) return 0.68;
  if (n >= 5 && rate >= 0.75) return 0.75;
  return 1;
}

function initialThresholds(): Thresholds {
  const t = {} as Thresholds;
  for (const id of Object.keys(LEVERS) as LeverId[]) {
    const seed = SEED_HISTORY[id];
    t[id] = seed ? thresholdFor(seed.approved / seed.total, seed.total) : 1;
  }
  return t;
}

export const run = $state({
  tickIndex: 0,
  proposals: [] as Proposal[],
  ledger: [] as LedgerEntry[],
  thresholds: initialThresholds(),
  seed: SEED_HISTORY,
  busy: false,
  errorMessage: null as string | null
});

export function currentTick() {
  return TICKS[run.tickIndex];
}

export function proposalForDay(day: number) {
  return run.proposals.find((p) => p.day === day);
}

export function ruledFor(day: number) {
  return run.ledger.find((e) => e.proposal.day === day);
}

export function effectiveAgreement(lever: LeverId): { rate: number; n: number } | null {
  const seeded = run.seed[lever];
  const live = run.ledger.filter((e) => e.proposal.lever === lever && e.ruledBy === 'operator');
  const approvedLive = live.filter((e) => e.ruling === 'approved').length;
  const total = (seeded?.total ?? 0) + live.length;
  if (total === 0) return null;
  const approved = (seeded?.approved ?? 0) + approvedLive;
  return { rate: approved / total, n: total };
}

export function wouldAutoExecute(p: Proposal): boolean {
  return p.gateOpen && p.leverConfidence >= run.thresholds[p.lever];
}

export async function advance(mode?: 'live' | 'replay' | 'sim') {
  const tick = currentTick();
  if (!tick || proposalForDay(tick.day)) return;
  run.busy = true;
  run.errorMessage = null;
  try {
    const res = await fetch(`${base}/api/tick/${tick.day}`);
    if (!res.ok) throw new Error((await res.json()).message ?? `HTTP ${res.status}`);
    const proposal: Proposal = await res.json();
    run.proposals = [...run.proposals, proposal];

    if (wouldAutoExecute(proposal)) {
      run.ledger = [
        ...run.ledger,
        { proposal, ruling: 'auto_executed', ruledAt: new Date().toISOString(), ruledBy: 'threshold' }
      ];
    }
  } catch (e) {
    run.errorMessage = e instanceof Error ? e.message : 'Decision failed';
  } finally {
    run.busy = false;
    persist();
  }
}

export function rule(proposal: Proposal, ruling: 'approved' | 'rejected') {
  if (ruledFor(proposal.day)) return;
  run.ledger = [
    ...run.ledger,
    { proposal, ruling, ruledAt: new Date().toISOString(), ruledBy: 'operator' }
  ];

  const ag = effectiveAgreement(proposal.lever);
  if (ag) run.thresholds[proposal.lever] = thresholdFor(ag.rate, ag.n);
  persist();
}

export function nextTick() {
  if (run.tickIndex < TICKS.length - 1) run.tickIndex += 1;
  persist();
}

const KEY = 'meridian.run.v1';

export function persist() {
  try {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({ tickIndex: run.tickIndex, proposals: run.proposals, ledger: run.ledger, thresholds: run.thresholds })
    );
  } catch {
  }
}

export function restore() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    run.tickIndex = saved.tickIndex ?? 0;
    run.proposals = saved.proposals ?? [];
    run.ledger = saved.ledger ?? [];
    run.thresholds = saved.thresholds ?? run.thresholds;
  } catch {
  }
}

export function reset() {
  run.tickIndex = 0;
  run.proposals = [];
  run.ledger = [];
  run.thresholds = initialThresholds();
  run.errorMessage = null;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
  }
}

export { agreementRate };

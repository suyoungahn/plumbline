import { readdirSync, existsSync } from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:5178';
const DAYS = [9, 11, 13, 16, 20, 24];

let failed = 0;
const ok = (m) => console.log(`  ok    ${m}`);
const bad = (m) => {
  console.log(`  FAIL  ${m}`);
  failed += 1;
};
const warn = (m) => console.log(`  warn  ${m}`);

console.log('\nPlumbline pre-flight\n');

console.log('Server');
try {
  const r = await fetch(`${BASE}/optimize`);
  r.ok ? ok(`${BASE} responding`) : bad(`${BASE} returned ${r.status}`);
} catch {
  bad(`${BASE} not reachable. Run: npm run dev -- --port 5178`);
  console.log('\nStopping: nothing else can be checked.\n');
  process.exit(1);
}

console.log('\nScenario consistency');
const v = await (await fetch(`${BASE}/api/verify`)).json();
if (v.ok) ok('every headline figure derives from its own line items');
else bad(`inconsistent on day(s) ${v.failures.join(', ')}. Run: curl -s ${BASE}/api/verify`);

console.log('\nFixtures');
const count = (d) => (existsSync(d) ? readdirSync(d).length : 0);
const files = existsSync('fixtures/jev') ? readdirSync('fixtures/jev') : [];
const singleTicks = files.filter((f) => f.startsWith('nuvola-day-')).length;
const portfolio = files.filter((f) => f.startsWith('campaign-')).length;
singleTicks === DAYS.length ? ok(`${singleTicks} of ${DAYS.length} lifecycle ticks recorded`) : bad(`${singleTicks} of ${DAYS.length} lifecycle ticks recorded`);
portfolio === 24 ? ok(`${portfolio} of 24 campaign decisions recorded`) : bad(`${portfolio} of 24 campaign decisions recorded`);
const narr = count('fixtures/narrate');

narr > 0 ? ok(`${narr} rationales recorded`) : warn('no rationales recorded yet, needs model credit');
const narr2 = count('fixtures/narrate');
if (narr2 < DAYS.length) warn(`${narr2} of ${DAYS.length} rationales recorded. The rest need OpenRouter credit; decisions are unaffected`);
const rep = count('fixtures/report');
rep > 0 ? ok(`${rep} client update(s) recorded`) : warn('no client update recorded. Act 5 will fall back to the assembled ledger, or call live if credits allow');

console.log('\nReplay');
const listing = () =>
  JSON.stringify((existsSync('fixtures/jev') ? readdirSync('fixtures/jev') : []).sort()) +
  JSON.stringify((existsSync('fixtures/narrate') ? readdirSync('fixtures/narrate') : []).sort());
const before = listing();
for (const day of DAYS) {
  const res = await fetch(`${BASE}/api/decide`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ day })
  });
  if (!res.ok) {
    bad(`day ${day} failed with ${res.status}`);
    continue;
  }
  const p = await res.json();
  if (p.source !== 'replay') bad(`day ${day} served from "${p.source}", expected "replay"`);
  else if (!p.rationale)

    warn(`day ${day} ${p.gateOpen ? 'gate open' : 'gate shut'} ${p.lever}, no rationale recorded yet`);
  else ok(`day ${day} ${p.gateOpen ? 'gate open ' : 'gate shut '} ${p.lever}`);
}
const after = listing();
before === after ? ok('no new fixtures written, so nothing called out to the network') : bad('new fixtures appeared, meaning a live call happened');

console.log('\nPortfolio');
const pf = await (await fetch(`${BASE}/api/portfolio`)).json();
pf.summary.campaigns === 24 ? ok(`${pf.summary.campaigns} campaigns evaluated`) : bad(`${pf.summary.campaigns} campaigns, expected 24`);
pf.summary.source === 'replay'
  ? ok(`queue of ${pf.summary.needsHuman}, served from recorded Jev`)
  : bad(`portfolio served from "${pf.summary.source}", expected "replay"`);
pf.summary.needsHuman > 0 && pf.summary.needsHuman < 8
  ? ok(`${pf.summary.needsHuman} need a human, ${pf.summary.handled} cleared`)
  : bad(`queue size ${pf.summary.needsHuman} is not demo-shaped`);
for (const p2 of ['/today', '/reporting', '/clients', '/campaigns', '/campaigns/new', '/clients/new', '/settings', '/welcome', '/campaign/pcexpress-holiday/plan', '/campaign/pcexpress-holiday/flowchart', '/campaign/pcexpress-holiday/pacing', '/campaign/pcexpress-holiday/report', '/campaign/mccain-freezer-reset/search-terms', '/campaign/mccain-freezer-reset/decisions', '/keywords', '/campaign/mccain-freezer-reset', '/client-report/mccain-freezer-reset', '/optimize']) {
  const r = await fetch(`${BASE}${p2}`);
  r.ok ? ok(`${p2} renders`) : bad(`${p2} returned ${r.status}`);
}

console.log('\nPlan');
const pc = await (await fetch(`${BASE}/api/plan-check`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).json();
if (!pc.check) bad('plan-check returned nothing');
else {
  pc.check.deliverable === false
    ? ok(`deliverability ${(pc.check.deliverableProbability * 100).toFixed(0)}%, recommends ${pc.check.recommendation}`)
    : bad('demo plan should NOT be deliverable as written, that is the beat');
  pc.state.undeliverable_eur > 50000
    ? ok(`${(pc.state.undeliverable_pct * 100).toFixed(1)}% of budget undeliverable, caught before launch`)
    : bad(`undeliverable is only ${pc.state.undeliverable_eur}, too small to land`);
}
const cr = await (await fetch(`${BASE}/api/client-report/mccain-freezer-reset`)).json();
cr.markdown && cr.markdown.length > 500 ? ok('client report generates from the record') : bad('client report is empty or too short');

console.log('\nDecision log');
const lg = await (await fetch(`${BASE}/api/jev-log`)).json();
if (!lg.aggregate) bad('jev-log returned no aggregate');
else {
  lg.aggregate.calls >= 30 ? ok(`${lg.aggregate.calls} calls logged, ${lg.aggregate.calls * lg.aggregate.questionsPerCall} typed decisions`) : bad(`only ${lg.aggregate.calls} calls logged`);
  const withState = lg.calls.filter((c) => c.stateFieldCount > 0).length;
  withState === lg.calls.length ? ok('every call has its request state captured') : bad(`${lg.calls.length - withState} call(s) missing request state, so they cannot be re-analysed`);
  lg.aggregate.baseline.compared === lg.calls.length ? ok(`rules-engine baseline computed for all ${lg.aggregate.baseline.compared}`) : warn(`baseline only for ${lg.aggregate.baseline.compared} of ${lg.calls.length}`);
  ok(`cost ${lg.aggregate.totalCostUsd}, median ${lg.aggregate.medianLatencyMs}ms, confidence ${lg.aggregate.confidence.min} to ${lg.aggregate.confidence.max}`);
}
const jr = await fetch(`${BASE}/history`);
jr.ok ? ok('/history renders') : bad(`/history returned ${jr.status}`);

console.log('\nKey');
existsSync('.env') ? ok('.env present') : warn('.env missing. Replay still works; live mode will not');

console.log(
  failed === 0
    ? '\nReady. Reset the run on /optimize before you start.\n'
    : `\n${failed} check(s) failed. Fix before presenting.\n`
);
process.exit(failed === 0 ? 0 : 1);

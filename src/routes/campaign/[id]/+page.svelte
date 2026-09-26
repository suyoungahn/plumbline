<script lang="ts">
  import { base } from '$app/paths';
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import JevPanel from '$lib/components/JevPanel.svelte';
  import StatRail from '$lib/components/StatRail.svelte';
  import type { RailStat } from '$lib/components/stat-rail';
  import type { JevStep } from '$lib/components/jev-panel';
  import { SEVERITY_MAX, severityLabel } from '$lib/domain';
  import { LEVERS, type LeverId } from '$lib/domain';
  import { SURFACES, type SurfaceId } from '$lib/placements';
  import { CLIENTS, type ClientId } from '$lib/portfolio';

  let data = $state<any>(null);
  let loading = $state(true);

  onMount(async () => {
    const res = await fetch(`${base}/api/campaign/${page.params.id}`);
    data = await res.json();
    loading = false;
  });

  const c = $derived(data?.campaign);
  const p = $derived(data?.proposal);
  const m = $derived(c?.metrics);

  const SEED: Partial<Record<LeverId, number>> = {
    shift_budget: 0.5, adjust_bid: 0.5, swap_creative: 0.75, spill_to_offsite: 0.8
  };
  const threshold = $derived(p ? (SEED[p.lever as LeverId] ?? 1) : 1);
  const outcome = $derived(
    !p ? 'none'
    : !p.gateOpen ? 'none'
    : p.lever === 'escalate_to_client' ? 'escalated'
    : p.leverConfidence >= threshold ? 'auto'
    : 'queued'
  );

  const eur = (n: number) => (n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${Math.round(n)}`);
  const fill = (l: any) => l.deliveredEur / l.allocatedEur;

  const rail = $derived<RailStat[]>(
    !p || !m
      ? []
      : [
          {
            label: 'Needs a person',
            value: `${(p.gateProbability * 100).toFixed(0)}%`,
            tone: p.gateOpen ? 'bad' : 'good',
            bar: p.gateProbability,
            threshold: 0.5,
            note: p.gateOpen ? 'raised to the queue' : 'nothing raised'
          },
          {
            label: 'CPA',
            value: `${m.cpa.toFixed(2)}`,
            tone: m.cpaVsTargetPct > 5 ? 'bad' : m.cpaVsTargetPct > 0 ? 'warn' : 'good',
            note: `${m.cpaVsTargetPct > 0 ? '+' : ''}${m.cpaVsTargetPct}% vs ${c.targetCpaEur.toFixed(2)}`
          },
          { label: 'Attributed ROAS', value: `${m.roas.toFixed(2)}x`, note: `${c.measurement?.impressionBasis ?? 'viewable'} basis` },
          {
            label: 'Pacing',
            value: m.pacing.toFixed(2),
            tone: m.pacing > 1.15 ? 'bad' : 'good',
            note: `${m.daysRemaining} days remaining`
          },
          {
            label: 'Underfilled',
            value: m.underfillEur ? eur(m.underfillEur) : 'none',
            tone: m.underfillEur > 0 ? 'bad' : 'good'
          },
          {
            label: 'Spend at risk',
            value: m.spendAtRisk ? eur(m.spendAtRisk) : 'none',
            tone: m.spendAtRisk > 0 ? 'warn' : 'good',
            note: 'on placements above target'
          },
          {
            label: 'Max discrepancy',
            value: `${m.maxDiscrepancy}%`,
            tone: m.discrepancyBreachesContract ? 'bad' : m.discrepancyBreachesMrc ? 'warn' : 'good',
            note: m.discrepancyBreachesContract ? 'above the 10% contractual trigger' : 'within tolerance'
          }
        ]
  );

  const jevSteps = $derived<JevStep[]>(
    !p || !m
      ? []
      : [
          {
            label: 'What it read',
            primitive: 'campaign state',
            value: `${c.lines.length} placements`,
            sub: `spend, CPA, fill rate and creative decay per placement`,
            lit: true
          },
          {
            label: 'Does this need a person?',
            primitive: 'noul · bar at 50%',
            value: `${(p.gateProbability * 100).toFixed(0)}%`,
            bar: { value: p.gateProbability, threshold: 0.5, tone: p.gateOpen ? 'bad' : 'good' },
            sub: p.gateOpen ? 'above the bar, so it was raised' : 'below the bar, nothing was raised',
            lit: true
          },
          {
            label: 'What should we do?',
            primitive: `choice · over ${Object.keys(p.leverDistribution).length} permitted levers`,
            value: LEVERS[p.lever as LeverId].label,
            sub: `${(p.leverDistribution[p.lever] * 100).toFixed(0)}% of the weight, ${(p.leverConfidence * 100).toFixed(0)}% confidence`,
            lit: p.gateOpen
          },
          {
            label: 'How bad is it?',
            primitive: `score · 0 to ${SEVERITY_MAX}`,
            value: p.severity.toFixed(1),
            bar: { value: p.severity / SEVERITY_MAX, tone: p.severity > 2 ? 'bad' : 'good' },
            sub: severityLabel(p.severity),
            lit: p.gateOpen
          },
          {
            label: 'Can we act alone?',
            primitive: "confidence vs this lever's earned bar",
            value: threshold >= 1 ? 'review all' : `${(threshold * 100).toFixed(0)}% bar`,
            bar: { value: p.leverConfidence, threshold, tone: p.leverConfidence >= threshold ? 'good' : 'neutral' },
            sub: `confidence ${(p.leverConfidence * 100).toFixed(0)}%`,
            lit: p.gateOpen
          }
        ]
  );

  const jevOutcome = $derived(
    outcome === 'auto'
      ? { label: 'Acted on its own', why: "Confidence cleared this lever's earned bar, so nobody was asked.", tone: 'good' as const }
      : outcome === 'escalated'
        ? { label: 'Sent to the client', why: 'Every action that would fix this is outside the agency mandate.', tone: 'warn' as const }
        : outcome === 'queued'
          ? { label: 'Sent to Marta', why: 'Either the lever has not earned autonomy, or confidence fell short of its bar.', tone: 'bad' as const }
          : { label: 'Nothing raised', why: 'The campaign is inside its tolerances, so no proposal was made.', tone: 'neutral' as const }
  );

  const STAGES = ['Plan', 'Activate', 'Optimize', 'Report'];
</script>

{#if loading}
  <div class="page shell"><p class="muted">Loading…</p></div>
{:else if c}
  <div class="page">
    <div class="main">
    <nav class="crumbs"><a href={`${base}/today`}>Today</a> <span>/</span> {CLIENTS[c.clientId as ClientId].name}</nav>

    <header class="head">
      <div>
        <span class="eyebrow">{CLIENTS[c.clientId as ClientId].name} · {CLIENTS[c.clientId as ClientId].category}</span>
        <h1>{c.name}</h1>
        <p class="obj">{c.objective}</p>
      </div>
      <dl class="figs">
        <div><dt>Day</dt><dd>{c.day}/{c.flightDays}</dd></div>
        <div><dt>Delivered</dt><dd>{eur(m.delivered)}</dd></div>
        <div><dt>CPA</dt><dd class:bad={m.cpaVsTargetPct > 5}>${m.cpa.toFixed(2)}</dd></div>
        <div><dt>Target</dt><dd>${c.targetCpaEur.toFixed(2)}</dd></div>
        <div><dt>Pacing</dt><dd class:bad={m.pacing > 1.15}>{m.pacing.toFixed(2)}</dd></div>
        {#if m.underfillEur > 0}
          <div><dt>Underfilled</dt><dd class="bad">{eur(m.underfillEur)}</dd></div>
        {/if}
      </dl>
    </header>

    <div class="acts">
      <a class="act primary" href={`${base}/client-report/${c.id}`}>Create client report</a>
      {#if c.id === 'danone-oikos-protein'}
        <a class="act" href={`${base}/optimize`}>Replay this flight, tick by tick</a>
      {/if}
    </div>

    <ol class="lifecycle">
      {#each STAGES as s, i (s)}
        <li class:active={i === 2}>{s}</li>
      {/each}
      <li class="note">This decision happens in Optimize, continuously, against the policy set in Plan</li>
    </ol>

    <p class="headline">{c.headline}</p>

    <JevPanel
      steps={jevSteps}
      outcome={jevOutcome}
      meta={{ costUsd: p.costUsd, latencyMs: p.latencyMs ?? 0, source: p.source }}
      raw={{
        state: { campaign: c.name, day: c.day, flightDays: c.flightDays, targetCpaEur: c.targetCpaEur, metrics: m, lines: c.lines },
        questions: [
          { key: 'gate', type: 'noul', instructions: 'Does this campaign require a decision from the campaign manager right now? Judge it against its own objective, CPA target and pacing tolerance, not against a general notion of good performance.' },
          { key: 'lever', type: 'choice', instructions: 'Which single lever best corrects this campaign against its objective? Onsite surfaces have finite supply, so a low fill rate means the inventory does not exist and bidding harder will not help.', optionCount: Object.keys(p.leverDistribution).length },
          { key: 'severity', type: 'score', instructions: 'How severe is the gap between current performance and the stated objective?' }
        ],
        answers: { gate: p.gateProbability, lever: p.lever, distribution: p.leverDistribution, confidence: p.leverConfidence, severity: p.severity }
      }}
    />

    <h2 class="sh">Measurement basis and delivery quality</h2>
    <div class="quality">
      <div class="q">
        <span>Attributed ROAS</span>
        <strong>{m.roas.toFixed(2)}×</strong>
        <small>
          {c.measurement?.attributionWindowDays ?? 14} day window ·
          {c.measurement?.ntbLookbackDays ?? 365} day new-to-brand lookback ·
          {c.measurement?.impressionBasis ?? 'viewable'} impressions
        </small>
      </div>
      <div class="q" data-bad={m.discrepancyBreachesContract}>
        <span>Max discrepancy</span>
        <strong>{m.maxDiscrepancy}%</strong>
        <small>
          {#if m.discrepancyBreachesContract}
            Above the 10% IAB and 4A's Standard Terms trigger. This is a contractual reconciliation
            event, not something to optimise through
          {:else if m.discrepancyBreachesMrc}
            Above MRC's 5% materiality bar, below the 10% contractual trigger
          {:else}
            Within both the MRC 5% bar and the 10% contractual trigger
          {/if}
        </small>
      </div>
      <div class="q" data-bad={m.ivtBreachesMrc}>
        <span>Invalid traffic</span>
        <strong>{m.maxIvt}%</strong>
        <small>Sophisticated IVT filtration is mandatory for outcome measurement, not optional</small>
      </div>
      <p class="qnote">
        ROAS is shown with its basis because it is not comparable without one. Ovative and Albertsons
        found ROAS varies by 63 percent on methodology alone across 573 campaigns, and using served
        rather than viewable impressions overstates it by 35 percent. CPA is the agency's working
        target here; attributed sales is what the retail media network actually reports.
      </p>
    </div>

    <h2 class="sh">Where the money is going</h2>
    <table class="lines">
      <thead>
        <tr>
          <th>Placement</th><th>Audience</th>
          <th class="r">Allocated</th><th class="r">Delivered</th><th class="r">Fill</th>
          <th class="r">CPA</th><th class="r">CTR Δ</th><th class="r">Freq Δ</th><th class="r">vs target</th>
        </tr>
      </thead>
      <tbody>
        {#each c.lines as l (l.surface + l.audience)}
          {@const f = fill(l)}
          {@const over = ((l.cpaEur - c.targetCpaEur) / c.targetCpaEur) * 100}
          <tr class:target={p.targetSurface === l.surface}>
            <td>
              <span class="surf" data-s={l.surface}>{SURFACES[l.surface as SurfaceId].short}</span>
              {#if l.retailer}<span class="ret">{l.retailer}</span>{/if}
            </td>
            <td class="aud">{l.audience}</td>
            <td class="r num">{eur(l.allocatedEur)}</td>
            <td class="r num">{eur(l.deliveredEur)}</td>
            <td class="r num" class:bad={f < 0.9}>
              {(f * 100).toFixed(0)}%
              {#if f < 0.9}<small>underfill</small>{/if}
            </td>
            <td class="r num">${l.cpaEur.toFixed(2)}</td>
            <td class="r num" class:bad={l.ctrChangePct <= -15}>{l.ctrChangePct ? `${l.ctrChangePct}%` : '—'}</td>
            <td class="r num" class:bad={l.frequencyChangePct >= 25}>{l.frequencyChangePct ? `+${l.frequencyChangePct}%` : 'flat'}</td>
            <td class="r num" class:bad={over > 5} class:good={over <= 0}>
              {over > 0 ? '+' : ''}{over.toFixed(0)}%
            </td>
          </tr>
          {#if l.note}
            <tr class="noterow"><td colspan="9">{l.note}</td></tr>
          {/if}
        {/each}
      </tbody>
    </table>

    <p class="supply muted small">
      {SURFACES.sponsored_display.supply} · Offsite: {SURFACES.offsite.supply}. That asymmetry is why
      underfill and overspend need opposite actions, and why bidding harder cannot fix a fill problem.
    </p>

    {#if p.gateOpen}
      <div class="proposed">
        <span class="eyebrow">Proposed</span>
        <strong>{LEVERS[p.lever as LeverId].label}</strong>
        {#if p.targetSurface}<span class="on">on {SURFACES[p.targetSurface as SurfaceId].label}</span>{/if}
        <p class="meaning">{LEVERS[p.lever as LeverId].meaning}</p>
      </div>
    {/if}
    </div>

    {#if rail.length}
      <StatRail stats={rail} title="Campaign health" />
    {/if}
  </div>
{:else}
  <div class="page"><p>Not found.</p></div>
{/if}

<style>
  .acts { display: flex; gap: 0.5rem; margin: 1rem 0 0; flex-wrap: wrap; }
  .act { font-size: 0.82rem; padding: 0.4rem 0.8rem; border-radius: 8px; border: 1px solid var(--border); background: var(--surface-1); color: var(--text-primary); text-decoration: none; }
  .act:hover { background: var(--hover); }
  .act.primary { background: var(--series-1); border-color: var(--series-1); color: #fff; font-weight: 600; }
  .act.primary:hover { filter: brightness(1.08); }
  .shell { display: grid; grid-template-columns: minmax(0, 1fr) 232px; gap: 1.1rem; align-items: start; }
  .shell > .main { min-width: 0; }
  @media (max-width: 900px) { .shell { grid-template-columns: 1fr; } }
  .crumbs { font-size: 0.76rem; color: var(--text-muted); margin-bottom: 0.6rem; }
  .crumbs a { color: var(--text-secondary); text-decoration: none; }
  .crumbs a:hover { text-decoration: underline; }

  .head { display: flex; justify-content: space-between; gap: 2rem; align-items: flex-start; flex-wrap: wrap; }
  .obj { color: var(--text-secondary); font-size: 0.85rem; margin: 0.3rem 0 0; max-width: 60ch; }
  .figs { display: flex; gap: 1.3rem; margin: 0; flex-wrap: wrap; }
  .figs dt { font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); }
  .figs dd { margin: 0.1rem 0 0; font-size: 1rem; font-variant-numeric: tabular-nums; }
  .figs dd.bad, td.bad { color: var(--critical); }
  td.good { color: var(--good-text); }

  .lifecycle { list-style: none; display: flex; align-items: center; gap: 0.35rem; padding: 0; margin: 1.25rem 0 1rem; flex-wrap: wrap; }
  .lifecycle li {
    font-size: 0.72rem; padding: 0.2rem 0.55rem; border-radius: 20px;
    background: var(--surface-2); color: var(--text-muted); border: 1px solid var(--border);
  }
  .lifecycle li.active { background: var(--series-1); color: #fff; border-color: var(--series-1); font-weight: 600; }
  .lifecycle li.note { background: none; border: none; color: var(--text-muted); padding-left: 0.5rem; }

  .headline { font-size: 0.92rem; color: var(--text-secondary); max-width: 92ch; margin: 0 0 1.5rem; }

  .sh { font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-muted); margin: 1.75rem 0 0.7rem; }

  .lines { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
  .lines th { text-align: left; font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); padding: 0.4rem 0.5rem; border-bottom: 1px solid var(--border); font-weight: 600; }
  .lines td { padding: 0.5rem; border-bottom: 1px solid var(--grid); }
  .lines .r { text-align: right; }
  .num { font-variant-numeric: tabular-nums; }
  .num small { display: block; font-size: 0.62rem; color: var(--critical); }
  tr.target { background: color-mix(in srgb, var(--series-1) 7%, transparent); }
  .noterow td { font-size: 0.74rem; color: var(--text-muted); padding-top: 0; border-bottom: 1px solid var(--grid); }
  .aud { color: var(--text-secondary); }
  .surf { font-size: 0.68rem; font-weight: 700; padding: 0.1rem 0.35rem; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.03em; }
  .surf[data-s='sponsored_display'] { background: color-mix(in srgb, var(--series-1) 16%, transparent); color: var(--series-1); }
  .surf[data-s='in_app'] { background: color-mix(in srgb, var(--series-3) 18%, transparent); color: var(--series-3); }
  .surf[data-s='offsite'] { background: color-mix(in srgb, var(--series-7) 16%, transparent); color: var(--series-7); }
  .ret { font-size: 0.72rem; color: var(--text-muted); margin-left: 0.35rem; }

  .quality { display: flex; gap: 1.2rem; flex-wrap: wrap; align-items: flex-start; padding: 0.85rem 1rem; background: var(--surface-1); border: 1px solid var(--border); border-radius: var(--radius); }
  .q { min-width: 160px; }
  .q span { display: block; font-size: 0.64rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); }
  .q strong { font-size: 1.4rem; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
  .q[data-bad='true'] strong { color: var(--critical); }
  .q small { display: block; font-size: 0.7rem; color: var(--text-secondary); margin-top: 0.15rem; max-width: 30ch; }
  .qnote { flex: 1 1 100%; font-size: 0.74rem; color: var(--text-muted); margin: 0.4rem 0 0; max-width: 100ch; }
  .supply { margin-top: 0.7rem; max-width: 96ch; }
  .muted { color: var(--text-muted); }
  .small { font-size: 0.75rem; }

  .proposed { margin-top: 1.5rem; padding: 0.9rem 1rem; background: var(--surface-1); border: 1px solid var(--border); border-left: 3px solid var(--series-1); border-radius: 0 var(--radius) var(--radius) 0; }
  .proposed strong { font-size: 1.2rem; letter-spacing: -0.015em; }
  .on { font-size: 0.85rem; color: var(--series-1); margin-left: 0.4rem; }
  .meaning { font-size: 0.8rem; color: var(--text-secondary); margin: 0.35rem 0 0; max-width: 80ch; }
</style>

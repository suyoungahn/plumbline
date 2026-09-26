<script lang="ts">
  import { base } from '$app/paths';
  import { campaignById } from '$lib/scenario/campaigns';
  import { records } from '$lib/mediaplan/store.svelte';
  import DecisionCell from '$lib/components/DecisionCell.svelte';
  import { campaignKey, remove, upsert } from '$lib/mediaplan/decisions';
  import { recommendation } from '$lib/mediaplan/recommend';
  import { CHANNELS } from '$lib/mediaplan/types';
  import { cad, lineName, paceAll, pct } from '$lib/mediaplan/calc';
  import { page } from '$app/state';
  import JevPanel from '$lib/components/JevPanel.svelte';
  import StatRail from '$lib/components/StatRail.svelte';
  import type { RailStat } from '$lib/components/stat-rail';
  import type { JevStep } from '$lib/components/jev-panel';
  import { SEVERITY_MAX, severityLabel } from '$lib/domain';
  import { LEVERS, type LeverId } from '$lib/domain';
  import { SURFACES, type SurfaceId } from '$lib/placements';
  import { CLIENTS, MANAGER, type ClientId } from '$lib/portfolio';

  let data = $state<any>(null);
  let loading = $state(true);

  // Book campaigns carry a recorded Jev decision; a campaign planned in Plumbline
  // (like the PC Express Pass sample) is read from its pacing instead.
  const isBook = $derived(!!campaignById(page.params.id!));
  const rec = $derived(records[page.params.id!]);
  const paced = $derived(rec ? paceAll(rec.plan, rec.pacing) : null);
  const campaignWhy = $derived(
    paced ? [paced.pacing === null ? '' : `${pct(paced.pacing)} of plan to date`, paced.cpa === null ? '' : `CPA ${cad(paced.cpa, 2)} vs ${cad(rec!.plan.targetCpa, 2)} target`].filter(Boolean).join('; ') : ''
  );

  function ruleCampaign(ruling: 'approved' | 'overruled') {
    if (!rec || !p) return;
    upsert(rec.decisions, {
      key: campaignKey(rec.pacing.dataThrough),
      date: rec.pacing.dataThrough,
      kind: 'campaign',
      lever: p.lever,
      subject: rec.plan.campaign,
      action: LEVERS[p.lever as LeverId].label,
      why: campaignWhy,
      gate: p.gateProbability,
      confidence: p.leverConfidence,
      source: p.source === 'replay' ? 'jev_recorded' : p.source === 'sim' ? 'stand_in' : 'jev',
      ruling,
      ruledBy: 'manager'
    });
  }

  $effect(() => {
    const id = page.params.id!;
    data = null;
    if (!campaignById(id)) {
      loading = false;
      return;
    }
    loading = true;
    fetch(`${base}/api/campaign/${id}`)
      .then((res) => res.json())
      .then((j) => {
        if (page.params.id === id) data = j;
      })
      .finally(() => (loading = false));
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

  const eur = (n: number) => (n >= 1000 ? `CA$${(n / 1000).toFixed(1)}k` : `CA$${Math.round(n)}`);
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
            primitive: '',
            value: `${c.lines.length} placements`,
            sub: `spend, CPA, fill rate and creative decay per placement`,
            lit: true
          },
          {
            label: 'Does this need a person?',
            primitive: '',
            value: `${(p.gateProbability * 100).toFixed(0)}%`,
            bar: { value: p.gateProbability, threshold: 0.5, tone: p.gateOpen ? 'bad' : 'good' },
            sub: p.gateOpen ? 'above the bar, so it was raised' : 'below the bar, nothing was raised',
            lit: true
          },
          {
            label: 'What should we do?',
            primitive: '',
            value: LEVERS[p.lever as LeverId].label,
            sub: `${(p.leverDistribution[p.lever] * 100).toFixed(0)}% of the weight, ${(p.leverConfidence * 100).toFixed(0)}% confidence`,
            lit: p.gateOpen
          },
          {
            label: 'How bad is it?',
            primitive: '',
            value: p.severity.toFixed(1),
            bar: { value: p.severity / SEVERITY_MAX, tone: p.severity > 2 ? 'bad' : 'good' },
            sub: severityLabel(p.severity),
            lit: p.gateOpen
          },
          {
            label: 'Can we act alone?',
            primitive: '',
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
          ? { label: `Sent to ${MANAGER.name.split(' ')[0]}`, why: 'Either the lever has not earned autonomy, or confidence fell short of its bar.', tone: 'bad' as const }
          : { label: 'Nothing raised', why: 'On track.', tone: 'neutral' as const }
  );

</script>

{#if loading}
  <div class="page shell"><p class="muted">Loading…</p></div>
{:else if c}
  <div class="page">
    <div class="main">
    <h2 class="status">{c.summary ?? c.headline}</h2>
    <p class="headline">{c.headline}</p>

    {#if p.gateOpen}
      <div class="proposed">
        <span class="sug">Suggested</span>
        <strong>{recommendation(c, p.lever as LeverId, p.targetSurface)}</strong>
        <p class="meaning">{campaignWhy}</p>
        {#if rec}
          <DecisionCell
            compact
            entry={rec.decisions.find((d) => d.key === campaignKey(rec.pacing.dataThrough))}
            needsYou={p.gateOpen}
            action={LEVERS[p.lever as LeverId].label}
            confidence={p.leverConfidence}
            gate={p.gateProbability}
            why={campaignWhy}
            alternatives={Object.entries(p.leverDistribution as Record<string, number>).filter(([k]) => k !== p.lever).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => LEVERS[k as LeverId].label.toLowerCase())}
            source={p.source === 'replay' ? 'jev_recorded' : p.source === 'sim' ? 'stand_in' : 'jev'}
            onrule={(ruling) => ruleCampaign(ruling)}
            onundo={() => remove(rec.decisions, campaignKey(rec.pacing.dataThrough))}
          />
        {/if}
      </div>
    {/if}

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
            <td class="r num">CA${l.cpaEur.toFixed(2)}</td>
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



    <details class="more">
      <summary>How it was decided</summary>
    <JevPanel
      steps={jevSteps}
      outcome={jevOutcome}
      meta={{ costUsd: p.costUsd, latencyMs: p.latencyMs ?? 0, source: p.source }}
      raw={{
        state: { campaign: c.name, day: c.day, flightDays: c.flightDays, targetCpaEur: c.targetCpaEur, metrics: m, lines: c.lines },
        questions: [
          { key: 'gate', type: 'noul', instructions: 'Does this campaign require a decision from the campaign manager right now? Judge it against its own objective, CPA target and pacing tolerance, not against a general notion of good performance.' },
          { key: 'lever', type: 'choice', instructions: 'Which single lever best corrects this campaign against its objective? Retailer onsite, in-app and off-app publisher deals have finite supply, so a low fill rate means the inventory does not exist and bidding harder will not help. Programmatic is unbounded but costs more.', optionCount: Object.keys(p.leverDistribution).length },
          { key: 'severity', type: 'score', instructions: 'How severe is the gap between current performance and the stated objective?' }
        ],
        answers: { gate: p.gateProbability, lever: p.lever, distribution: p.leverDistribution, confidence: p.leverConfidence, severity: p.severity }
      }}
    />

    </details>

    <details class="more">
      <summary>Measurement</summary>
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
        <small>Below the 5% MRC bar</small>
      </div>
      <p class="qnote">ROAS depends on method, so it is shown with its basis.</p>
    </div>

    </details>

    {#if c.id === 'agropur-natrel-protein'}
      <div class="acts"><a class="act" href={`${base}/optimize`}>Replay this flight, tick by tick</a></div>
    {/if}
    </div>
  </div>
{:else if !isBook && rec && paced}
  <div class="page">
    <p class="headline">
      {rec.plan.objective}. Day {paced.daysElapsed} of {paced.flightDays}: {cad(paced.spend)} spent, {paced.pacing === null ? '—' : pct(paced.pacing)} of plan,
      {paced.cpa === null ? 'no conversions yet' : `${cad(paced.cpa, 2)} per ${rec.plan.conversionName} against a ${cad(rec.plan.targetCpa, 2)} target`}.
    </p>
    <h2 class="section-title">Off plan</h2>
    <ul class="offband">
      {#each paced.rows.filter((r) => r.status === 'Overpacing' || r.status === 'Underpacing') as r (r.line.id)}
        <li><span class="mp-pill" data-s={r.status}>{r.status}</span> {lineName(r.line)} · {r.pacing === null ? '—' : pct(r.pacing)} of plan · {CHANNELS[r.line.channel].label}</li>
      {:else}
        <li>Every line is on plan.</li>
      {/each}
    </ul>
    <p class="muted">Suggestions are on <a href={`${base}/campaign/${page.params.id}/pacing`}>Delivery</a>.</p>
  </div>
{:else}
  <div class="page"><p>Not found.</p></div>
{/if}

<style>
  .acts { display: flex; gap: 0.5rem; margin: 1rem 0 0; flex-wrap: wrap; }
  .act { font-size: 0.82rem; padding: 0.4rem 0.8rem; border-radius: 8px; border: 1px solid var(--border); background: var(--surface-1); color: var(--text-primary); text-decoration: none; }
  .act:hover { background: var(--hover); }
  .shell { display: grid; grid-template-columns: minmax(0, 1fr) 232px; gap: 1.1rem; align-items: start; }
  @media (max-width: 900px) { .shell { grid-template-columns: 1fr; } }
  .offband { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.85rem; }
  .section-title { font-size: 0.9rem; margin: 1rem 0 0.5rem; }

  td.good { color: var(--good-text); }
  td.bad { color: var(--critical); }

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
  .surf[data-s='programmatic'] { background: color-mix(in srgb, var(--series-7) 16%, transparent); color: var(--series-7); }
  .surf[data-s='off_app'] { background: color-mix(in srgb, var(--series-4) 16%, transparent); color: var(--series-4); }
  .ret { font-size: 0.72rem; color: var(--text-muted); margin-left: 0.35rem; }

  .quality { display: flex; gap: 1.2rem; flex-wrap: wrap; align-items: flex-start; padding: 0.85rem 1rem; background: var(--surface-1); border: 1px solid var(--border); border-radius: var(--radius); }
  .q { min-width: 160px; }
  .q span { display: block; font-size: 0.64rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); }
  .q strong { font-size: 1.4rem; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
  .q[data-bad='true'] strong { color: var(--critical); }
  .q small { display: block; font-size: 0.7rem; color: var(--text-secondary); margin-top: 0.15rem; max-width: 30ch; }
  .qnote { flex: 1 1 100%; font-size: 0.74rem; color: var(--text-muted); margin: 0.4rem 0 0; max-width: 100ch; }
  .muted { color: var(--text-muted); }

  .proposed { margin-top: 1.5rem; padding: 0.9rem 1rem; background: var(--surface-1); border: 1px solid var(--border); border-left: 3px solid var(--series-1); border-radius: 0 var(--radius) var(--radius) 0; }
  .proposed strong { font-size: 1.2rem; letter-spacing: -0.015em; display: block; margin: 0.1rem 0 0.2rem; }
  .sug { font-size: 0.8rem; color: var(--text-muted); }
  .status { font-size: 1.45rem; font-weight: 650; letter-spacing: -0.02em; margin: 1.2rem 0 0.3rem; }
  details.more { margin-top: 1.2rem; border-top: 1px solid var(--grid); padding-top: 0.8rem; }
  details.more > summary { cursor: pointer; font-weight: 600; font-size: 0.95rem; color: var(--text-secondary); }
  details.more[open] > summary { margin-bottom: 0.8rem; }
  .meaning { font-size: 0.8rem; color: var(--text-secondary); margin: 0.35rem 0 0; max-width: 80ch; }
</style>

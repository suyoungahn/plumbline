<script lang="ts">
  import { base } from '$app/paths';
  import { onMount } from 'svelte';
  import { LEVERS, type LeverId } from '$lib/domain';
  import { SURFACES, type SurfaceId } from '$lib/placements';
  import { CLIENTS, MANAGER, type ClientId } from '$lib/portfolio';

  type Row = {
    campaign: {
      id: string; clientId: ClientId; name: string; targetCpaEur: number; budgetEur: number;
      day: number; flightDays: number; headline: string;
      metrics: { cpa: number; cpaVsTargetPct: number; pacing: number; underfillEur: number;
                 underfillPct: number; spendAtRisk: number; delivered: number; daysRemaining: number };
    };
    proposal: {
      gateProbability: number; gateOpen: boolean; lever: LeverId; leverConfidence: number;
      severity: number; targetSurface?: SurfaceId; source: string;
    };
  };

  let rows = $state<Row[]>([]);
  let summary = $state<Record<string, number | string> | null>(null);
  let loading = $state(true);
  let showCleared = $state(false);

  onMount(async () => {
    const res = await fetch(`${base}/api/portfolio`);
    const j = await res.json();
    rows = j.rows;
    summary = j.summary;
    loading = false;
  });

  const eur = (n: number) =>
    n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n}`;

  const queue = $derived(
    rows
      .filter((r) => r.proposal.gateOpen)
      .sort(
        (a, b) =>
          b.campaign.metrics.spendAtRisk + b.campaign.metrics.underfillEur -
          (a.campaign.metrics.spendAtRisk + a.campaign.metrics.underfillEur)
      )
  );
  const cleared = $derived(rows.filter((r) => !r.proposal.gateOpen));
  const atStake = (r: Row) => r.campaign.metrics.spendAtRisk + r.campaign.metrics.underfillEur;
</script>

<div class="page">
  <header class="top">
    <div>
      <span class="eyebrow">{MANAGER.role} · {MANAGER.agency}</span>
      <h1>{MANAGER.name}</h1>
    </div>
    {#if summary}
      <p class="disclaimer">Illustrative scenario. Not real campaign data.</p>
    {/if}
  </header>

  {#if loading}
    <p class="muted">Evaluating the book…</p>
  {:else if summary}

    <section class="hero">
      <div class="ratio">
        <div class="big">
          <strong>{summary.needsHuman}</strong>
          <span>need you today</span>
        </div>
        <div class="vs">of {summary.campaigns}</div>
        <div class="big quiet">
          <strong>{summary.handled}</strong>
          <span>cleared without you</span>
        </div>
      </div>
      <dl class="figures">
        <div><dt>Under management</dt><dd>{eur(summary.underManagement as number)}</dd></div>
        <div><dt>Spend at risk</dt><dd class="risk">{eur(summary.spendAtRisk as number)}</dd></div>
        <div><dt>Underfilled</dt><dd class="risk">{eur(summary.underfill as number)}</dd></div>
        <div><dt>Cost to decide</dt><dd>${summary.decisionCostUsd}</dd></div>
      </dl>
    </section>

    <p class="claim">
      Every campaign in this book was evaluated this morning for
      <strong>${summary.decisionCostUsd}</strong>. {summary.handled} of {summary.campaigns} cleared
      on their own. {MANAGER.name} reads {summary.needsHuman}.
      <span class="muted">This book used to need {MANAGER.bookUsedToNeed} people.</span>
      {#if summary.source === 'sim'}
        <span class="badge sim">Heuristic stand-in, not Jev</span>
      {/if}
    </p>

    <h2 class="section-head">Needs a decision</h2>
    <ul class="queue">
      {#each queue as r (r.campaign.id)}
        <li>
          <a class="card" href={`${base}/campaign/${r.campaign.id}`}>
            <div class="card-top">
              <div>
                <span class="client">{CLIENTS[r.campaign.clientId].name}</span>
                <strong class="cname">{r.campaign.name}</strong>
              </div>
              <span class="stake">{eur(atStake(r))} <small>at stake</small></span>
            </div>

            <p class="why">{r.campaign.headline}</p>

            <div class="card-foot">
              <span class="action">
                <span class="dot" data-lever={r.proposal.lever}></span>
                {LEVERS[r.proposal.lever].label}
                {#if r.proposal.targetSurface}
                  <span class="muted">· {SURFACES[r.proposal.targetSurface].label}</span>
                {/if}
              </span>
              <span class="meta">
                day {r.campaign.day}/{r.campaign.flightDays} ·
                CPA {r.campaign.metrics.cpa.toFixed(2)} vs {r.campaign.targetCpaEur.toFixed(2)} ·
                pacing {r.campaign.metrics.pacing.toFixed(2)}
              </span>
            </div>

            <div class="jevline">
              <span class="jl">
                <code>noul</code> needs a person
                <strong>{(r.proposal.gateProbability * 100).toFixed(0)}%</strong>
              </span>
              <span class="jl">
                <code>choice</code> confidence
                <strong>{(r.proposal.leverConfidence * 100).toFixed(0)}%</strong>
              </span>
              <span class="jl">
                <code>score</code> severity
                <strong>{r.proposal.severity.toFixed(1)}/4</strong>
              </span>
              <span class="seewhy">see how this was decided →</span>
            </div>
          </a>
        </li>
      {/each}
    </ul>

    <button class="reveal" onclick={() => (showCleared = !showCleared)}>
      {showCleared ? 'Hide' : 'Show'} the {cleared.length} that cleared without you
    </button>

    {#if showCleared}
      <ul class="cleared">
        {#each cleared as r (r.campaign.id)}
          <li>
            <a href={`${base}/campaign/${r.campaign.id}`}>
              <span class="c-client">{CLIENTS[r.campaign.clientId].name}</span>
              <span class="c-name">{r.campaign.name}</span>
              <span class="c-reason">
                gate {(r.proposal.gateProbability * 100).toFixed(0)}% · inside tolerance
              </span>
            </a>
          </li>
        {/each}
      </ul>
      <p class="muted small">
        Each of these was evaluated and cleared. Nothing was skipped, and the reason is on the record.
        That is the difference between an automation that watches everything and a person who can only
        open twenty tabs.
      </p>
    {/if}
  {/if}
</div>

<style>
  .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 1.5rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
  .disclaimer { font-size: 0.72rem; color: var(--text-muted); margin: 0.3rem 0 0; }

  .hero {
    display: flex; justify-content: space-between; align-items: center; gap: 2rem; flex-wrap: wrap;
    padding: 1.1rem 1.25rem; background: var(--surface-1);
    border: 1px solid var(--border); border-radius: var(--radius);
  }
  .ratio { display: flex; align-items: center; gap: 1.1rem; }
  .big { display: flex; flex-direction: column; }
  .big strong { font-size: 2.4rem; line-height: 1; letter-spacing: -0.03em; color: var(--series-2); }
  .big.quiet strong { color: var(--good-text); }
  .big span { font-size: 0.76rem; color: var(--text-secondary); margin-top: 0.15rem; }
  .vs { font-size: 0.75rem; color: var(--text-muted); }

  .figures { display: flex; gap: 1.6rem; margin: 0; flex-wrap: wrap; }
  .figures dt { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); }
  .figures dd { margin: 0.1rem 0 0; font-size: 1.05rem; font-variant-numeric: tabular-nums; }
  .figures dd.risk { color: var(--serious); }

  .claim { font-size: 0.88rem; color: var(--text-secondary); max-width: 82ch; margin: 1rem 0 1.5rem; }
  .claim strong { color: var(--text-primary); font-variant-numeric: tabular-nums; }

  .section-head { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-muted); margin-bottom: 0.6rem; }

  .queue { list-style: none; margin: 0 0 1.25rem; padding: 0; display: flex; flex-direction: column; gap: 0.6rem; }
  .card {
    display: block; padding: 0.85rem 1rem; text-decoration: none; color: inherit;
    background: var(--surface-1); border: 1px solid var(--border);
    border-left: 3px solid var(--serious); border-radius: var(--radius);
  }
  .card:hover { background: var(--hover); }
  .card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; }
  .client { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); display: block; }
  .cname { font-size: 1rem; letter-spacing: -0.01em; }
  .stake { font-size: 1.15rem; font-variant-numeric: tabular-nums; color: var(--serious); white-space: nowrap; }
  .stake small { font-size: 0.66rem; color: var(--text-muted); display: block; text-align: right; font-variant-numeric: normal; }

  .why { font-size: 0.85rem; color: var(--text-secondary); margin: 0.5rem 0 0.7rem; max-width: 92ch; }

  .card-foot { display: flex; justify-content: space-between; align-items: baseline; gap: 1rem; flex-wrap: wrap; }
  .action { font-size: 0.85rem; font-weight: 550; display: inline-flex; align-items: center; gap: 0.4rem; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--series-1); }
  .dot[data-lever='escalate_to_client'] { background: var(--warning); }
  .dot[data-lever='spill_to_offsite'] { background: var(--series-7); }
  .dot[data-lever='no_action'] { background: var(--good); }
  .jevline { display: flex; gap: 1rem; align-items: baseline; flex-wrap: wrap; margin-top: 0.6rem; padding-top: 0.55rem; border-top: 1px solid var(--grid); }
  .jl { font-size: 0.73rem; color: var(--text-muted); display: inline-flex; align-items: baseline; gap: 0.3rem; }
  .jl code { font-size: 0.62rem; font-weight: 700; background: var(--surface-3); padding: 0.05rem 0.28rem; border-radius: 3px; color: var(--text-secondary); }
  .jl strong { color: var(--text-primary); font-variant-numeric: tabular-nums; }
  .seewhy { margin-left: auto; font-size: 0.72rem; color: var(--series-1); font-weight: 600; }
  .meta { font-size: 0.74rem; color: var(--text-muted); font-variant-numeric: tabular-nums; }

  .reveal { font-size: 0.82rem; }
  .cleared { list-style: none; margin: 0.8rem 0 0; padding: 0; display: flex; flex-direction: column; gap: 1px; }
  .cleared a {
    display: grid; grid-template-columns: 9rem 1fr auto; gap: 0.8rem; align-items: baseline;
    padding: 0.4rem 0.6rem; font-size: 0.8rem; text-decoration: none; color: inherit;
    background: var(--surface-1); border-radius: 5px;
  }
  .cleared a:hover { background: var(--hover); }
  .c-client { color: var(--text-muted); font-size: 0.74rem; }
  .c-reason { color: var(--good-text); font-size: 0.72rem; font-variant-numeric: tabular-nums; }

  .muted { color: var(--text-muted); }
  .small { font-size: 0.76rem; max-width: 76ch; margin-top: 0.8rem; }

  .badge {
    font-size: 0.64rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;
    padding: 0.14rem 0.4rem; border-radius: 5px; margin-left: 0.3rem;
    border: 1px solid var(--border);
  }
  .badge.sim { background: color-mix(in srgb, var(--warning) 22%, transparent); color: var(--text-primary); }

  @media (max-width: 760px) { .hero { flex-direction: column; align-items: flex-start; } }
</style>

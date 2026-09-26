<script lang="ts">
  import { decisionCost } from '$lib/money';
  import { base } from '$app/paths';
  import { onMount } from 'svelte';
  import { LEVERS, type LeverId } from '$lib/domain';
  import { SURFACES, type SurfaceId } from '$lib/placements';
  import { CLIENTS, MANAGER, type ClientId } from '$lib/portfolio';
  import { campaignById } from '$lib/scenario/campaigns';
  import { RECORD_IDS, records, settings } from '$lib/mediaplan/store.svelte';
  import { localSuggestions } from '$lib/mediaplan/pacing-jev';
  import { cad, lineName, paceAll, pct } from '$lib/mediaplan/calc';
  import { band, campaignKey, pacingKey, RULING_LABEL } from '$lib/mediaplan/decisions';

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
  let termSummary = $state<{ needsHuman: number; terms: number; campaigns: number } | null>(null);

  // Campaigns planned in Plumbline have no recorded decision yet; their pacing lines
  // are read by the stand-in instead, so they still reach the inbox.
  const planned = $derived(
    RECORD_IDS.filter((id) => !campaignById(id)).map((id) => {
      const rec = records[id];
      const flagged = localSuggestions(rec.plan, rec.pacing)
        .map((s, i) => ({ s, line: rec.plan.lines[i] }))
        .filter((x) => x.s.needsYou && !rec.decisions.some((d) => d.key === pacingKey(rec.pacing.dataThrough, x.line.id)));
      return { id, rec, flagged };
    }).filter((x) => x.flagged.length)
  );
  let summary = $state<Record<string, number | string> | null>(null);
  let loading = $state(true);
  let showCleared = $state(false);

  onMount(async () => {
    const res = await fetch(`${base}/api/portfolio`);
    const j = await res.json();
    rows = j.rows;
    summary = j.summary;
    loading = false;
    try {
      termSummary = (await (await fetch(`${base}/api/keywords/all`)).json()).summary;
    } catch {
      termSummary = null;
    }
  });

  const eur = (n: number) =>
    n >= 1_000_000 ? `CA$${(n / 1_000_000).toFixed(2)}M` : n >= 1000 ? `CA$${(n / 1000).toFixed(1)}k` : `CA$${n}`;

  const open = $derived(
    rows.filter((r) => r.proposal.gateOpen && !records[r.campaign.id]?.decisions.some((d) => d.key === campaignKey(records[r.campaign.id].pacing.dataThrough))).length
  );
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
      <span class="eyebrow">Inbox · {MANAGER.role} · {MANAGER.agency}</span>
      <h1>{MANAGER.name}</h1>
    </div>
    {#if summary}
      <p class="disclaimer">Illustrative scenario. Not real campaign data.</p>
    {/if}
  </header>

  {#if !settings.welcomed}
    <section class="welcome">
      <h2>Welcome to Plumbline</h2>
      <ul>
        <li><strong>What it does.</strong> Every morning it checks every campaign, pacing line and search term against its plan, CPA target and available supply, and brings you only the ones that need a person.</li>
        <li><strong>What it can't know.</strong> It only sees the data: not a client call, a stock-out or a promotion that isn't in the plan. That is why anything touching budget, brand safety or client policy waits for you.</li>
        <li><strong>How to read a suggestion.</strong> <em>Clear call</em>: the evidence points one way. <em>Judgment call</em>: likely, check the reason. <em>Unsure</em>: the options are close and are shown side by side. Hover a label for the exact numbers.</li>
        <li><strong>Shadow mode is on.</strong> Routine changes are recorded as what the rules would do, and nothing is applied automatically until your team switches it off (top right).</li>
        <li><strong>Where to start.</strong> Open <a href={`${base}/campaigns`}>Campaigns</a>, pick one, and walk its tabs from Plan to Report. Every ruling you make lands on its Decisions tab.</li>
      </ul>
      <button class="ok" onclick={() => (settings.welcomed = true)}>Got it</button>
    </section>
  {/if}

  {#if loading}
    <p class="muted">Evaluating the book…</p>
  {:else if summary}

    <section class="hero">
      <div class="ratio">
        <div class="big">
          <strong>{open}</strong>
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
        <div><dt>Cost to decide</dt><dd>{decisionCost(summary.decisionCostUsd as number)}</dd></div>
      </dl>
    </section>

    <p class="claim">
      Every campaign in this book was evaluated this morning for
      <strong>{decisionCost(summary.decisionCostUsd as number)}</strong>. {summary.handled} of {summary.campaigns} cleared
      on their own. {MANAGER.name} reads {summary.needsHuman}{open < (summary.needsHuman as number) ? `, and has ruled on ${(summary.needsHuman as number) - open}` : ''}.
      <span class="muted">This book used to need {MANAGER.bookUsedToNeed} people.</span>
      {#if summary.source === 'sim'}
        <span class="badge sim">Heuristic stand-in, not Jev</span>
      {/if}
    </p>

    <h2 class="section-head">Needs a decision</h2>
    <ul class="queue">
      {#each queue as r (r.campaign.id)}
        {@const t = paceAll(records[r.campaign.id].plan, records[r.campaign.id].pacing)}
        {@const b = band(r.proposal.leverConfidence)}
        {@const ruled = records[r.campaign.id]?.decisions.find((d) => d.key === campaignKey(records[r.campaign.id].pacing.dataThrough))}
        <li>
          <a class="card" class:done={!!ruled} href={`${base}/campaign/${r.campaign.id}`}>
            {#if ruled}<span class="ruledtag">{RULING_LABEL[ruled.ruling]} by you: {ruled.action.toLowerCase()}</span>{/if}
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
                CPA {t.cpa === null ? '—' : cad(t.cpa, 2)} vs {cad(r.campaign.targetCpaEur, 2)} ·
                {t.pacing === null ? '—' : pct(t.pacing)} of plan
              </span>
            </div>

            <div class="jevline">
              <span class="bandchip" data-b={b.key} title={`${(r.proposal.gateProbability * 100).toFixed(0)}% that this needs a person; ${(r.proposal.leverConfidence * 100).toFixed(0)}% confidence in the action; severity ${r.proposal.severity.toFixed(1)} of 4. ${b.hint}`}>{b.label}</span>
              <span class="jl">{b.hint}</span>
              <span class="seewhy">see how this was decided →</span>
            </div>
          </a>
        </li>
      {/each}
    </ul>

    {#if planned.length || termSummary?.needsHuman}
      <h2 class="section-head">Also waiting on you</h2>
      <ul class="queue">
        {#each planned as x (x.id)}
          <li>
            <a class="card small" href={`${base}/campaign/${x.id}/pacing`}>
              <span class="client">{x.rec.plan.client}</span>
              <strong class="cname">{x.rec.plan.campaign}: {x.flagged.length} pacing {x.flagged.length === 1 ? 'line' : 'lines'} to review</strong>
              <p class="why">{x.flagged.map((f) => `${lineName(f.line)}: ${LEVERS[f.s.lever].label.toLowerCase()}`).join(' · ')}</p>
              <span class="badge sim">Heuristic stand-in, not Jev</span>
            </a>
          </li>
        {/each}
        {#if termSummary?.needsHuman}
          <li>
            <a class="card small" href={`${base}/keywords`}>
              <span class="client">Retail search · {termSummary.campaigns} campaigns</span>
              <strong class="cname">{termSummary.needsHuman} search terms need you</strong>
              <p class="why">Competitor and store-brand terms, brand-safety terms, and high-spend terms where the answer is unclear. The other {(termSummary.terms - termSummary.needsHuman).toLocaleString()} were handled.</p>
            </a>
          </li>
        {/if}
      </ul>
    {/if}

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
  .welcome { padding: 1rem 1.2rem; margin-bottom: 1.2rem; border-radius: var(--radius); background: color-mix(in srgb, var(--series-1) 7%, var(--surface-1)); border: 1px solid color-mix(in srgb, var(--series-1) 30%, transparent); }
  .welcome h2 { font-size: 1rem; margin-bottom: 0.5rem; }
  .welcome ul { margin: 0 0 0.8rem; padding-left: 1.1rem; display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.84rem; color: var(--text-secondary); max-width: 95ch; }
  .welcome strong { color: var(--text-primary); }
  .welcome .ok { background: var(--series-1); border-color: var(--series-1); color: #fff; font-weight: 600; }
  .card.done { opacity: 0.6; border-left-color: var(--series-1); }
  .ruledtag { display: inline-block; font-size: 0.66rem; font-weight: 700; color: var(--series-1); margin-bottom: 0.3rem; }
  .card.small { border-left-color: var(--warning); }
  .card.small .why { margin-bottom: 0.4rem; }
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
  .bandchip { font-size: 0.64rem; font-weight: 700; padding: 0.08rem 0.4rem; border-radius: 20px; cursor: help; }
  .bandchip[data-b='clear'] { background: color-mix(in srgb, var(--good) 16%, transparent); color: var(--good-text); }
  .bandchip[data-b='judgment'] { background: color-mix(in srgb, var(--warning) 24%, transparent); color: var(--text-primary); }
  .bandchip[data-b='unsure'] { background: color-mix(in srgb, var(--serious) 18%, transparent); color: var(--text-primary); }
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

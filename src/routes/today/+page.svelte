<script lang="ts">
  import { base } from '$app/paths';
  import { onMount } from 'svelte';
  import type { LeverId } from '$lib/domain';
  import { decisionCost } from '$lib/money';
  import { MANAGER } from '$lib/portfolio';
  import { campaignById } from '$lib/scenario/campaigns';
  import { RECORD_IDS, records, settings } from '$lib/mediaplan/store.svelte';
  import { localSuggestions } from '$lib/mediaplan/pacing-jev';
  import { lineName, paceAll } from '$lib/mediaplan/calc';
  import { band, campaignEntry, campaignKey, pacingEntry, pacingKey, pacingWhy, remove, RULING_LABEL, upsert } from '$lib/mediaplan/decisions';
  import { lineRecommendation, recommendation } from '$lib/mediaplan/recommend';
  import GettingStarted from '$lib/components/GettingStarted.svelte';
  import { autoApplies } from '$lib/mediaplan/autonomy';

  // The Inbox is the job: the few calls that need a person, each answerable right
  // here. Everything Plumbline handled on its own is one line at the bottom.

  type Proposal = { gateProbability: number; gateOpen: boolean; lever: LeverId; leverConfidence: number; targetSurface?: string; source: string };
  let rows = $state<{ campaign: { id: string }; proposal: Proposal }[]>([]);
  let summary = $state<{ campaigns: number; decisionCostUsd: number } | null>(null);
  let terms = $state<{ needsHuman: number; terms: number; autoApplied: number; campaigns: number; decisionCostUsd: number } | null>(null);
  let loading = $state(true);
  let openWhy = $state<string | null>(null);

  onMount(async () => {
    try {
      const j = await (await fetch(`${base}/api/portfolio`)).json();
      rows = j.rows;
      summary = j.summary;
      terms = (await (await fetch(`${base}/api/keywords/all`)).json()).summary;
    } finally {
      loading = false;
    }
  });

  const campaignItems = $derived(
    rows
      .filter((r) => r.proposal.gateOpen)
      .map((r) => {
        const c = campaignById(r.campaign.id)!;
        const rec = records[c.id];
        const t = paceAll(rec.plan, rec.pacing);
        const facts = [
          t.pacing === null ? '' : `${Math.round(t.pacing * 100)}% of plan to date`,
          t.cpa === null ? '' : `CPA CA$${t.cpa.toFixed(2)} vs CA$${c.targetCpaEur.toFixed(2)} target`
        ].filter(Boolean).join(' · ');
        return {
          id: c.id,
          where: `${rec.plan.client} · ${c.name}`,
          title: c.summary ?? c.headline,
          detail: c.headline,
          action: recommendation(c, r.proposal.lever, r.proposal.targetSurface),
          facts,
          p: r.proposal,
          ruled: rec.decisions.find((d) => d.key === campaignKey(rec.pacing.dataThrough))
        };
      })
  );

  const pacingGroups = $derived(
    RECORD_IDS.filter((id) => !campaignById(id))
      .map((id) => {
        const rec = records[id];
        const t = paceAll(rec.plan, rec.pacing);
        const sugg = localSuggestions(rec.plan, rec.pacing);
        const lines = t.rows
          .map((r, i) => ({ r, s: sugg[i] }))
          .filter((x) => x.s.needsYou)
          .map((x) => ({ ...x, ruled: rec.decisions.find((d) => d.key === pacingKey(rec.pacing.dataThrough, x.r.line.id)) }));
        return { id, rec, lines };
      })
      .filter((g) => g.lines.length)
  );

  // Action types the team has made automatic apply here without a person, and are
  // listed under "Handled for you" with an undo.
  $effect(() => {
    for (const item of campaignItems) {
      const rec = records[item.id];
      const key = campaignKey(rec.pacing.dataThrough);
      const auto = autoApplies(item.p.lever, item.p.leverConfidence, settings);
      if (auto && !item.ruled) upsert(rec.decisions, campaignEntry(rec.pacing.dataThrough, rec.plan.campaign, item.action, item.facts, item.p, 'auto'));
      else if (!auto && item.ruled?.ruling === 'auto') remove(rec.decisions, key);
    }
    for (const g of pacingGroups) {
      for (const x of g.lines) {
        const auto = autoApplies(x.s.lever, x.s.confidence, settings);
        if (auto && !x.ruled) upsert(g.rec.decisions, pacingEntry(g.rec.plan, g.rec.pacing, x.r, x.s, 'auto'));
        else if (!auto && x.ruled?.ruling === 'auto') remove(g.rec.decisions, pacingKey(g.rec.pacing.dataThrough, x.r.line.id));
      }
    }
  });

  const autoApplied = $derived([
    ...campaignItems.filter((i) => i.ruled?.ruling === 'auto').map((i) => ({ key: i.id, text: i.action, where: i.where, undo: () => { settings.autonomy[i.p.lever] = 'manual'; } })),
    ...pacingGroups.flatMap((g) => g.lines.filter((x) => x.ruled?.ruling === 'auto').map((x) => ({ key: x.r.line.id, text: lineRecommendation(x.r, x.s.lever), where: g.rec.plan.campaign, undo: () => { settings.autonomy[x.s.lever] = 'manual'; } })))
  ]);

  const openCount = $derived(
    campaignItems.filter((i) => !i.ruled).length +
      pacingGroups.reduce((s, g) => s + g.lines.filter((l) => !l.ruled).length, 0) +
      (terms?.needsHuman ? 1 : 0)
  );
  const handledCampaigns = $derived(rows.filter((r) => !r.proposal.gateOpen).length);
  const costUsd = $derived((summary?.decisionCostUsd ?? 0) + (terms?.decisionCostUsd ?? 0));

  function ruleCampaign(item: (typeof campaignItems)[number], ruling: 'approved' | 'overruled') {
    const rec = records[item.id];
    upsert(rec.decisions, campaignEntry(rec.pacing.dataThrough, rec.plan.campaign, item.action, item.facts, item.p, ruling));
  }
  function rulePacing(id: string, x: (typeof pacingGroups)[number]['lines'][number], ruling: 'approved' | 'overruled') {
    const rec = records[id];
    upsert(rec.decisions, pacingEntry(rec.plan, rec.pacing, x.r, x.s, ruling));
  }
  const firstName = MANAGER.name.split(' ')[0];
</script>

<div class="page inbox">
  <header class="hello">
    <h1>Good morning, {firstName}</h1>
    {#if !loading}
      <p class="sub">
        {#if openCount}{openCount} {openCount === 1 ? 'item needs' : 'items need'} review. Everything else is on track.{:else}All on track.{/if}
      </p>
    {/if}
  </header>

  <GettingStarted />

  {#if loading}
    <p class="muted">Loading…</p>
  {:else}
    <section class="stack" aria-label="Decisions">
      {#each campaignItems.filter((i) => i.ruled?.ruling !== 'auto') as item (item.id)}
        {@const b = band(item.p.leverConfidence)}
        <article class="item" class:done={!!item.ruled}>
          <div class="where">{item.where}</div>
          <h2>{item.title}</h2>
          <p class="rec">Suggested: <strong>{item.action}</strong></p>
          {#if item.ruled}
            <div class="row">
              <span class="done-tag">{RULING_LABEL[item.ruled.ruling]}{item.ruled.ruledBy === 'manager' ? ' by you' : ''}</span>
              <button class="plain" onclick={() => remove(records[item.id].decisions, campaignKey(records[item.id].pacing.dataThrough))}>Undo</button>
            </div>
          {:else}
            <div class="row">
              <button class="primary" onclick={() => ruleCampaign(item, 'approved')}>Approve</button>
              <button onclick={() => ruleCampaign(item, 'overruled')}>Decline</button>
              <button class="plain" aria-expanded={openWhy === item.id} onclick={() => (openWhy = openWhy === item.id ? null : item.id)}>Details</button>
              <span class="band" data-b={b.key}>{b.label}</span>
            </div>
          {/if}
          {#if openWhy === item.id}
            <div class="why">
              <p>{item.detail}</p>
              <p class="facts">{item.facts}</p>
              <a href={`${base}/campaign/${item.id}`}>Open campaign</a>
            </div>
          {/if}
        </article>
      {/each}

      {#each pacingGroups.map((g) => ({ ...g, lines: g.lines.filter((x) => x.ruled?.ruling !== 'auto') })).filter((g) => g.lines.length) as g (g.id)}
        <article class="item">
          <div class="where">{g.rec.plan.client} · {g.rec.plan.campaign}</div>
          <h2>{g.lines.length} {g.lines.length === 1 ? 'line is' : 'lines are'} off plan</h2>
          <ul class="lines">
            {#each g.lines as x (x.r.line.id)}
              {@const b = band(x.s.confidence)}
              <li class:done={!!x.ruled}>
                <div class="l-text">
                  <span class="l-name">{lineName(x.r.line)}</span>
                  <span class="l-rec">{lineRecommendation(x.r, x.s.lever)}</span>
                  <span class="l-why">{pacingWhy(x.r, g.rec.plan.targetCpa)}</span>
                </div>
                {#if x.ruled}
                  <span class="done-tag">{RULING_LABEL[x.ruled.ruling]}</span>
                  <button class="plain" onclick={() => remove(g.rec.decisions, pacingKey(g.rec.pacing.dataThrough, x.r.line.id))}>Undo</button>
                {:else}
                  <span class="band" data-b={b.key}>{b.label}</span>
                  <button class="primary small" onclick={() => rulePacing(g.id, x, 'approved')}>Approve</button>
                  <button class="small" onclick={() => rulePacing(g.id, x, 'overruled')}>Decline</button>
                {/if}
              </li>
            {/each}
          </ul>
          <a class="more" href={`${base}/campaign/${g.id}/pacing`}>Open pacing</a>
        </article>
      {/each}

      {#if terms?.needsHuman}
        <article class="item">
          <div class="where">Retail search · {terms.campaigns} campaigns</div>
          <h2>{terms.needsHuman} search terms to review</h2>
          <p class="rec">Competitor, brand-safety and high-spend terms.</p>
          <div class="row"><a class="button primary" href={`${base}/keywords`}>Review terms</a></div>
        </article>
      {/if}
    </section>

    <section class="handled" aria-label="On track">
      <h2>On track</h2>
      <ul>
        <li><strong>{handledCampaigns}</strong> campaigns on plan</li>
        {#if terms}<li><strong>{(terms.terms - terms.needsHuman).toLocaleString('en-CA')}</strong> search terms sorted</li>{/if}
        {#if terms}<li><strong>{terms.autoApplied}</strong> routine changes {settings.shadow ? 'queued' : 'applied'}</li>{/if}
      </ul>
      {#if autoApplied.length}
        <ul class="autolist">
          {#each autoApplied as a (a.key)}
            <li><span class="tag">Automatic</span> {a.text} <span class="muted">· {a.where}</span> <button class="plain" title="Sets this action type back to manual" onclick={a.undo}>Make manual</button></li>
          {/each}
        </ul>
      {/if}
      <p class="cost">Checked today for {decisionCost(costUsd)}. <a href={`${base}/campaigns`}>All campaigns</a></p>
    </section>
  {/if}
</div>

<style>
  .inbox { max-width: 760px; }
  .hello h1 { font-size: 2rem; font-weight: 700; letter-spacing: -0.025em; }
  .sub { font-size: 1.05rem; color: var(--text-secondary); margin: 0.3rem 0 1.5rem; }
  .muted { color: var(--text-muted); }

  .stack { display: flex; flex-direction: column; gap: 0.75rem; }
  .item { background: var(--surface-1); border-radius: 14px; padding: 1.1rem 1.25rem; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05), 0 0 0 1px var(--border); }
  .item.done { opacity: 0.55; }
  .where { font-size: 0.8rem; color: var(--text-muted); }
  .item h2 { font-size: 1.2rem; font-weight: 650; letter-spacing: -0.015em; margin: 0.15rem 0 0.2rem; }
  .rec { font-size: 0.98rem; margin: 0 0 0.85rem; color: var(--text-secondary); }
  .rec strong { color: var(--text-primary); font-weight: 600; }
  .row { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }

  button, .button { font-size: 0.9rem; padding: 0.45rem 1rem; border-radius: 999px; }
  .button { display: inline-block; text-decoration: none; border: 1px solid var(--border); }
  .primary { background: var(--series-1); border-color: var(--series-1); color: #fff; font-weight: 600; }
  .primary:hover:not(:disabled) { background: var(--series-1); filter: brightness(1.08); }
  .plain { background: none; border: none; color: var(--series-1); padding: 0.45rem 0.4rem; }
  .plain:hover:not(:disabled) { background: none; text-decoration: underline; }
  .small { font-size: 0.8rem; padding: 0.3rem 0.8rem; }

  .band { margin-left: auto; font-size: 0.72rem; font-weight: 600; padding: 0.15rem 0.55rem; border-radius: 999px; }
  .band[data-b='clear'] { background: color-mix(in srgb, var(--good) 15%, transparent); color: var(--good-text); }
  .band[data-b='judgment'] { background: color-mix(in srgb, var(--warning) 22%, transparent); color: var(--text-primary); }
  .band[data-b='unsure'] { background: color-mix(in srgb, var(--serious) 18%, transparent); color: var(--text-primary); }
  .done-tag { font-size: 0.85rem; font-weight: 600; color: var(--series-1); }

  .why { margin-top: 0.8rem; padding-top: 0.8rem; border-top: 1px solid var(--grid); font-size: 0.9rem; color: var(--text-secondary); }
  .why p { margin: 0 0 0.4rem; }
  .facts { color: var(--text-muted); }

  .lines { list-style: none; padding: 0; margin: 0.4rem 0 0.6rem; display: flex; flex-direction: column; }
  .lines li { display: flex; align-items: center; gap: 0.5rem; padding: 0.6rem 0; border-top: 1px solid var(--grid); flex-wrap: wrap; }
  .lines li.done { opacity: 0.55; }
  .l-text { display: flex; flex-direction: column; flex: 1 1 14rem; min-width: 0; }
  .l-name { font-size: 0.8rem; color: var(--text-muted); }
  .l-rec { font-weight: 600; }
  .l-why { font-size: 0.8rem; color: var(--text-muted); }
  .lines .band { margin-left: 0; }
  .more { font-size: 0.9rem; }

  .handled { margin-top: 2rem; }
  .handled h2 { font-size: 0.95rem; font-weight: 650; color: var(--text-secondary); margin-bottom: 0.5rem; }
  .handled ul { list-style: none; padding: 0; margin: 0; display: flex; gap: 1.5rem; flex-wrap: wrap; font-size: 0.95rem; color: var(--text-secondary); }
  .handled strong { color: var(--text-primary); font-variant-numeric: tabular-nums; }
  .autolist { list-style: none; padding: 0; margin: 0.8rem 0 0; display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.9rem; }
  .autolist .tag { font-size: 0.72rem; font-weight: 600; color: var(--good-text); background: color-mix(in srgb, var(--good) 14%, transparent); padding: 0.1rem 0.5rem; border-radius: 999px; margin-right: 0.3rem; }
  .autolist .plain { font-size: 0.8rem; padding: 0 0.3rem; }
  .cost { font-size: 0.85rem; color: var(--text-muted); margin-top: 0.7rem; }
</style>

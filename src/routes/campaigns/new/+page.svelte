<script lang="ts">
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { SUPPLY } from '$lib/supply';
  import { clients, createCampaign } from '$lib/mediaplan/store.svelte';
  import { CHANNELS, type ChannelId } from '$lib/mediaplan/types';
  import { addDays, cad, cadK, daysBetween, dayMonth, pct } from '$lib/mediaplan/calc';
  import {
    buildCampaign, defaultEnd, defaultPartner, defaultStart, PATTERNS, patternWeights, templateLines, TEMPLATES,
    type DraftLine, type Goal, type Pattern, type Template
  } from '$lib/mediaplan/new-campaign';

  // Three short steps; everything else is refined on the Plan tab afterwards.
  const STEPS = ['Basics', 'Channels', 'Flight'];
  let step = $state(0);
  let tried = $state(false);

  let clientId = $state('');
  let name = $state('');
  let objective = $state('');
  let goal = $state<Goal>('sale');
  let targetCpa = $state(20);
  let budget = $state(250_000);
  let flightStart = $state(defaultStart());
  let flightEnd = $state(defaultEnd());
  let template = $state<Template>('retail');
  let lines = $state<DraftLine[]>([]);
  let pattern = $state<Pattern>('even');

  onMount(() => {
    const fromUrl = new URLSearchParams(location.search).get('client');
    clientId = fromUrl && clients[fromUrl] ? fromUrl : Object.keys(clients)[0];
  });

  const client = $derived(clients[clientId]);
  const days = $derived(daysBetween(flightStart, flightEnd) + 1);
  const allocated = $derived(lines.reduce((s, l) => s + (Number(l.budget) || 0), 0));
  const weights = $derived(days > 0 ? patternWeights({ flightStart, flightEnd }, pattern) : []);
  const peak = $derived(Math.max(0.0001, ...weights));

  const errors = $derived([
    !name.trim() && 'Enter a campaign name.',
    !(budget > 0) && 'Enter a budget.',
    !(days > 0) && 'End date must be after the start date.'
  ].filter(Boolean) as string[]);

  function useTemplate(t: Template) {
    template = t;
    lines = templateLines(t, budget, client);
  }
  function split() {
    if (!lines.length) return;
    const each = Math.floor(budget / lines.length / 1000) * 1000;
    lines = lines.map((l, i) => ({ ...l, budget: i === 0 ? budget - each * (lines.length - 1) : each }));
  }
  function addChannel(ch: ChannelId) {
    lines = [...lines, { channel: ch, partner: defaultPartner(ch, client), budget: Math.max(0, budget - allocated) }];
  }
  const sellers = (ch: ChannelId) => {
    const surface = CHANNELS[ch].surface;
    return surface ? [...new Set(SUPPLY.filter((s) => s.surface === surface).map((s) => s.retailer))] : [];
  };

  function next() {
    tried = true;
    if (step === 0 && errors.length) return;
    tried = false;
    if (step === 0 && !lines.length) useTemplate(template);
    step += 1;
  }

  function create() {
    const id = createCampaign(clientId, buildCampaign({ client, name: name.trim(), objective: objective.trim() || name.trim(), goal, targetCpa, budget, flightStart, flightEnd, lines, pattern }));
    goto(`${base}/campaign/${id}/plan`);
  }
</script>

<div class="page wizard">
  <a class="back" href={`${base}/campaigns`}>Campaigns</a>
  <h1>New campaign</h1>

  <ol class="steps">
    {#each STEPS as s, i (s)}
      <li class:on={i === step} class:done={i < step}><span>{i < step ? '✓' : i + 1}</span>{s}</li>
    {/each}
  </ol>

  {#if step === 0}
    <section class="card">
      <label class="mp-field">Client
        <select bind:value={clientId}>
          {#each Object.entries(clients) as [id, c] (id)}<option value={id}>{c.name}</option>{/each}
        </select>
      </label>
      <a class="inline" href={`${base}/clients/new`}>New client</a>
      <label class="mp-field">Campaign name<input bind:value={name} placeholder="e.g. Spring launch" /></label>
      <label class="mp-field">Objective<input bind:value={objective} placeholder="e.g. Drive trial of the new range" /></label>
      <div class="three">
        <label class="mp-field">Goal
          <select bind:value={goal}>
            <option value="sale">Sales</option><option value="sign-up">Sign-ups</option><option value="conversion">Conversions</option>
          </select>
        </label>
        <label class="mp-field">Target CPA (CAD)<input type="number" min="0" step="0.5" bind:value={targetCpa} /></label>
        <label class="mp-field">Budget (CAD)<input type="number" min="0" step="5000" bind:value={budget} /></label>
      </div>
      <div class="two">
        <label class="mp-field">Start<input type="date" bind:value={flightStart} /></label>
        <label class="mp-field">End<input type="date" bind:value={flightEnd} /></label>
      </div>
      {#if tried && errors.length}<p class="err">{errors[0]}</p>{/if}
    </section>
  {:else if step === 1}
    <section class="card">
      <div class="seg" role="radiogroup" aria-label="Start from">
        {#each Object.entries(TEMPLATES) as [k, t] (k)}
          <button role="radio" aria-checked={template === k} class:on={template === k} onclick={() => useTemplate(k as Template)}>{t.label}</button>
        {/each}
      </div>

      <ul class="lines">
        {#each lines as l, i (i)}
          <li>
            <span class="ch">{CHANNELS[l.channel].label}</span>
            {#if sellers(l.channel).length}
              <select class="mp-in" bind:value={l.partner} aria-label="Seller">
                {#each sellers(l.channel) as s (s)}<option value={s}>{s}</option>{/each}
              </select>
            {:else}
              <input class="mp-in" bind:value={l.partner} placeholder="Partner" aria-label="Partner" />
            {/if}
            <input class="mp-in num" type="number" min="0" step="1000" bind:value={l.budget} aria-label="Budget" />
            <button class="x" aria-label="Remove" onclick={() => (lines = lines.filter((_, k) => k !== i))}>×</button>
          </li>
        {:else}
          <li class="empty">No channels yet.</li>
        {/each}
      </ul>

      <div class="row">
        <select class="mp-in add" value="" onchange={(e) => { const v = e.currentTarget.value as ChannelId; if (v) addChannel(v); e.currentTarget.value = ''; }} aria-label="Add channel">
          <option value="">Add channel…</option>
          {#each Object.entries(CHANNELS) as [id, c] (id)}<option value={id}>{c.label}</option>{/each}
        </select>
        <button onclick={split} disabled={!lines.length}>Split evenly</button>
        <span class="tot" class:bad={allocated !== budget}>{cad(allocated)} of {cad(budget)}</span>
      </div>
    </section>
  {:else}
    <section class="card">
      <div class="seg" role="radiogroup" aria-label="Weekly pattern">
        {#each Object.entries(PATTERNS) as [k, label] (k)}
          <button role="radio" aria-checked={pattern === k} class:on={pattern === k} onclick={() => (pattern = k as Pattern)}>{label}</button>
        {/each}
      </div>
      <div class="bars" aria-label="Spend by week">
        {#each weights as w, i (i)}
          <div class="bar" title={`Week ${i + 1}: ${cad(budget * w)}`}>
            <div class="fill" style:height={`${(w / peak) * 100}%`}></div>
            <span>{dayMonth(addDays(flightStart, i * 7))}</span>
            <small>{cadK(budget * w)}</small>
          </div>
        {/each}
      </div>
      <p class="sum">{name || 'New campaign'} · {client?.name} · {cad(budget)} over {days} days · {lines.length} {lines.length === 1 ? 'channel' : 'channels'} · target {cad(targetCpa, 2)} per {goal}</p>
    </section>
  {/if}

  <div class="actions">
    {#if step > 0}<button class="plain" onclick={() => (step -= 1)}>Back</button>{:else}<a class="btn" href={`${base}/campaigns`}>Cancel</a>{/if}
    {#if step < STEPS.length - 1}
      <button class="primary" onclick={next}>Next</button>
    {:else}
      <button class="primary" onclick={create} disabled={!lines.length}>Create campaign</button>
    {/if}
  </div>
</div>

<style>
  .wizard { max-width: 640px; }
  .back { font-size: 0.85rem; text-decoration: none; }
  .back::before { content: '‹ '; }
  h1 { font-size: 2rem; font-weight: 700; letter-spacing: -0.025em; margin: 0.3rem 0 1rem; }
  .steps { list-style: none; padding: 0; margin: 0 0 1.2rem; display: flex; gap: 1.2rem; }
  .steps li { display: flex; align-items: center; gap: 0.45rem; font-size: 0.9rem; color: var(--text-muted); }
  .steps li span { width: 1.5rem; height: 1.5rem; border-radius: 50%; display: grid; place-items: center; font-size: 0.75rem; font-weight: 700; background: var(--surface-3); }
  .steps li.on { color: var(--text-primary); font-weight: 600; }
  .steps li.on span { background: var(--series-1); color: #fff; }
  .steps li.done span { background: var(--good); color: #fff; }
  .card { display: flex; flex-direction: column; gap: 0.9rem; padding: 1.2rem 1.25rem; border-radius: 14px; background: var(--surface-1); box-shadow: 0 0 0 1px var(--border); }
  .inline { font-size: 0.85rem; margin-top: -0.5rem; }
  .two, .three { display: grid; gap: 0.8rem; }
  .two { grid-template-columns: 1fr 1fr; }
  .three { grid-template-columns: 1fr 1fr 1fr; }
  .err { color: var(--critical); font-size: 0.85rem; margin: 0; }
  .seg { display: inline-flex; align-self: flex-start; padding: 3px; gap: 2px; border-radius: 10px; background: var(--surface-3); }
  .seg button { border: none; background: none; padding: 0.35rem 0.9rem; border-radius: 8px; font-size: 0.85rem; color: var(--text-secondary); }
  .seg button.on { background: var(--surface-1); color: var(--text-primary); font-weight: 600; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08); }
  .lines { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; }
  .lines li { display: grid; grid-template-columns: 1fr 11rem 8rem 1.6rem; gap: 0.5rem; align-items: center; padding: 0.45rem 0; border-top: 1px solid var(--grid); }
  .lines li.empty { display: block; color: var(--text-muted); font-size: 0.9rem; }
  .ch { font-size: 0.9rem; }
  .x { border: none; background: none; font-size: 1.1rem; color: var(--text-muted); padding: 0; }
  .row { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
  .add { width: auto; }
  .row button { border-radius: 999px; font-size: 0.85rem; padding: 0.35rem 0.9rem; }
  .tot { margin-left: auto; font-size: 0.85rem; color: var(--good-text); font-variant-numeric: tabular-nums; }
  .tot.bad { color: var(--serious); }
  .bars { display: flex; gap: 6px; align-items: flex-end; height: 150px; }
  .bar { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; min-width: 0; }
  .fill { width: 100%; background: var(--seq-400); border-radius: 4px 4px 0 0; min-height: 2px; }
  .bar span { font-size: 0.7rem; color: var(--text-muted); margin-top: 0.3rem; }
  .bar small { font-size: 0.68rem; color: var(--text-secondary); font-variant-numeric: tabular-nums; }
  .sum { font-size: 0.88rem; color: var(--text-secondary); margin: 0; }
  .actions { display: flex; justify-content: space-between; margin-top: 1rem; }
  .actions button, .btn { font-size: 0.9rem; padding: 0.5rem 1.2rem; border-radius: 999px; }
  .btn { border: 1px solid var(--border); text-decoration: none; color: var(--text-primary); background: var(--surface-1); display: inline-block; }
  .primary { background: var(--series-1); border-color: var(--series-1); color: #fff; font-weight: 600; }
  .primary:hover:not(:disabled) { background: var(--series-1); filter: brightness(1.08); }
  .plain { background: none; border: none; color: var(--series-1); }
  @media (max-width: 600px) {
    .three, .two { grid-template-columns: 1fr; }
    .lines li { grid-template-columns: 1fr 1.6rem; }
    .lines li .mp-in { grid-column: 1 / 2; }
  }
</style>

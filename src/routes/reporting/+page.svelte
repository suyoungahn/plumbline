<script lang="ts">
  import { money, decisionCost } from '$lib/money';
  import { base } from '$app/paths';
  import { onMount } from 'svelte';
  import { LEVERS, type LeverId } from '$lib/domain';
  import { MANAGER } from '$lib/portfolio';

  let data = $state<any>(null);
  let loading = $state(true);

  onMount(async () => {
    data = await (await fetch(`${base}/api/reporting`)).json();
    loading = false;
  });

  const eur = (n: number) =>
    money(n);
</script>

<div class="page">
  <span class="eyebrow">{MANAGER.agency} · week to date</span>
  <h1>Reporting</h1>
  <p class="lede">
    Nothing on this page was assembled. Every figure is a sum over decisions that were recorded at the
    moment they were taken, which is why there is no deck, no platform export and no reconciliation
    step between the work and the report.
  </p>

  {#if loading}
    <p class="muted">Rolling up…</p>
  {:else if data}
    {@const t = data.totals}
    <section class="totals">
      <div><dt>Clients</dt><dd>{t.clients}</dd></div>
      <div><dt>Campaigns</dt><dd>{t.campaigns}</dd></div>
      <div><dt>Under management</dt><dd>{eur(t.budget)}</dd></div>
      <div><dt>Decisions taken</dt><dd>{t.decisions}</dd></div>
      <div><dt>Reached a human</dt><dd class="hl">{t.neededHuman}</dd></div>
      <div><dt>Cost to decide</dt><dd>{decisionCost(t.costUsd)}</dd></div>
    </section>

    <p class="claim">
      {t.decisions} decisions across {t.campaigns} campaigns cost <strong>{decisionCost(t.costUsd)}</strong> and
      consumed <strong>{t.neededHuman}</strong> pieces of human attention. The equivalent week of
      manual review is what {MANAGER.bookUsedToNeed} people used to spend their time on.
    </p>

    <table class="clients">
      <thead>
        <tr>
          <th>Advertiser</th>
          <th class="r">Campaigns</th>
          <th class="r">Budget</th>
          <th class="r">Delivered</th>
          <th class="r">CPA</th>
          <th class="r">Target</th>
          <th class="r">Underfilled</th>
          <th class="r">At risk</th>
          <th class="r">Human</th>
          <th>Actions taken</th>
        </tr>
      </thead>
      <tbody>
        {#each data.clients as c (c.id)}
          <tr>
            <td>
              <strong>{c.name}</strong>
              <span class="cat">{c.category}</span>
            </td>
            <td class="r num">{c.campaigns}</td>
            <td class="r num">{eur(c.budget)}</td>
            <td class="r num">{eur(c.delivered)}</td>
            <td class="r num" class:bad={c.cpa > c.targetCpa} class:good={c.cpa <= c.targetCpa}>CA${c.cpa.toFixed(2)}</td>
            <td class="r num muted">CA${c.targetCpa.toFixed(2)}</td>
            <td class="r num" class:bad={c.underfillEur > 0}>{c.underfillEur ? eur(c.underfillEur) : '—'}</td>
            <td class="r num" class:bad={c.spendAtRisk > 2000}>{c.spendAtRisk ? eur(c.spendAtRisk) : '—'}</td>
            <td class="r num">{c.neededHuman}<span class="of">/{c.campaigns}</span></td>
            <td>
              {#if Object.keys(c.leverMix).length === 0}
                <span class="none">nothing needed</span>
              {:else}
                {#each Object.entries(c.leverMix) as [lever, n] (lever)}
                  <span class="chip" data-lever={lever}>{LEVERS[lever as LeverId].label}{(n as number) > 1 ? ` ×${n}` : ''}</span>
                {/each}
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>

    <p class="muted small">
      Underfilled is plan money that could not be delivered because the inventory was not there. At risk
      is delivered spend sitting on placements above their target CPA. Both are invisible in a blended
      average, which is why they have their own columns: Tim Hortons at-home's blended CPA is inside target while
      {eur(data.clients.find((x: any) => x.id === 'timhortons')?.spendAtRisk ?? 0)} of its spend runs at
      nearly double it.
    </p>
  {/if}
</div>

<style>
  .lede { color: var(--text-secondary); max-width: 86ch; margin: 0.4rem 0 1.5rem; font-size: 0.92rem; }

  .totals { display: flex; gap: 1.8rem; flex-wrap: wrap; padding: 1rem 1.15rem; background: var(--surface-1); border: 1px solid var(--border); border-radius: var(--radius); }
  .totals dt { font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); }
  .totals dd { margin: 0.12rem 0 0; font-size: 1.3rem; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
  .totals dd.hl { color: var(--series-2); }

  .claim { font-size: 0.88rem; color: var(--text-secondary); max-width: 88ch; margin: 1.1rem 0 1.6rem; }
  .claim strong { color: var(--text-primary); font-variant-numeric: tabular-nums; }

  .clients { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
  .clients th { text-align: left; font-size: 0.64rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); padding: 0.45rem 0.5rem; border-bottom: 1px solid var(--border); font-weight: 600; }
  .clients td { padding: 0.6rem 0.5rem; border-bottom: 1px solid var(--grid); vertical-align: top; }
  .clients .r { text-align: right; }
  .num { font-variant-numeric: tabular-nums; }
  .cat { display: block; font-size: 0.7rem; color: var(--text-muted); }
  .of { color: var(--text-muted); font-size: 0.72rem; }
  td.bad { color: var(--critical); }
  td.good { color: var(--good-text); }
  .muted { color: var(--text-muted); }
  .none { font-size: 0.74rem; color: var(--good-text); }

  .chip {
    display: inline-block; margin: 0 0.25rem 0.25rem 0;
    font-size: 0.7rem; padding: 0.12rem 0.4rem; border-radius: 5px;
    background: color-mix(in srgb, var(--series-1) 14%, transparent); color: var(--series-1);
  }
  .chip[data-lever='escalate_to_client'] { background: color-mix(in srgb, var(--warning) 24%, transparent); color: var(--text-primary); }
  .chip[data-lever='spill_to_offsite'] { background: color-mix(in srgb, var(--series-7) 16%, transparent); color: var(--series-7); }

  .small { font-size: 0.76rem; max-width: 92ch; margin-top: 1rem; }
</style>

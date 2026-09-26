<script lang="ts">
  import { base } from '$app/paths';
  import { page } from '$app/state';
  import { CLIENTS, type ClientId } from '$lib/portfolio';
  import { SEARCH_TERMS } from '$lib/scenario/search-terms';
  import { RECORD_CLIENT, records } from '$lib/mediaplan/store.svelte';
  import { cad, paceAll, pct } from '$lib/mediaplan/calc';

  let { children } = $props();

  const id = $derived(page.params.id!);
  const rec = $derived(records[id]);
  const t = $derived(rec ? paceAll(rec.plan, rec.pacing) : null);
  const client = $derived(CLIENTS[RECORD_CLIENT[id] as ClientId]);
  const hasTerms = $derived(SEARCH_TERMS.some((s) => s.campaignId === id));

  // One workspace per campaign. Every campaign has the same tabs, in the order the
  // work happens: plan it, flight it, watch it, report on it.
  const tabs = $derived([
    { href: '', label: 'Overview' },
    { href: '/plan', label: 'Plan' },
    { href: '/flowchart', label: 'Flowchart' },
    { href: '/pacing', label: 'Pacing' },
    ...(hasTerms ? [{ href: '/search-terms', label: 'Search terms' }] : []),
    { href: '/report', label: 'Report' }
  ]);
  const root = $derived(`${base}/campaign/${id}`);
  const current = $derived(page.url.pathname.replace(/\/$/, ''));
</script>

{#if rec && t}
  <div class="ws-head no-print">
    <nav class="crumbs"><a href={`${base}/campaigns`}>Campaigns</a> <span>/</span> {client?.name}</nav>
    <div class="row">
      <div>
        <h1>{rec.plan.campaign}</h1>
        <p class="sub">{client?.name} · {client?.category} · {rec.plan.status}</p>
      </div>
      <dl class="figs">
        <div><dt>Day</dt><dd>{Math.max(0, Math.min(t.daysElapsed, t.flightDays))} of {t.flightDays}</dd></div>
        <div><dt>Spent</dt><dd>{cad(t.spend)}</dd><small>of {cad(rec.plan.totalBudget)}</small></div>
        <div>
          <dt>Pacing</dt>
          <dd class:warn={t.pacing !== null && (t.pacing > rec.pacing.overPace || t.pacing < rec.pacing.underPace)}>{t.pacing === null ? '—' : pct(t.pacing)}</dd>
          <small>band {pct(rec.pacing.underPace)}–{pct(rec.pacing.overPace)}</small>
        </div>
        <div>
          <dt>CPA</dt>
          <dd class:warn={t.cpa !== null && t.cpa > rec.plan.targetCpa}>{t.cpa === null ? '—' : cad(t.cpa, 2)}</dd>
          <small>target {cad(rec.plan.targetCpa, 2)}</small>
        </div>
      </dl>
    </div>
    <nav class="tabs" aria-label="Campaign sections">
      {#each tabs as tab (tab.label)}
        {@const href = `${root}${tab.href}`}
        <a {href} class:active={current === href} aria-current={current === href ? 'page' : undefined}>{tab.label}</a>
      {/each}
    </nav>
  </div>
  {@render children()}
{:else}
  <div class="page"><p>No campaign with this id. <a href={`${base}/campaigns`}>All campaigns</a></p></div>
{/if}

<style>
  .ws-head { max-width: 1320px; margin: 0 auto; padding: 1.2rem 1.25rem 0; }
  .crumbs { font-size: 0.76rem; color: var(--text-muted); margin-bottom: 0.4rem; }
  .crumbs a { color: var(--text-secondary); text-decoration: none; }
  .crumbs a:hover { text-decoration: underline; }
  .row { display: flex; justify-content: space-between; align-items: flex-end; gap: 1rem 2rem; flex-wrap: wrap; }
  .sub { margin: 0.2rem 0 0; font-size: 0.82rem; color: var(--text-secondary); }
  .figs { display: flex; gap: 1.4rem; margin: 0; flex-wrap: wrap; }
  .figs dt { font-size: 0.64rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); }
  .figs dd { margin: 0.1rem 0 0; font-size: 1.02rem; font-variant-numeric: tabular-nums; }
  .figs dd.warn { color: var(--serious); }
  .figs small { font-size: 0.68rem; color: var(--text-muted); }
  .tabs { display: flex; gap: 0.2rem; margin-top: 0.9rem; border-bottom: 1px solid var(--border); overflow-x: auto; }
  .tabs a { padding: 0.45rem 0.8rem; font-size: 0.85rem; font-weight: 500; color: var(--text-secondary); text-decoration: none; border-bottom: 2px solid transparent; margin-bottom: -1px; white-space: nowrap; }
  .tabs a:hover { color: var(--text-primary); }
  .tabs a.active { color: var(--text-primary); border-bottom-color: var(--series-1); font-weight: 650; }
</style>

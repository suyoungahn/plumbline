<script lang="ts">
  import { base } from '$app/paths';
  import { page } from '$app/state';
  import { SEARCH_TERMS } from '$lib/scenario/search-terms';
  import { clients, ready, RECORD_CLIENT, records } from '$lib/mediaplan/store.svelte';
  import { cad, dayMonth, paceAll, pct } from '$lib/mediaplan/calc';

  let { children } = $props();

  const id = $derived(page.params.id!);
  const rec = $derived(records[id]);
  const t = $derived(rec ? paceAll(rec.plan, rec.pacing) : null);
  const client = $derived(clients[RECORD_CLIENT[id]]);
  const hasTerms = $derived(SEARCH_TERMS.some((s) => s.campaignId === id));
  const logged = $derived(rec ? rec.decisions.length : 0);

  // One workspace per campaign, five tabs in the order the work happens. Plan and
  // Delivery each hold two views, switched with a segmented control.
  const tabs = $derived([
    { href: '', label: 'Overview', views: [] as { href: string; label: string }[] },
    { href: '/plan', label: 'Plan', views: [{ href: '/plan', label: 'Line items' }, { href: '/flowchart', label: 'Flowchart' }] },
    {
      href: '/pacing',
      label: 'Delivery',
      views: [{ href: '/pacing', label: 'Pacing' }, ...(hasTerms ? [{ href: '/search-terms', label: 'Search terms' }] : [])]
    },
    { href: '/decisions', label: logged ? `History (${logged})` : 'History', views: [] },
    { href: '/report', label: 'Report', views: [] }
  ]);
  const root = $derived(`${base}/campaign/${id}`);
  const current = $derived(page.url.pathname.replace(/\/$/, ''));
  const isOn = (tab: { href: string; views: { href: string }[] }) =>
    tab.views.length ? tab.views.some((v) => current === `${root}${v.href}`) : current === `${root}${tab.href}`;
  const activeTab = $derived(tabs.find(isOn));
</script>

{#if !ready.value}
  <div class="page"><p class="muted">Loading…</p></div>
{:else if rec && t}
  <div class="ws-head no-print">
    <nav class="crumbs"><a href={`${base}/campaigns`}>Campaigns</a> <span>/</span> {client?.name}</nav>
    <div class="row">
      <div>
        <h1>{rec.plan.campaign}</h1>
        <p class="sub">{client?.name} · {client?.category} · {rec.plan.status}</p>
      </div>
      <dl class="figs">
        <div><dt>Day</dt><dd>{t.daysElapsed < 1 ? `Starts ${dayMonth(rec.plan.flightStart)}` : `${Math.min(t.daysElapsed, t.flightDays)} of ${t.flightDays}`}</dd></div>
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
      {#each tabs as tab (tab.href)}
        {@const on = isOn(tab)}
        <a href={`${root}${tab.href}`} class:active={on} aria-current={on ? 'page' : undefined}>{tab.label}</a>
      {/each}
    </nav>
    {#if activeTab && activeTab.views.length > 1}
      <div class="seg" role="tablist" aria-label={`${activeTab.label} views`}>
        {#each activeTab.views as v (v.href)}
          <a role="tab" href={`${root}${v.href}`} aria-selected={current === `${root}${v.href}`} class:on={current === `${root}${v.href}`}>{v.label}</a>
        {/each}
      </div>
    {/if}
  </div>
  {@render children()}
{:else}
  <div class="page"><p>No campaign with this id. <a href={`${base}/campaigns`}>All campaigns</a></p></div>
{/if}

<style>
  .muted { color: var(--text-muted); }
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
  .seg { display: inline-flex; gap: 2px; margin-top: 0.9rem; padding: 3px; border-radius: 10px; background: var(--surface-3); }
  .seg a { padding: 0.3rem 0.9rem; border-radius: 8px; font-size: 0.85rem; color: var(--text-secondary); text-decoration: none; }
  .seg a.on { background: var(--surface-1); color: var(--text-primary); font-weight: 600; box-shadow: 0 1px 2px rgba(0,0,0,0.08); }
  .tabs a.active { color: var(--text-primary); border-bottom-color: var(--series-1); font-weight: 650; }
</style>

<script lang="ts">
  import { base } from '$app/paths';
  import { onMount } from 'svelte';
  import { CLIENTS, type ClientId } from '$lib/portfolio';
  import { LEVERS, type LeverId } from '$lib/domain';
  import { RECORD_CLIENT, RECORD_IDS, records } from '$lib/mediaplan/store.svelte';
  import { cad, paceAll, pct } from '$lib/mediaplan/calc';
  import { localSuggestions } from '$lib/mediaplan/pacing-jev';

  // One row per campaign, like the tracker sheet a team already keeps, but every
  // number is live and every row opens the campaign's workspace.
  let decisions = $state<Record<string, { gateOpen: boolean; lever: LeverId }>>({});
  let clientFilter = $state<string>('all');
  let statusFilter = $state<'all' | 'needs' | 'clear'>('all');
  let query = $state('');
  let sortKey = $state<'needs' | 'client' | 'pacing' | 'cpa' | 'budget'>('needs');

  onMount(async () => {
    try {
      const j = await (await fetch(`${base}/api/portfolio`)).json();
      decisions = Object.fromEntries(j.rows.map((r: any) => [r.campaign.id, { gateOpen: r.proposal.gateOpen, lever: r.proposal.lever }]));
    } catch {
      // No decisions available: the table still shows plan and pacing.
    }
  });

  const rows = $derived(
    RECORD_IDS.map((id) => {
      const rec = records[id];
      const t = paceAll(rec.plan, rec.pacing);
      const d = decisions[id];
      // Campaigns planned in Plumbline have no recorded decision yet, so they are
      // judged from their pacing lines.
      const flagged = d ? null : localSuggestions(rec.plan, rec.pacing).filter((s) => s.needsYou).length;
      const needs = d ? d.gateOpen : (flagged ?? 0) > 0;
      const action = d ? (d.gateOpen ? LEVERS[d.lever].label : 'Cleared') : flagged ? `${flagged} pacing ${flagged === 1 ? 'line' : 'lines'} to review` : 'Cleared';
      return { id, rec, t, clientId: RECORD_CLIENT[id] as ClientId, needs, action };
    })
  );

  const shown = $derived(
    rows
      .filter((r) => clientFilter === 'all' || r.clientId === clientFilter)
      .filter((r) => statusFilter === 'all' || (statusFilter === 'needs' ? r.needs : !r.needs))
      .filter((r) => !query || `${r.rec.plan.campaign} ${CLIENTS[r.clientId].name}`.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => {
        if (sortKey === 'needs') return Number(b.needs) - Number(a.needs) || b.rec.plan.totalBudget - a.rec.plan.totalBudget;
        if (sortKey === 'client') return CLIENTS[a.clientId].name.localeCompare(CLIENTS[b.clientId].name);
        if (sortKey === 'pacing') return Math.abs((b.t.pacing ?? 1) - 1) - Math.abs((a.t.pacing ?? 1) - 1);
        if (sortKey === 'cpa') return (b.t.cpaVsTarget ?? -9) - (a.t.cpaVsTarget ?? -9);
        return b.rec.plan.totalBudget - a.rec.plan.totalBudget;
      })
  );
  const needCount = $derived(rows.filter((r) => r.needs).length);
</script>

<div class="page">
  <header class="mp-top">
    <div>
      <h1>Campaigns</h1>
      <p class="lede">
        Every campaign in the book, {needCount} of {rows.length} with something to decide. Open a row to plan,
        flight, pace or report on it; each campaign has the same tabs.
      </p>
    </div>
  </header>

  <div class="filters">
    <label class="mp-field">Client
      <select bind:value={clientFilter}>
        <option value="all">All clients</option>
        {#each Object.entries(CLIENTS) as [id, c] (id)}<option value={id}>{c.name}</option>{/each}
      </select>
    </label>
    <label class="mp-field">Show
      <select bind:value={statusFilter}>
        <option value="all">All campaigns</option>
        <option value="needs">Needs a decision</option>
        <option value="clear">Cleared</option>
      </select>
    </label>
    <label class="mp-field">Sort by
      <select bind:value={sortKey}>
        <option value="needs">Needs a decision first</option>
        <option value="client">Client</option>
        <option value="pacing">Furthest from plan</option>
        <option value="cpa">Furthest over CPA target</option>
        <option value="budget">Budget</option>
      </select>
    </label>
    <label class="mp-field grow">Search<input bind:value={query} placeholder="Campaign or client" /></label>
  </div>

  <div class="mp-scroll mp-card flush">
    <table class="mp-table book">
      <thead>
        <tr>
          <th>Client</th><th>Campaign</th><th class="r">Day</th><th class="r">Budget</th><th class="r">Spent</th>
          <th class="r">Pacing</th><th class="r">CPA vs target</th><th>Status</th>
        </tr>
      </thead>
      <tbody>
        {#each shown as r (r.id)}
          {@const off = r.t.pacing !== null && (r.t.pacing > r.rec.pacing.overPace || r.t.pacing < r.rec.pacing.underPace)}
          <tr class:needs={r.needs}>
            <td class="muted">{CLIENTS[r.clientId].name}</td>
            <td><a href={`${base}/campaign/${r.id}`}>{r.rec.plan.campaign}</a></td>
            <td class="r num">{Math.min(r.t.daysElapsed, r.t.flightDays)}/{r.t.flightDays}</td>
            <td class="r num">{cad(r.rec.plan.totalBudget)}</td>
            <td class="r num">{cad(r.t.spend)}</td>
            <td class="r num" class:mp-warn={off}>{r.t.pacing === null ? '—' : pct(r.t.pacing)}</td>
            <td class="r num" class:mp-bad={(r.t.cpaVsTarget ?? 0) > 0.05} class:mp-ok={r.t.cpaVsTarget !== null && r.t.cpaVsTarget <= 0}>
              {r.t.cpaVsTarget === null ? '—' : `${r.t.cpaVsTarget > 0 ? '+' : ''}${(r.t.cpaVsTarget * 100).toFixed(0)}%`}
            </td>
            <td>{#if r.needs}<span class="flag">{r.action}</span>{:else}<span class="mp-muted">{r.action}</span>{/if}</td>
          </tr>
        {:else}
          <tr><td colspan="8" class="muted">No campaign matches these filters.</td></tr>
        {/each}
      </tbody>
    </table>
  </div>
  <p class="mp-note" style="margin-top: 0.6rem">
    Pacing is spend against the flowchart to date; the band is 90–110% unless a campaign sets its own. CPA vs target
    counts every line; each campaign's Report separates performance lines from awareness lines.
  </p>
</div>

<style>
  .lede { color: var(--text-secondary); max-width: 80ch; margin: 0.35rem 0 0; font-size: 0.9rem; }
  .filters { display: flex; gap: 0.6rem; flex-wrap: wrap; margin-bottom: 0.8rem; align-items: flex-end; }
  .filters .mp-field { min-width: 11rem; }
  .filters .grow { flex: 1 1 14rem; }
  .flush { padding: 0.2rem 0.4rem; }
  .book td a { font-weight: 600; text-decoration: none; }
  .book td a:hover { text-decoration: underline; }
  .book tr.needs td:first-child { box-shadow: inset 3px 0 0 var(--serious); }
  .flag { font-size: 0.74rem; font-weight: 650; color: var(--serious); }
</style>

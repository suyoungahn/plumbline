<script lang="ts">
  import { base } from '$app/paths';
  import { page } from '$app/state';
  import { records } from '$lib/mediaplan/store.svelte';
  import { band, RULING_LABEL, SOURCE_LABEL } from '$lib/mediaplan/decisions';
  import { shortDate } from '$lib/mediaplan/calc';
  import type { DecisionKind, Ruling } from '$lib/mediaplan/types';

  const doc = $derived(records[page.params.id!]);
  let show = $state<'all' | Ruling>('all');

  const KIND: Record<DecisionKind, string> = { campaign: 'Campaign', pacing: 'Pacing line', search_term: 'Search term' };
  const list = $derived(
    [...doc.decisions]
      .filter((d) => show === 'all' || d.ruling === show)
      .sort((a, b) => b.date.localeCompare(a.date) || a.kind.localeCompare(b.kind))
  );
  const counts = $derived({
    approved: doc.decisions.filter((d) => d.ruling === 'approved').length,
    overruled: doc.decisions.filter((d) => d.ruling === 'overruled').length,
    auto: doc.decisions.filter((d) => d.ruling === 'auto').length,
    shadow: doc.decisions.filter((d) => d.ruling === 'shadow').length
  });
</script>

<div class="page">
  <header class="mp-top">
    <div>
      <h2 class="tab-title">History</h2>
    </div>
  </header>

  {#if doc.decisions.length === 0}
    <section class="mp-card empty">
      <h3>No decisions yet</h3>
      <p>Approve or decline a suggestion on <a href={`${base}/campaign/${page.params.id}`}>Overview</a> or <a href={`${base}/campaign/${page.params.id}/pacing`}>Delivery</a>.</p>
    </section>
  {:else}
    <div class="filters">
      <label class="mp-field">Show
        <select bind:value={show}>
          <option value="all">All ({doc.decisions.length})</option>
          <option value="approved">Approved by you ({counts.approved})</option>
          <option value="overruled">Declined by you ({counts.overruled})</option>
          <option value="auto">Applied automatically ({counts.auto})</option>
          <option value="shadow">Would apply, learning mode ({counts.shadow})</option>
        </select>
      </label>
    </div>
    <div class="mp-scroll mp-card flush">
      <table class="mp-table">
        <thead>
          <tr><th>Date</th><th>What</th><th>Item</th><th>Action</th><th>Outcome</th><th>Reason</th><th>Source</th></tr>
        </thead>
        <tbody>
          {#each list as d (d.key)}
            {@const b = band(d.confidence)}
            <tr>
              <td class="num">{shortDate(d.date)}</td>
              <td class="muted">{KIND[d.kind]}</td>
              <td>{d.subject}</td>
              <td><strong>{d.action}</strong></td>
              <td><span class="out" data-r={d.ruling}>{RULING_LABEL[d.ruling]}{d.ruledBy === 'manager' ? ' by you' : ''}</span></td>
              <td class="muted">{d.why}{d.note ? ` · Note: ${d.note}` : ''}</td>
              <td class="muted" title={`${Math.round(d.gate * 100)}% that this needs a person; ${Math.round(d.confidence * 100)}% confidence`}>{SOURCE_LABEL[d.source]} · {b.label.toLowerCase()}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<style>
  .empty h3 { margin-bottom: 0.4rem; }
  .empty p { font-size: 0.85rem; color: var(--text-secondary); max-width: 80ch; margin: 0; }
  .filters { display: flex; gap: 0.6rem; margin-bottom: 0.8rem; }
  .flush { padding: 0.2rem 0.4rem; }
  .out { font-size: 0.7rem; font-weight: 700; padding: 0.08rem 0.4rem; border-radius: 20px; background: var(--surface-3); white-space: nowrap; }
  .out[data-r='approved'] { background: color-mix(in srgb, var(--series-1) 16%, transparent); color: var(--series-1); }
  .out[data-r='shadow'] { background: color-mix(in srgb, var(--series-7) 12%, transparent); color: var(--series-7); }
  .out[data-r='auto'] { background: color-mix(in srgb, var(--good) 14%, transparent); color: var(--good-text); }
</style>

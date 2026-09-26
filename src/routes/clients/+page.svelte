<script lang="ts">
  import { money } from '$lib/money';
  import { base } from '$app/paths';
  import { onMount } from 'svelte';
  import { LEVERS, type LeverId } from '$lib/domain';
  import { CLIENTS, type ClientId } from '$lib/portfolio';

  let rows = $state<any[]>([]);
  let loading = $state(true);
  let open = $state<ClientId | null>(null);

  onMount(async () => {
    const j = await (await fetch(`${base}/api/portfolio`)).json();
    rows = j.rows;
    loading = false;
  });

  const eur = money;
  const forClient = (id: ClientId) => rows.filter((r) => r.campaign.clientId === id);
</script>

<div class="page">
  <span class="eyebrow">Northfield Media</span>
  <h1>Clients</h1>
  <p class="lede">Six advertisers, {rows.length} live campaigns. Open one to see its book.</p>

  {#if loading}
    <p class="muted">Loading…</p>
  {:else}
    <ul class="list">
      {#each Object.entries(CLIENTS) as [id, c] (id)}
        {@const mine = forClient(id as ClientId)}
        {@const need = mine.filter((r) => r.proposal.gateOpen).length}
        <li>
          <button class="row" onclick={() => (open = open === id ? null : (id as ClientId))}>
            <span class="caret" class:o={open === id}>▸</span>
            <span class="nm">
              <strong>{c.name}</strong>
              <span class="cat">{c.category} · {c.retailers.join(', ')}</span>
            </span>
            <span class="count">{mine.length} campaigns</span>
            <span class="need" data-need={need > 0}>
              {need > 0 ? `${need} need you` : 'all clear'}
            </span>
          </button>

          {#if open === id}
            <ul class="camps">
              {#each mine as r (r.campaign.id)}
                <li>
                  <a href={`${base}/campaign/${r.campaign.id}`}>
                    <span class="cn">{r.campaign.name}</span>
                    <span class="cm">
                      day {r.campaign.day}/{r.campaign.flightDays} · {eur(r.campaign.metrics.delivered)} of {eur(r.campaign.budgetEur)}
                      · CPA CA${r.campaign.metrics.cpa.toFixed(2)}
                    </span>
                    <span class="cl" data-open={r.proposal.gateOpen}>
                      {r.proposal.gateOpen ? LEVERS[r.proposal.lever as LeverId].label : 'no action needed'}
                    </span>
                  </a>
                </li>
              {/each}
            </ul>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .lede { color: var(--text-secondary); margin: 0.4rem 0 1.4rem; font-size: 0.9rem; }
  .list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.4rem; }
  .row {
    width: 100%; display: grid; grid-template-columns: 1rem 1fr auto auto; gap: 0.9rem;
    align-items: center; text-align: left; padding: 0.7rem 0.9rem;
    background: var(--surface-1); border: 1px solid var(--border); border-radius: var(--radius);
  }
  .caret { color: var(--text-muted); font-size: 0.7rem; transition: transform 140ms; }
  .caret.o { transform: rotate(90deg); }
  .nm strong { font-size: 0.95rem; }
  .cat { display: block; font-size: 0.72rem; color: var(--text-muted); }
  .count { font-size: 0.78rem; color: var(--text-secondary); }
  .need { font-size: 0.72rem; font-weight: 600; padding: 0.15rem 0.45rem; border-radius: 5px; background: color-mix(in srgb, var(--good) 16%, transparent); color: var(--good-text); }
  .need[data-need='true'] { background: color-mix(in srgb, var(--serious) 22%, transparent); color: var(--text-primary); }

  .camps { list-style: none; margin: 0.3rem 0 0.5rem 1.9rem; padding: 0; display: flex; flex-direction: column; gap: 1px; }
  .camps a {
    display: grid; grid-template-columns: 14rem 1fr auto; gap: 0.8rem; align-items: baseline;
    padding: 0.4rem 0.6rem; font-size: 0.8rem; text-decoration: none; color: inherit; border-radius: 5px;
  }
  .camps a:hover { background: var(--hover); }
  .cn { font-weight: 550; }
  .cm { font-size: 0.73rem; color: var(--text-muted); font-variant-numeric: tabular-nums; }
  .cl { font-size: 0.72rem; color: var(--good-text); }
  .cl[data-open='true'] { color: var(--series-1); font-weight: 600; }
  .muted { color: var(--text-muted); }
</style>

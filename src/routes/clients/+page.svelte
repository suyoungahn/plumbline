<script lang="ts">
  import { base } from '$app/paths';
  import { onMount } from 'svelte';
  import { clients, campaignIds, records, RECORD_CLIENT } from '$lib/mediaplan/store.svelte';
  import { cad, paceAll, pct } from '$lib/mediaplan/calc';

  // Every client and its campaigns, including clients onboarded in this browser.
  let gates = $state<Record<string, boolean>>({});
  let open = $state<string | null>(null);

  onMount(async () => {
    try {
      const j = await (await fetch(`${base}/api/portfolio`)).json();
      gates = Object.fromEntries(j.rows.map((r: any) => [r.campaign.id, r.proposal.gateOpen]));
    } catch {
      gates = {};
    }
  });

  const list = $derived(
    Object.entries(clients).map(([id, c]) => {
      const mine = campaignIds()
        .filter((cid) => RECORD_CLIENT[cid] === id)
        .map((cid) => ({ id: cid, rec: records[cid], t: paceAll(records[cid].plan, records[cid].pacing) }));
      return { id, c, mine, need: mine.filter((m) => gates[m.id]).length, budget: mine.reduce((s, m) => s + m.rec.plan.totalBudget, 0) };
    })
  );
</script>

<div class="page clients">
  <header class="top">
    <h1>Clients</h1>
    <a class="btn primary" href={`${base}/clients/new`}>New client</a>
  </header>

  <ul class="list">
    {#each list as x (x.id)}
      <li>
        <button class="row" onclick={() => (open = open === x.id ? null : x.id)} aria-expanded={open === x.id}>
          <span class="caret" class:o={open === x.id}>▸</span>
          <span class="nm">
            <strong>{x.c.name}</strong>
            <span class="cat">{x.c.category}{x.c.retailers.length ? ` · ${x.c.retailers.join(', ')}` : ''}</span>
          </span>
          <span class="count">{x.mine.length} {x.mine.length === 1 ? 'campaign' : 'campaigns'} · {cad(x.budget)}</span>
          <span class="need" data-need={x.need > 0}>{x.mine.length === 0 ? 'no campaigns' : x.need > 0 ? `${x.need} to review` : 'on track'}</span>
        </button>

        {#if open === x.id}
          <div class="drawer">
            {#if x.c.contact?.name}
              <p class="contact">{x.c.contact.name}{x.c.contact.email ? ` · ${x.c.contact.email}` : ''}</p>
            {/if}
            <ul class="camps">
              {#each x.mine as m (m.id)}
                <li>
                  <a href={`${base}/campaign/${m.id}`}>
                    <span class="cn">{m.rec.plan.campaign}</span>
                    <span class="cm">{cad(m.rec.plan.totalBudget)} · {m.rec.plan.status}{m.t.pacing !== null ? ` · ${pct(m.t.pacing)} of plan` : ''}</span>
                  </a>
                </li>
              {/each}
            </ul>
            <a class="btn" href={`${base}/campaigns/new?client=${x.id}`}>New campaign</a>
          </div>
        {/if}
      </li>
    {/each}
  </ul>
</div>

<style>
  .clients { max-width: 900px; }
  .top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.2rem; }
  h1 { font-size: 2rem; font-weight: 700; letter-spacing: -0.025em; }
  .btn { display: inline-block; font-size: 0.9rem; padding: 0.45rem 1rem; border-radius: 999px; border: 1px solid var(--border); text-decoration: none; color: var(--text-primary); background: var(--surface-1); }
  .btn.primary { background: var(--series-1); border-color: var(--series-1); color: #fff; font-weight: 600; }
  .list { list-style: none; padding: 0; margin: 0; background: var(--surface-1); border-radius: 14px; box-shadow: 0 0 0 1px var(--border); }
  .list > li { border-top: 1px solid var(--grid); }
  .list > li:first-child { border-top: none; }
  .row { width: 100%; display: grid; grid-template-columns: 1rem 1fr auto 7rem; gap: 0.8rem; align-items: center; text-align: left; background: none; border: none; border-radius: 0; padding: 0.9rem 1.1rem; }
  .caret { color: var(--text-muted); transition: transform 0.15s; }
  .caret.o { transform: rotate(90deg); }
  .nm { display: flex; flex-direction: column; min-width: 0; }
  .cat { font-size: 0.8rem; color: var(--text-muted); }
  .count { font-size: 0.85rem; color: var(--text-secondary); font-variant-numeric: tabular-nums; }
  .need { font-size: 0.8rem; text-align: right; color: var(--good-text); }
  .need[data-need='true'] { color: var(--serious); font-weight: 600; }
  .drawer { padding: 0 1.1rem 1rem 2.9rem; }
  .contact { font-size: 0.85rem; color: var(--text-secondary); margin: 0 0 0.5rem; }
  .camps { list-style: none; padding: 0; margin: 0 0 0.8rem; }
  .camps a { display: flex; justify-content: space-between; gap: 1rem; padding: 0.45rem 0; text-decoration: none; color: inherit; border-top: 1px solid var(--grid); font-size: 0.9rem; }
  .camps a:hover .cn { text-decoration: underline; }
  .cm { color: var(--text-muted); font-size: 0.82rem; font-variant-numeric: tabular-nums; white-space: nowrap; }
  @media (max-width: 640px) {
    .row { grid-template-columns: 1rem 1fr auto; }
    .count { display: none; }
    .drawer { padding-left: 1.1rem; }
  }
</style>

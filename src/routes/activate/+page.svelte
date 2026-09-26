<script lang="ts">
  import { TICKS, POLICY, ADVERTISER } from '$lib/scenario/nuvola';

  const first = TICKS[0];
  let pushed = $state(false);
</script>

<div class="page">
  <span class="eyebrow">Stage 2 of 4</span>
  <h1>Activate</h1>
  <p class="lede">
    Deliberately the thinnest stage here. It shows the one thing that changes: nobody re-enters the
    plan. The policy is the source, and the line items derive from it rather than being transcribed.
  </p>

  <div class="bar">
    <button class="gen" onclick={() => (pushed = true)} disabled={pushed}>
      {pushed ? 'Live on 3 platforms' : 'Push policy to platforms'}
    </button>
    <span class="note">Mocked. No real platform is contacted.</span>
  </div>

  <div class="cards">
    {#each ['DV360', 'The Trade Desk', 'Retail Media'] as platform (platform)}
      {@const items = first.lineItems.filter((l) => l.platform === platform)}
      <section class="card plat" class:live={pushed}>
        <header>
          <h2>{platform}</h2>
          <span class="status" data-live={pushed}>{pushed ? 'Live' : 'Pending'}</span>
        </header>
        <ul>
          {#each items as l (l.id)}
            <li>
              <strong>{l.audience}</strong>
              <span>{l.placement} · {Math.round(l.shareOfSpend * 100)} percent of budget</span>
            </li>
          {/each}
        </ul>
      </section>
    {/each}
  </div>

  <p class="footer-note">
    {ADVERTISER.brand} · {ADVERTISER.market} · CA${POLICY.budgetEur.toLocaleString()} over {POLICY.flightDays} days
  </p>
</div>

<style>
  .lede { color: var(--text-secondary); max-width: 74ch; margin: 0.4rem 0 1.25rem; font-size: 0.95rem; }
  .bar { display: flex; align-items: center; gap: 0.8rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
  .gen { background: var(--series-1); border-color: var(--series-1); color: #fff; font-weight: 600; }
  .gen:hover:not(:disabled) { filter: brightness(1.08); background: var(--series-1); }
  .note { font-size: 0.78rem; color: var(--text-muted); }

  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 0.8rem; }
  .plat { padding: 0.9rem 1rem; opacity: 0.55; transition: opacity 300ms; }
  .plat.live { opacity: 1; }
  .plat header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.6rem; }
  .plat h2 { font-size: 0.92rem; }
  .status {
    font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;
    padding: 0.14rem 0.4rem; border-radius: 5px; background: var(--surface-3); color: var(--text-muted);
  }
  .status[data-live='true'] { background: color-mix(in srgb, var(--good) 18%, transparent); color: var(--good-text); }
  .plat ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
  .plat li strong { display: block; font-size: 0.83rem; }
  .plat li span { font-size: 0.74rem; color: var(--text-muted); }

  .footer-note { margin-top: 1.5rem; font-size: 0.75rem; color: var(--text-muted); }
</style>

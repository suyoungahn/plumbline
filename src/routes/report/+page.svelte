<script lang="ts">
  import { base } from '$app/paths';
  import { LEVERS } from '$lib/domain';
  import { ADVERTISER, POLICY, TICKS } from '$lib/scenario/nuvola';
  import { run } from '$lib/state.svelte';

  let text = $state('');
  let generated = $state(false);
  let busy = $state(false);

  const last = TICKS[TICKS.length - 1];

  async function build() {
    busy = true;
    try {
      const res = await fetch(`${base}/api/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ledger: run.ledger })
      });
      const j = await res.json();
      text = j.text;
      generated = j.generated;
    } finally {
      busy = false;
    }
  }
</script>

<div class="page">
  <span class="eyebrow">Stage 4 of 4</span>
  <h1>Report</h1>
  <p class="lede">
    Nothing here is assembled after the fact. Every decision was written to the ledger at the moment
    it was made, so the report is a rendering of a record rather than a reconstruction of one.
  </p>

  <div class="single">
    <section class="card side" data-side="agent">
      <header>
        <span class="eyebrow">Agent-first</span>
        <h2>The ledger is already the report</h2>
      </header>

      {#if run.ledger.length === 0}
        <p class="waiting">
          No decisions recorded yet. Run the Optimize stage first, then come back. That dependency is
          the point: this page cannot invent a history it does not have.
        </p>
      {:else}
        <ul class="ledger">
          {#each run.ledger as e (e.proposal.id)}
            <li>
              <span class="l-day tabular">Day {e.proposal.day}</span>
              <span class="l-lever">{LEVERS[e.proposal.lever].label}</span>
              <span class="l-by">{e.ruledBy === 'threshold' ? 'auto' : e.ruling}</span>
              <span class="l-sev tabular">sev {e.proposal.severity.toFixed(1)}</span>
            </li>
          {/each}
        </ul>

        <button class="gen" onclick={build} disabled={busy}>
          {busy ? 'Writing…' : 'Write the client update'}
        </button>

        {#if text}
          <div class="update">
            <div class="u-head">
              <span class="eyebrow">Client update · {ADVERTISER.brand} {ADVERTISER.market}</span>
              <span class="badge" data-kind={generated ? 'live' : 'sim'}>
                {generated ? 'Generated' : 'Assembled, no model'}
              </span>
            </div>
            <p class="u-text">{text}</p>
            <p class="src">
              CPA {last.cpaEur.toFixed(2)} against a {POLICY.targetCpaEur.toFixed(2)} target.
              The model is only allowed to phrase the ledger, never to add to it.
            </p>
          </div>
        {/if}
      {/if}
    </section>
  </div>
</div>

<style>
  .lede { color: var(--text-secondary); max-width: 74ch; margin: 0.4rem 0 1.5rem; font-size: 0.95rem; }
  .single { max-width: 720px; }
  .side { padding: 1.1rem 1.2rem; }
  .side header { margin-bottom: 0.9rem; }
  .side h2 { margin-top: 0.2rem; font-size: 0.98rem; }

  .waiting { font-size: 0.85rem; color: var(--text-muted); max-width: 58ch; }

  .ledger { list-style: none; margin: 0 0 1rem; padding: 0; display: flex; flex-direction: column; gap: 0.3rem; }
  .ledger li { display: flex; gap: 0.7rem; align-items: baseline; font-size: 0.83rem; padding: 0.3rem 0.5rem; background: var(--surface-2); border-radius: 6px; }
  .l-day { color: var(--text-muted); min-width: 3.8rem; }
  .l-lever { flex: 1; }
  .l-by { font-size: 0.72rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.04em; }
  .l-sev { font-size: 0.72rem; color: var(--text-muted); }

  .gen { background: var(--series-1); border-color: var(--series-1); color: #fff; font-weight: 600; }
  .gen:hover:not(:disabled) { filter: brightness(1.08); background: var(--series-1); }

  .update { margin-top: 1rem; padding: 0.85rem 0.95rem; background: var(--surface-2); border-radius: 8px; border: 1px solid var(--border); }
  .u-head { display: flex; justify-content: space-between; align-items: baseline; gap: 0.75rem; margin-bottom: 0.5rem; }
  .u-text { white-space: pre-wrap; font-size: 0.87rem; margin: 0; }

  .badge {
    font-size: 0.66rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;
    padding: 0.14rem 0.4rem; border-radius: 5px; border: 1px solid var(--border);
    background: var(--surface-3); color: var(--text-secondary);
  }
  .badge[data-kind='sim'] { background: color-mix(in srgb, var(--warning) 20%, transparent); color: var(--text-primary); }
  .badge[data-kind='live'] { background: color-mix(in srgb, var(--good) 18%, transparent); color: var(--good-text); }

  .src { font-size: 0.72rem; color: var(--text-muted); margin-top: 0.8rem; max-width: 62ch; }

</style>

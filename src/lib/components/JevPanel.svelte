<script lang="ts">

  import type { JevDelta, JevMeta, JevOutcome, JevRaw, JevStep } from './jev-panel';

  let {
    steps,
    outcome,
    meta,
    raw,
    delta = [],
    heading = 'How this decision was reached'
  }: {
    steps: JevStep[];
    outcome: JevOutcome;
    meta: JevMeta;
    raw: JevRaw;
    delta?: JevDelta[];
    heading?: string;
  } = $props();

  let open = $state(false);
  let tab = $state<'state' | 'questions' | 'answers'>('questions');
</script>

<section class="jev">
  <header>
    <div>
      <h2>{heading}</h2>
      <p class="sub">
        Three typed questions over a closed set of options. Nothing here is generated prose.
      </p>
    </div>
    <span class="prov" data-src={meta.source}>
      {meta.source === 'sim' ? 'Heuristic stand-in' : meta.source === 'replay' ? 'Recorded Jev' : 'Live Jev'}
    </span>
  </header>

  {#if delta.length}
    <ul class="delta">
      {#each delta as d (d.label)}
        <li>
          <span class="dl">{d.label}</span>
          <span class="from">{d.from}</span>
          <span class="arr">→</span>
          <span class="to" data-better={d.better}>{d.to}</span>
        </li>
      {/each}
      <li class="dnote">Jev re-evaluated your change. This is the model responding, not a recalculated formula.</li>
    </ul>
  {/if}

  <ol class="steps">
    {#each steps as s, i (s.label)}
      <li class="step" class:lit={s.lit}>
        <span class="n">{i + 1}</span>
        <h3>{s.label}</h3>
        <p class="val">{s.value}</p>
        {#if s.bar}
          <div class="bar">
            <div class="fill" data-tone={s.bar.tone} style:width={`${Math.min(1, Math.max(0, s.bar.value)) * 100}%`}></div>
            {#if s.bar.threshold !== undefined && s.bar.threshold < 1}
              <div class="cut" style:left={`${s.bar.threshold * 100}%`}></div>
            {/if}
          </div>
        {/if}
        {#if s.sub}<p class="ssub">{s.sub}</p>{/if}
        <code>{s.primitive}</code>
      </li>
    {/each}
    <li class="step lit outcome" data-tone={outcome.tone}>
      <span class="n">{steps.length + 1}</span>
      <h3>{outcome.label}</h3>
      <p class="ssub">{outcome.why}</p>
      <code>written to the record either way</code>
    </li>
  </ol>

  <footer>
    <span>{meta.latencyMs || '—'}ms</span>
    <span>${meta.costUsd.toFixed(6)}</span>
    {#if meta.model}<span class="mdl">{meta.model}</span>{/if}
    <button onclick={() => (open = !open)}>{open ? 'Hide' : 'Show'} exactly what Jev was asked</button>
  </footer>

  {#if open}
    <div class="inspect">
      <nav>
        <button class:on={tab === 'questions'} onclick={() => (tab = 'questions')}>Questions</button>
        <button class:on={tab === 'state'} onclick={() => (tab = 'state')}>State it read</button>
        <button class:on={tab === 'answers'} onclick={() => (tab = 'answers')}>Raw answers</button>
      </nav>
      {#if tab === 'questions'}
        <ul class="qs">
          {#each raw.questions as q (q.key)}
            <li>
              <div class="qh"><code>{q.type}</code><strong>{q.key}</strong>{#if q.optionCount}<span class="oc">over {q.optionCount} options</span>{/if}</div>
              <p>{q.instructions}</p>
            </li>
          {/each}
        </ul>
      {:else}
        <pre>{JSON.stringify(tab === 'state' ? raw.state : raw.answers, null, 2)}</pre>
      {/if}
    </div>
  {/if}
</section>

<style>
  .jev { background: var(--surface-1); border: 1px solid var(--border); border-left: 3px solid var(--series-1); border-radius: 0 var(--radius) var(--radius) 0; padding: 1rem 1.15rem; margin: 1rem 0; }
  header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap; }
  h2 { font-size: 0.95rem; }
  .sub { font-size: 0.76rem; color: var(--text-muted); margin: 0.2rem 0 0; }
  .prov { font-size: 0.64rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; padding: 0.15rem 0.45rem; border-radius: 5px; background: var(--surface-3); color: var(--text-secondary); white-space: nowrap; }
  .prov[data-src='live'] { background: color-mix(in srgb, var(--good) 18%, transparent); color: var(--good-text); }
  .prov[data-src='sim'] { background: color-mix(in srgb, var(--warning) 22%, transparent); color: var(--text-primary); }

  .delta { list-style: none; margin: 0.8rem 0 0; padding: 0.6rem 0.75rem; background: var(--surface-2); border-radius: 8px; display: flex; flex-direction: column; gap: 0.3rem; }
  .delta li { display: flex; align-items: baseline; gap: 0.5rem; font-size: 0.82rem; flex-wrap: wrap; }
  .dl { min-width: 10rem; color: var(--text-secondary); }
  .from { color: var(--text-muted); text-decoration: line-through; font-variant-numeric: tabular-nums; }
  .arr { color: var(--text-muted); }
  .to { font-weight: 700; font-variant-numeric: tabular-nums; color: var(--critical); }
  .to[data-better='true'] { color: var(--good-text); }
  .dnote { font-size: 0.73rem; color: var(--text-muted); margin-top: 0.2rem; }

  .steps {
    list-style: none; margin: 0.9rem 0 0; padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(168px, 1fr));
    gap: 0.5rem;
    align-items: stretch;
  }
  .step {
    position: relative;
    padding: 0.7rem 0.8rem 0.65rem;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 9px;
    opacity: 0.42;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .step.lit { opacity: 1; background: var(--surface-1); }
  .n { position: absolute; top: -8px; left: 0.65rem; width: 17px; height: 17px; border-radius: 50%; display: grid; place-items: center; font-size: 0.6rem; font-weight: 700; background: var(--surface-3); color: var(--text-secondary); border: 1px solid var(--border); }
  .step.lit .n { background: var(--series-1); color: #fff; border-color: var(--series-1); }
  h3 { font-size: 0.76rem; margin: 0.25rem 0 0.35rem; }
  .val { margin: 0; font-size: 1.05rem; font-weight: 650; letter-spacing: -0.015em; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
  .ssub { margin: 0.25rem 0 0; font-size: 0.71rem; color: var(--text-secondary); }
  code { display: block; margin-top: 0.45rem; font-size: 0.62rem; color: var(--text-muted); font-family: ui-monospace, monospace; overflow-wrap: anywhere; }

  .bar { position: relative; height: 6px; background: var(--surface-3); border-radius: 3px; margin-top: 0.35rem; }
  .fill { height: 100%; border-radius: 3px; transition: width 300ms cubic-bezier(0.22, 1, 0.36, 1); }
  .fill[data-tone='good'] { background: var(--good); }
  .fill[data-tone='bad'] { background: var(--critical); }
  .fill[data-tone='neutral'] { background: var(--series-1); }
  .cut { position: absolute; top: -3px; bottom: -3px; width: 2px; background: var(--text-primary); border-radius: 1px; }

  .outcome { border-width: 2px; }
  .outcome[data-tone='good'] { border-color: var(--good); }
  .outcome[data-tone='bad'] { border-color: var(--critical); }
  .outcome[data-tone='warn'] { border-color: var(--warning); }

  footer { display: flex; align-items: center; gap: 0.9rem; margin-top: 0.85rem; font-size: 0.73rem; color: var(--text-muted); font-variant-numeric: tabular-nums; flex-wrap: wrap; }
  footer button { font-size: 0.72rem; padding: 0.2rem 0.5rem; margin-left: auto; }
  .mdl { font-family: ui-monospace, monospace; }

  .inspect { margin-top: 0.8rem; }
  .inspect nav { display: flex; gap: 0.3rem; margin-bottom: 0.5rem; }
  .inspect nav button { font-size: 0.71rem; padding: 0.2rem 0.5rem; }
  .inspect nav button.on { background: var(--series-1); border-color: var(--series-1); color: #fff; }
  pre { margin: 0; padding: 0.7rem 0.8rem; background: var(--surface-2); border-radius: 7px; font-size: 0.7rem; overflow: auto; max-height: 340px; }
  .qs { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.6rem; }
  .qh { display: flex; align-items: baseline; gap: 0.45rem; }
  .qh code { display: inline; margin: 0; font-size: 0.64rem; font-weight: 700; background: var(--surface-3); padding: 0.08rem 0.32rem; border-radius: 4px; color: var(--text-secondary); }
  .oc { font-size: 0.7rem; color: var(--text-muted); }
  .qs p { font-size: 0.76rem; color: var(--text-secondary); margin: 0.2rem 0 0; max-width: 95ch; }
</style>

<script lang="ts">
  import { decisionCost } from '$lib/money';
  import { base } from '$app/paths';
  import { onMount } from 'svelte';
  import { campaignIds, records } from '$lib/mediaplan/store.svelte';
  import { RULING_LABEL } from '$lib/mediaplan/decisions';
  import { shortDate } from '$lib/mediaplan/calc';

  let data = $state<any>(null);
  let loading = $state(true);
  let openCall = $state<string | null>(null);
  let tab = $state<'state' | 'answers' | 'questions'>('state');
  let view = $state<'decisions' | 'calls'>('decisions');

  // Every ruling across every campaign, newest first.
  const all = $derived(
    campaignIds().flatMap((id) => records[id].decisions.map((d) => ({ ...d, campaignId: id, campaign: records[id].plan.campaign }))).sort(
      (x, y) => y.date.localeCompare(x.date) || x.campaign.localeCompare(y.campaign)
    )
  );

  onMount(async () => {
    data = await (await fetch(`${base}/api/jev-log`)).json();
    loading = false;
  });

  const a = $derived(data?.aggregate);
  const calls = $derived((data?.calls ?? []) as any[]);
  const maxBucket = $derived(a ? Math.max(...a.confidence.buckets.map((b: any) => b.n), 1) : 1);

  function download(kind: 'json' | 'csv') {
    let blob: Blob;
    if (kind === 'json') {
      blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    } else {
      const head = [
        'id', 'recordedAt', 'model', 'latencyMs', 'inputTokens', 'costUsd',
        'gate', 'gateOpen', 'lever', 'leverConfidence', 'severity', 'severityConfidence',
        'rulesLever', 'rulesConfidence', 'leverDiffers'
      ];
      const rows = calls.map((c) =>
        [
          c.id, c.recordedAt ?? '', c.model ?? '', c.latencyMs, c.usage?.input_tokens ?? '', c.usage?.cost ?? '',
          c.gate, c.gateOpen, c.lever ?? '', c.leverConfidence, c.severity ?? '', c.severityConfidence,
          c.baseline?.lever ?? '', c.baseline?.confidence ?? '', c.leverDiffers ?? ''
        ].join(',')
      );
      blob = new Blob([[head.join(','), ...rows].join('\n')], { type: 'text/csv' });
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `jev-log.${kind}`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const selected = $derived(calls.find((c) => c.id === openCall));
</script>

<div class="page">
  <header class="top">
    <div>
      <h1>History</h1>
    </div>
    {#if view === 'calls' && a}
      <div class="dl">
        <button onclick={() => download('json')}>Export JSON</button>
        <button onclick={() => download('csv')}>Export CSV</button>
      </div>
    {/if}
  </header>

  <div class="seg" role="tablist" aria-label="History views">
    <button role="tab" aria-selected={view === 'decisions'} class:on={view === 'decisions'} onclick={() => (view = 'decisions')}>Decisions</button>
    <button role="tab" aria-selected={view === 'calls'} class:on={view === 'calls'} onclick={() => (view = 'calls')}>Model calls</button>
  </div>

  {#if view === 'decisions'}
    {#if all.length === 0}
      <div class="empty">
        <p><strong>No decisions yet.</strong></p>
        <p>Approve or decline a suggestion in the <a href={`${base}/today`}>Inbox</a>.</p>
      </div>
    {:else}
      <div class="mp-scroll mp-card flush">
        <table class="mp-table">
          <thead><tr><th>Date</th><th>Campaign</th><th>Item</th><th>Change</th><th>Outcome</th></tr></thead>
          <tbody>
            {#each all as d (d.campaignId + d.key)}
              <tr>
                <td class="num muted">{shortDate(d.date)}</td>
                <td><a href={`${base}/campaign/${d.campaignId}/decisions`}>{d.campaign}</a></td>
                <td class="muted">{d.subject}</td>
                <td>{d.action}</td>
                <td><span class="out" data-r={d.ruling}>{RULING_LABEL[d.ruling]}{d.ruledBy === 'manager' ? ' by you' : ''}</span></td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  {:else}

  {#if loading}
    <p class="muted">Reading the log…</p>
  {:else if a}
    <section class="cards">
      <div><dt>Calls</dt><dd>{a.calls}</dd><small>{a.questionsPerCall} questions each</small></div>
      <div><dt>Decisions</dt><dd>{a.calls * a.questionsPerCall}</dd><small>answers</small></div>
      <div><dt>Total cost</dt><dd>{decisionCost(a.totalCostUsd)}</dd><small>{decisionCost(a.meanCostUsd)} per call</small></div>
      <div><dt>Median latency</dt><dd>{a.medianLatencyMs}ms</dd><small>max {a.maxLatencyMs}ms</small></div>
      <div><dt>Input tokens</dt><dd>{a.totalInputTokens.toLocaleString()}</dd><small>output billed at zero</small></div>
      <div><dt>Gate opened</dt><dd>{a.gateOpen}<span class="of">/{a.calls}</span></dd><small>{a.gateShut} raised nothing</small></div>
    </section>

    <div class="two">
      <section class="panel">
        <h2>Confidence is spread, not binary</h2>
        <p class="note">
          Jev's confidence across these calls runs from <strong>{a.confidence.min}</strong> to
          <strong>{a.confidence.max}</strong>, median <strong>{a.confidence.median}</strong>. That
          spread is the whole product mechanism: it is what decides whether a proposal executes or
          goes to a person.
        </p>
        <ul class="hist">
          {#each a.confidence.buckets as b (b.label)}
            <li>
              <span class="hl">{b.label}</span>
              <span class="ht"><span class="hf" style:width={`${(b.n / maxBucket) * 100}%`}></span></span>
              <span class="hn">{b.n}</span>
            </li>
          {/each}
        </ul>
      </section>

      <section class="panel">
        <h2>Against a rules engine, same inputs</h2>
        <p class="note">Same inputs, run through fixed rules.</p>
        <dl class="cmp">
          <div><dt>States compared</dt><dd>{a.baseline.compared}</dd></div>
          <div><dt>Chose a different lever</dt><dd>{a.baseline.leverDisagreements}</dd></div>
          <div><dt>Disagreed on whether to raise it</dt><dd>{a.baseline.gateDisagreements}</dd></div>
          <div class="hero">
            <dt>Rules engine would have acted alone where Jev asked for a person</dt>
            <dd class="big">{a.baseline.rulesWouldHaveActedAlone}</dd>
          </div>
        </dl>
        {#if a.baseline.examples.length}
          <table class="ex">
            <thead><tr><th>Decision</th><th>Jev</th><th>Rules engine</th></tr></thead>
            <tbody>
              {#each a.baseline.examples as e (e.id)}
                <tr>
                  <td class="id">{e.id}</td>
                  <td>{e.jevLever} <span class="lowc">conf {e.jevConfidence}</span></td>
                  <td>{e.rulesLever} <span class="highc">conf {e.rulesConfidence}</span></td>
                </tr>
              {/each}
            </tbody>
          </table>
          <p class="note punch">Fixed rules would have acted on these without asking. Jev flagged them for review.</p>
        {/if}
      </section>
    </div>

    <h2 class="sh">Every call</h2>
    <table class="log">
      <thead>
        <tr>
          <th>Decision</th><th class="r">Gate</th><th>Lever</th><th class="r">Conf</th>
          <th class="r">Severity</th><th class="r">Tokens</th><th class="r">Cost</th><th class="r">ms</th><th>Rules</th><th></th>
        </tr>
      </thead>
      <tbody>
        {#each calls as c (c.id)}
          <tr class:diff={c.leverDiffers}>
            <td class="id">{c.id}</td>
            <td class="r num" class:open={c.gateOpen}>{c.gate?.toFixed(2)}</td>
            <td>{c.lever ?? '—'}</td>
            <td class="r num">{c.leverConfidence?.toFixed(2)}</td>
            <td class="r num">{c.severity?.toFixed(2) ?? '—'}</td>
            <td class="r num muted">{c.usage?.input_tokens ?? '—'}</td>
            <td class="r num muted">{decisionCost(c.usage?.cost ?? 0)}</td>
            <td class="r num muted">{c.latencyMs || '—'}</td>
            <td class="num small">
              {#if c.baseline}
                <span class:differs={c.leverDiffers}>{c.baseline.lever}</span>
              {:else}—{/if}
            </td>
            <td><button class="insp" onclick={() => (openCall = openCall === c.id ? null : c.id)}>
              {openCall === c.id ? 'close' : 'inspect'}
            </button></td>
          </tr>
        {/each}
      </tbody>
    </table>

    {#if selected}
      <section class="drawer">
        <header>
          <strong>{selected.id}</strong>
          <span class="meta">{selected.model} · {selected.provider} · {selected.recordedAt}</span>
        </header>
        <nav class="tabs">
          <button class:on={tab === 'state'} onclick={() => (tab = 'state')}>State it read ({selected.stateFieldCount} fields)</button>
          <button class:on={tab === 'questions'} onclick={() => (tab = 'questions')}>Questions asked</button>
          <button class:on={tab === 'answers'} onclick={() => (tab = 'answers')}>Raw answers</button>
        </nav>
        {#if tab === 'questions'}
          <ul class="qs">
            {#each selected.questions as q (q.key)}
              <li>
                <div class="qh"><code>{q.type}</code> <strong>{q.key}</strong> <span class="muted">over {q.optionCount} options</span></div>
                <p>{q.instructions}</p>
              </li>
            {/each}
          </ul>
        {:else}
          <pre>{JSON.stringify(tab === 'state' ? selected.state : selected.answers, null, 2)}</pre>
        {/if}
      </section>
    {/if}
  {/if}
  {/if}
</div>

<style>
  .seg { display: inline-flex; gap: 2px; padding: 3px; border-radius: 10px; background: var(--surface-3); margin: 0 0 1rem; }
  .seg button { border: none; background: none; padding: 0.3rem 0.9rem; border-radius: 8px; font-size: 0.85rem; color: var(--text-secondary); }
  .seg button.on { background: var(--surface-1); color: var(--text-primary); font-weight: 600; box-shadow: 0 1px 2px rgba(0,0,0,0.08); }
  .empty { padding: 2rem 0; color: var(--text-secondary); }
  .empty p { margin: 0 0 0.3rem; }
  .flush { padding: 0.2rem 0.4rem; }
  .out { font-size: 0.72rem; font-weight: 600; padding: 0.1rem 0.45rem; border-radius: 999px; background: var(--surface-3); white-space: nowrap; }
  .out[data-r='approved'] { background: color-mix(in srgb, var(--series-1) 16%, transparent); color: var(--series-1); }
  .out[data-r='auto'] { background: color-mix(in srgb, var(--good) 14%, transparent); color: var(--good-text); }

  .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 2rem; flex-wrap: wrap; }
  .dl { display: flex; gap: 0.4rem; }

  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.6rem; margin-bottom: 1.25rem; }
  .cards > div { padding: 0.7rem 0.85rem; background: var(--surface-1); border: 1px solid var(--border); border-radius: var(--radius); }
  .cards dt { font-size: 0.64rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); }
  .cards dd { margin: 0.12rem 0 0; font-size: 1.35rem; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
  .cards small { display: block; font-size: 0.68rem; color: var(--text-muted); margin-top: 0.1rem; }
  .of { font-size: 0.8rem; color: var(--text-muted); }

  .two { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr); gap: 1rem; align-items: start; }
  .panel { padding: 1rem 1.15rem; background: var(--surface-1); border: 1px solid var(--border); border-radius: var(--radius); }
  .panel h2 { font-size: 0.92rem; margin-bottom: 0.5rem; }
  .note { font-size: 0.79rem; color: var(--text-secondary); margin: 0 0 0.8rem; max-width: 68ch; }
  .note strong { color: var(--text-primary); font-variant-numeric: tabular-nums; }
  .punch { margin-top: 0.8rem; }

  .hist { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 3px; }
  .hist li { display: grid; grid-template-columns: 4.6rem 1fr 1.6rem; gap: 0.6rem; align-items: center; }
  .hl { font-size: 0.72rem; color: var(--text-muted); font-variant-numeric: tabular-nums; }
  .ht { height: 14px; background: var(--surface-3); border-radius: 4px; overflow: hidden; }
  .hf { display: block; height: 100%; background: var(--seq-400); border-radius: 0 4px 4px 0; }
  .hn { font-size: 0.75rem; text-align: right; font-variant-numeric: tabular-nums; }

  .cmp { margin: 0; display: flex; flex-direction: column; gap: 0.45rem; }
  .cmp > div { display: flex; justify-content: space-between; align-items: baseline; gap: 1rem; }
  .cmp dt { font-size: 0.8rem; color: var(--text-secondary); }
  .cmp dd { margin: 0; font-size: 0.95rem; font-variant-numeric: tabular-nums; font-weight: 600; }
  .cmp .hero { padding-top: 0.5rem; border-top: 1px solid var(--grid); margin-top: 0.3rem; }
  .cmp .hero dt { color: var(--text-primary); max-width: 34ch; }
  .cmp dd.big { font-size: 2rem; color: var(--series-2); letter-spacing: -0.03em; }

  .ex { width: 100%; border-collapse: collapse; font-size: 0.75rem; margin-top: 0.8rem; }
  .ex th { text-align: left; font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); padding: 0.3rem 0.4rem; border-bottom: 1px solid var(--border); }
  .ex td { padding: 0.35rem 0.4rem; border-bottom: 1px solid var(--grid); }
  .lowc { color: var(--series-2); font-variant-numeric: tabular-nums; }
  .highc { color: var(--text-muted); font-variant-numeric: tabular-nums; }

  .sh { font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-muted); margin: 1.75rem 0 0.6rem; }
  .log { width: 100%; border-collapse: collapse; font-size: 0.78rem; }
  .log th { text-align: left; font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); padding: 0.35rem 0.4rem; border-bottom: 1px solid var(--border); font-weight: 600; }
  .log td { padding: 0.35rem 0.4rem; border-bottom: 1px solid var(--grid); }
  .log .r { text-align: right; }
  .log tr.diff { background: color-mix(in srgb, var(--warning) 9%, transparent); }
  .num { font-variant-numeric: tabular-nums; }
  .num.open { color: var(--serious); font-weight: 600; }
  .id { font-family: ui-monospace, monospace; font-size: 0.72rem; }
  .small { font-size: 0.72rem; }
  .differs { color: var(--serious); font-weight: 600; }
  .muted { color: var(--text-muted); }
  .insp { font-size: 0.68rem; padding: 0.15rem 0.4rem; }

  .drawer { margin-top: 1rem; padding: 0.9rem 1rem; background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius); }
  .drawer header { display: flex; justify-content: space-between; align-items: baseline; gap: 1rem; flex-wrap: wrap; }
  .drawer .meta { font-size: 0.7rem; color: var(--text-muted); font-family: ui-monospace, monospace; }
  .tabs { display: flex; gap: 0.3rem; margin: 0.7rem 0; flex-wrap: wrap; }
  .tabs button { font-size: 0.72rem; padding: 0.25rem 0.55rem; }
  .tabs button.on { background: var(--series-1); border-color: var(--series-1); color: #fff; }
  pre { margin: 0; padding: 0.7rem 0.8rem; background: var(--surface-1); border-radius: 7px; font-size: 0.72rem; overflow-x: auto; max-height: 420px; }
  .qs { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.7rem; }
  .qh code { font-size: 0.66rem; font-weight: 700; background: var(--surface-3); padding: 0.1rem 0.35rem; border-radius: 4px; }
  .qs p { font-size: 0.78rem; color: var(--text-secondary); margin: 0.25rem 0 0; max-width: 90ch; }

  @media (max-width: 1000px) { .two { grid-template-columns: 1fr; } }
</style>

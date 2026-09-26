<script lang="ts">
  import { base } from '$app/paths';
  import { onMount } from 'svelte';
  import { page } from '$app/state';

  let data = $state<any>(null);
  let loading = $state(true);

  onMount(async () => {
    data = await (await fetch(`${base}/api/client-report/${page.params.id}`)).json();
    loading = false;
  });

  const eur = (n: number) => `CA$${n.toLocaleString('en-CA', { maximumFractionDigits: 0 })}`;

  function save(kind: 'md' | 'html') {
    const md: string = data.markdown;
    let content = md;
    let type = 'text/markdown';
    if (kind === 'html') {
      type = 'text/html';

      content = `<!doctype html><meta charset="utf-8"><title>${data.campaign.client} · ${data.campaign.name}</title>
<style>
  body{font:14px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif;max-width:800px;margin:3rem auto;padding:0 1.5rem;color:#111}
  h1{font-size:1.5rem;letter-spacing:-.02em;margin:0 0 .2rem} h2{font-size:1rem;margin:2rem 0 .6rem}
  table{border-collapse:collapse;width:100%;font-size:.86rem;margin:.5rem 0}
  th,td{text-align:left;padding:.45rem .5rem;border-bottom:1px solid #e5e5e2}
  th{font-size:.7rem;text-transform:uppercase;letter-spacing:.05em;color:#6b6b66}
  td:nth-child(n+3){text-align:right;font-variant-numeric:tabular-nums}
  hr{border:0;border-top:1px solid #e5e5e2;margin:2rem 0}
  em{color:#6b6b66;font-size:.8rem} strong{font-weight:600}
  @media print{body{margin:0}}
</style>
${md
  .replace(/^# (.*)$/gm, '<h1>$1</h1>')
  .replace(/^## (.*)$/gm, '<h2>$1</h2>')
  .replace(/^---$/gm, '<hr>')
  .replace(/^\|(.+)\|$/gm, (row) => {
    const cells = row.slice(1, -1).split('|').map((s) => s.trim());
    if (cells.every((s) => /^-+$/.test(s))) return '';
    return `<tr>${cells.map((s) => `<td>${s}</td>`).join('')}</tr>`;
  })
  .replace(/(<tr>[\s\S]*?<\/tr>)(?!\s*<tr>)/g, '<table>$1</table>')
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/^\*(.+)\*$/gm, '<em>$1</em>')
  .split('\n')
  .map((l) => (l.trim() && !/^<(h1|h2|hr|table|tr|em)/.test(l.trim()) ? `<p>${l}</p>` : l))
  .join('\n')}`;
    }
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.campaign.id}-client-report.${kind}`;
    a.click();
    URL.revokeObjectURL(url);
  }
</script>

<div class="page">
  {#if loading}
    <p class="muted">Building the report…</p>
  {:else if data}
    <nav class="crumbs"><a href={`${base}/campaign/${data.campaign.id}`}>← {data.campaign.name}</a></nav>

    <header class="top">
      <div>
        <span class="eyebrow">Client report</span>
        <h1>{data.campaign.client} · {data.campaign.name}</h1>
        <p class="muted small">
          Assembled from the decision record. Nothing was exported from a platform and nothing was
          reconciled to produce it.
          {#if !data.generated}
            <span class="badge">Narrative not generated, needs model credit. The figures are unaffected.</span>
          {/if}
        </p>
      </div>
      <div class="dl">
        <button class="primary" onclick={() => save('html')}>Download HTML</button>
        <button onclick={() => save('md')}>Download Markdown</button>
      </div>
    </header>

    <section class="sheet">
      {#if data.summary}<p class="summary">{data.summary}</p>{/if}

      <h2>Performance</h2>
      <dl class="perf">
        <div><dt>Budget</dt><dd>{eur(data.metrics.delivered + (data.metrics.allocated - data.metrics.delivered) + 0)}</dd></div>
        <div><dt>Delivered</dt><dd>{eur(data.metrics.delivered)}</dd></div>
        <div><dt>Conversions</dt><dd>{data.metrics.conversions.toLocaleString()}</dd></div>
        <div><dt>CPA</dt><dd class:bad={data.metrics.cpaVsTargetPct > 0}>CA${data.metrics.cpa.toFixed(2)}</dd></div>
        <div><dt>Pacing</dt><dd>{data.metrics.pacing.toFixed(2)}</dd></div>
        {#if data.metrics.underfillEur > 0}
          <div><dt>Undeliverable</dt><dd class="bad">{eur(data.metrics.underfillEur)}</dd></div>
        {/if}
      </dl>

      <h2>By placement</h2>
      <table>
        <thead><tr><th>Placement</th><th>Audience</th><th class="r">Delivered</th><th class="r">Fill</th><th class="r">CPA</th><th class="r">vs target</th></tr></thead>
        <tbody>
          {#each data.lines as l (l.placement + l.audience)}
            <tr>
              <td>{l.placement}</td>
              <td class="aud">{l.audience}</td>
              <td class="r num">{eur(l.delivered)}</td>
              <td class="r num" class:bad={l.fillRate < 0.9}>{(l.fillRate * 100).toFixed(0)}%</td>
              <td class="r num">CA${l.cpa.toFixed(2)}</td>
              <td class="r num" class:bad={l.vsTarget > 5} class:good={l.vsTarget <= 0}>{l.vsTarget > 0 ? '+' : ''}{l.vsTarget}%</td>
            </tr>
          {/each}
        </tbody>
      </table>

      <h2>What we did, and why</h2>
      <p class="did">
        <strong>{data.decision.gateOpen ? data.decision.leverLabel : 'No intervention'}</strong>
        {#if data.decision.gateOpen}
          , at {(data.decision.confidence * 100).toFixed(0)}% confidence. {data.decision.severityLabel}.
          Reviewed by a person before being applied.
        {:else}
          . The campaign is inside its tolerances on cost, pacing and delivery, so nothing was raised.
        {/if}
      </p>
      <p class="muted small">Illustrative scenario, not real campaign data.</p>
    </section>
  {/if}
</div>

<style>
  .crumbs { font-size: 0.78rem; margin-bottom: 0.7rem; }
  .crumbs a { color: var(--text-secondary); text-decoration: none; }
  .crumbs a:hover { text-decoration: underline; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 2rem; flex-wrap: wrap; margin-bottom: 1.2rem; }
  .dl { display: flex; gap: 0.4rem; }
  .primary { background: var(--series-1); border-color: var(--series-1); color: #fff; font-weight: 600; }
  .primary:hover { filter: brightness(1.08); background: var(--series-1); }

  .sheet { padding: 1.4rem 1.6rem; background: var(--surface-1); border: 1px solid var(--border); border-radius: var(--radius); max-width: 900px; }
  .sheet h2 { font-size: 0.86rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); margin: 1.5rem 0 0.6rem; }
  .sheet h2:first-of-type { margin-top: 0; }
  .summary { font-size: 0.92rem; white-space: pre-wrap; margin: 0 0 1.2rem; max-width: 76ch; }

  .perf { display: flex; gap: 1.6rem; flex-wrap: wrap; margin: 0; }
  .perf dt { font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); }
  .perf dd { margin: 0.1rem 0 0; font-size: 1.15rem; font-variant-numeric: tabular-nums; }
  .perf dd.bad, td.bad { color: var(--critical); }
  td.good { color: var(--good-text); }

  table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
  th { text-align: left; font-size: 0.64rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); padding: 0.35rem 0.4rem; border-bottom: 1px solid var(--border); font-weight: 600; }
  td { padding: 0.45rem 0.4rem; border-bottom: 1px solid var(--grid); }
  .r { text-align: right; }
  .num { font-variant-numeric: tabular-nums; }
  .aud { color: var(--text-secondary); font-size: 0.78rem; }
  .did { font-size: 0.88rem; margin: 0; max-width: 80ch; }
  .muted { color: var(--text-muted); }
  .small { font-size: 0.76rem; }
  .badge { display: inline-block; font-size: 0.68rem; padding: 0.1rem 0.4rem; border-radius: 4px; background: color-mix(in srgb, var(--warning) 20%, transparent); color: var(--text-primary); margin-left: 0.3rem; }
</style>

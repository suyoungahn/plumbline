<script lang="ts">
  import Rich from '$lib/components/Rich.svelte';
  import CpaChart from '$lib/components/CpaChart.svelte';
  import { doc, ready } from '$lib/mediaplan/store.svelte';
  import { cad, cadK, compact, lineName, paceAll, pct, shortDate, signedPct } from '$lib/mediaplan/calc';
  import { CHANNELS } from '$lib/mediaplan/types';
  import { draftComingUp, draftHeadline, draftSummary } from '$lib/mediaplan/report-draft';

  const plan = $derived(doc.plan);
  const pace = $derived(doc.pacing);
  const r = $derived(doc.report);
  const t = $derived(paceAll(plan, pace));
  const conv = $derived(plan.conversionName);
  const Conv = $derived(conv.charAt(0).toUpperCase() + conv.slice(1));

  // Lines shown to the client: everything that has spent, plus anything live. Held lines
  // with no spend (the reserve) stay off the client table.
  const shown = $derived(t.rows.filter((x) => x.actual.spend > 0 || x.status !== 'Held'));
  const chartRows = $derived(
    shown.filter((x) => x.cpa !== null && (x.line.role === 'performance' || x.line.role === 'awareness')).map((x) => ({ label: lineName(x.line), cpa: x.cpa! }))
  );
  const awareness = $derived([...new Set(t.rows.filter((x) => x.line.role === 'awareness').map((x) => CHANNELS[x.line.channel].short))]);
  const andList = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
  const paceTone = (p: number | null) => (p === null ? '' : p > pace.overPace ? 'over' : p < pace.underPace ? 'under' : 'ok');

  function redraftAll() {
    doc.report.headline = draftHeadline(plan, pace, r);
    doc.report.summary = draftSummary(plan, pace, r);
    doc.report.comingUp = draftComingUp(plan, pace);
  }

  function pullChanges() {
    doc.report.changes = t.rows
      .filter((x) => x.actual.note.trim() && x.status !== 'Held' && x.line.role !== 'non_working')
      .map((x) => `**${lineName(x.line)}${x.pacing !== null ? ` (${pct(x.pacing)} paced)` : ''}:** ${x.actual.note.trim()}`);
  }

  // First visit: write the drafts once the saved campaign has loaded.
  $effect(() => {
    if (!ready.value) return;
    if (!doc.report.headline) doc.report.headline = draftHeadline(doc.plan, doc.pacing, doc.report);
    if (!doc.report.summary.length) doc.report.summary = draftSummary(doc.plan, doc.pacing, doc.report);
    if (!doc.report.comingUp.length) doc.report.comingUp = draftComingUp(doc.plan, doc.pacing);
  });
</script>

<div class="page">
  <header class="mp-top no-print">
    <div>
      <span class="eyebrow">Step 4 of 4 · Client-facing</span>
      <h1>Weekly report</h1>
      <p class="lede">
        The numbers come straight from Plan and Pacing. The words start as a draft written from those
        numbers, which you edit before sending; nothing is invented. Print it or save it as a PDF.
      </p>
    </div>
    <div class="mp-actions">
      <button onclick={redraftAll}>Redraft from the numbers</button>
      <button class="mp-primary" onclick={() => window.print()}>Print / save as PDF</button>
    </div>
  </header>

  <details class="mp-card editor no-print" open>
    <summary><h2>Report inputs</h2></summary>
    <div class="mp-grid">
      <label class="mp-field">Report number<input type="number" min="1" bind:value={doc.report.number} /></label>
      <label class="mp-field">Sent date<input type="date" bind:value={doc.report.sentDate} /></label>
      <label class="mp-field">Reporting through<input type="date" bind:value={doc.pacing.dataThrough} /></label>
      <label class="mp-field wide">Headline<input bind:value={doc.report.headline} /></label>
    </div>

    {#snippet listEditor(title: string, items: string[], action?: { label: string; run: () => void })}
      <div class="block">
        <div class="bh"><h3>{title}</h3>{#if action}<button class="mini" onclick={action.run}>{action.label}</button>{/if}</div>
        <ul class="mp-list">
          {#each items as _, i (i)}
            <li>
              <textarea bind:value={items[i]} rows="2" aria-label={`${title} ${i + 1}`}></textarea>
              <button class="mp-link" onclick={() => items.splice(i, 1)}>remove</button>
            </li>
          {/each}
        </ul>
        <button class="mini" onclick={() => items.push('')}>Add</button>
      </div>
    {/snippet}

    {@render listEditor('Summary', doc.report.summary, { label: 'Redraft', run: () => (doc.report.summary = draftSummary(plan, pace, r)) })}
    {@render listEditor('What we changed this week', doc.report.changes, { label: 'Pull from pacing notes', run: pullChanges })}

    <div class="block">
      <div class="bh"><h3>Decisions needed from the client</h3></div>
      {#each doc.report.decisions as d, i (i)}
        <div class="decision">
          <label class="mp-field">Request<textarea rows="2" bind:value={d.request}></textarea></label>
          <label class="mp-field">Why<textarea rows="2" bind:value={d.why}></textarea></label>
          <label class="mp-field">Needed by<input bind:value={d.neededBy} /></label>
          <label class="hl-toggle"><input type="checkbox" bind:checked={d.highlight} /> Highlight</label>
          <button class="mp-link" onclick={() => doc.report.decisions.splice(i, 1)}>remove</button>
        </div>
      {/each}
      <button class="mini" onclick={() => doc.report.decisions.push({ request: '', why: '', neededBy: '', highlight: false })}>Add decision</button>
    </div>

    {@render listEditor('Coming up', doc.report.comingUp, { label: 'Redraft', run: () => (doc.report.comingUp = draftComingUp(plan, pace)) })}
    <label class="mp-field">Closing line<textarea rows="2" bind:value={doc.report.footer}></textarea></label>
  </details>

  <article class="paper">
    <section class="sheet">
      <div class="band"><strong>{plan.campaign.toUpperCase()}</strong> <span>|</span> Weekly Status Report #{r.number}</div>
      <h1 class="headline">{r.headline}</h1>
      <p class="meta">
        Prepared for: {plan.preparedFor} • Reporting period: {shortDate(plan.flightStart)} – {shortDate(pace.dataThrough)}
        (Days 1–{t.daysElapsed} of {t.flightDays}) • Sent: {shortDate(r.sentDate)}
      </p>

      <div class="kpis">
        <div><span>Spend to date</span><strong>{cadK(t.spend)}</strong><small>{pct(t.budgetPct, 1)} of {cadK(plan.totalBudget)} • {t.pacing === null ? '—' : pct(t.pacing)} of plan</small></div>
        <div><span>New {conv}s</span><strong>{t.conversions.toLocaleString('en-CA')}</strong><small>Client first-party attribution</small></div>
        <div><span>Blended CPA</span><strong class:warn={t.cpa !== null && t.cpa > plan.targetCpa} class:good={t.cpa !== null && t.cpa <= plan.targetCpa}>{t.cpa === null ? '—' : cad(t.cpa, 2)}</strong><small>Target {cad(plan.targetCpa, 2)} (incl. upper funnel)</small></div>
        <div><span>Performance CPA</span><strong class:good={t.performanceCpa !== null && t.performanceCpa <= plan.targetCpa} class:warn={t.performanceCpa !== null && t.performanceCpa > plan.targetCpa}>{t.performanceCpa === null ? '—' : cad(t.performanceCpa, 2)}</strong><small>Social, search, retail + display</small></div>
        <div><span>Impressions</span><strong>{compact(t.impressions)}</strong><small>Excludes search</small></div>
      </div>

      <h2>Summary</h2>
      <ul class="bullets">{#each r.summary.filter((s) => s.trim()) as s, i (i)}<li><Rich text={s} /></li>{/each}</ul>

      <h2>Performance by channel</h2>
      <div class="tscroll"><table class="perf">
        <thead><tr><th>Channel</th><th class="r">Spend</th><th class="r">Pacing</th><th class="r">Impressions</th><th class="r">{Conv}s</th><th class="r">CPA</th><th class="r">vs. Target</th></tr></thead>
        <tbody>
          {#each shown as x (x.line.id)}
            {@const nonWorking = x.line.role === 'non_working'}
            <tr>
              <td>{lineName(x.line)}</td>
              <td class="r">{cad(x.actual.spend)}</td>
              <td class={`r pace-${paceTone(x.pacing)}`}>{x.pacing === null ? '—' : pct(x.pacing)}</td>
              <td class="r">{nonWorking ? '' : x.actual.impressions ? compact(x.actual.impressions) : '—'}</td>
              <td class="r">{nonWorking ? '' : x.actual.conversions.toLocaleString('en-CA')}</td>
              <td class="r">{nonWorking || x.cpa === null ? '' : cad(x.cpa, 2)}</td>
              <td class={`r ${x.cpaVsTarget !== null && x.cpaVsTarget > 0 ? 'neg' : 'pos'}`}>{nonWorking || x.cpaVsTarget === null ? '' : signedPct(x.cpaVsTarget)}</td>
            </tr>
          {/each}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td><td class="r">{cad(t.spend)}</td><td class="r">{t.pacing === null ? '—' : pct(t.pacing)}</td>
            <td class="r">{compact(t.impressions)}</td><td class="r">{t.conversions.toLocaleString('en-CA')}</td>
            <td class="r">{t.cpa === null ? '—' : cad(t.cpa, 2)}</td><td class="r">{t.cpaVsTarget === null ? '' : signedPct(t.cpaVsTarget)}</td>
          </tr>
        </tfoot>
      </table></div>
      <p class="fine">
        Pacing = actual ÷ planned spend to date (target band {pct(pace.underPace)}–{pct(pace.overPace)}). {Conv}s use the client's
        first-party attribution; platform-reported numbers run higher and are not used for billing or optimization. All figures CAD.
      </p>
      <p class="pagefoot">Confidential — prepared for {plan.client}. Illustrative example; all figures are hypothetical. <span>Page 1</span></p>
    </section>

    <section class="sheet">
      <h2>Cost per {conv} by channel</h2>
      <p class="fine top">
        Dark bars are at or below the {cad(plan.targetCpa, 2)} target.{#if awareness.length}{' '}{andList(awareness)} are awareness buys, where last-touch CPA understates value.{/if}
      </p>
      {#if chartRows.length}<div class="chart"><CpaChart rows={chartRows} target={plan.targetCpa} unit={conv} /></div>{/if}

      {#if r.changes.some((c) => c.trim())}
        <h2>What we changed this week</h2>
        <ul class="bullets">{#each r.changes.filter((c) => c.trim()) as c, i (i)}<li><Rich text={c} /></li>{/each}</ul>
      {/if}

      {#if r.decisions.length}
        <h2>Decisions needed from {plan.preparedFor.replace(/ Marketing$/, '')}</h2>
        <table class="decisions">
          <colgroup><col style="width: 5%" /><col style="width: 40%" /><col style="width: 38%" /><col style="width: 17%" /></colgroup>
          <thead><tr><th>#</th><th>Request</th><th>Why</th><th>Needed by</th></tr></thead>
          <tbody>
            {#each r.decisions as d, i (i)}
              <tr class:hl={d.highlight}><td>{i + 1}</td><td><Rich text={d.request} /></td><td>{d.why}</td><td class:strong={d.highlight}>{d.neededBy}</td></tr>
            {/each}
          </tbody>
        </table>
      {/if}

      {#if r.comingUp.some((c) => c.trim())}
        <h2>Coming up</h2>
        <ul class="bullets">{#each r.comingUp.filter((c) => c.trim()) as c, i (i)}<li><Rich text={c} /></li>{/each}</ul>
      {/if}

      <p class="fine closing">{r.footer}</p>
      <p class="pagefoot">Confidential — prepared for {plan.client}. Illustrative example; all figures are hypothetical. <span>Page 2</span></p>
    </section>
  </article>
</div>

<style>
  .editor summary { cursor: pointer; list-style: none; }
  .editor summary::-webkit-details-marker { display: none; }
  .editor summary h2 { display: inline; font-size: 0.92rem; }
  .editor summary::after { content: ' ▾'; color: var(--text-muted); }
  .block { margin-top: 1rem; }
  .bh { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.4rem; }
  .bh h3 { font-size: 0.82rem; }
  .mini { font-size: 0.74rem; padding: 0.2rem 0.55rem; }
  .decision { display: grid; grid-template-columns: 1.3fr 1.3fr 0.7fr auto auto; gap: 0.5rem; align-items: end; padding: 0.5rem; background: var(--surface-2); border-radius: 8px; margin-bottom: 0.4rem; }
  .decision textarea { resize: vertical; }
  .hl-toggle { display: flex; gap: 0.3rem; align-items: center; font-size: 0.74rem; color: var(--text-secondary); padding-bottom: 0.4rem; }
  @media (max-width: 760px) { .decision { grid-template-columns: 1fr; } }

  /* The report itself is a paper document: fixed light palette in both themes. */
  .paper { --ink: #111827; --navy: #0b2545; --muted: #6b7280; --rule: #e3e5ea; --tint: #eef2fa; --gold: #f2b01e;
    display: flex; flex-direction: column; gap: 1.2rem; align-items: center; color: var(--ink); }
  .sheet { background: #fff; width: 100%; max-width: 8.5in; padding: 0.55in 0.6in 0.4in; box-shadow: 0 1px 3px rgba(0,0,0,0.12), 0 8px 24px rgba(0,0,0,0.08); border-radius: 4px; display: flex; flex-direction: column; min-height: 10.5in; }
  .band { background: var(--navy); color: #fff; padding: 0.45rem 0.8rem; font-size: 0.86rem; border-bottom: 3px solid var(--gold); }
  .band span { opacity: 0.6; margin: 0 0.3rem; }
  .headline { font-size: 1.55rem; line-height: 1.2; color: var(--navy); margin: 0.9rem 0 0.35rem; letter-spacing: -0.01em; }
  .meta { color: var(--muted); font-size: 0.8rem; margin: 0 0 0.9rem; }
  .kpis { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 2px; background: #fff; }
  .kpis div { background: var(--tint); padding: 0.6rem 0.7rem; display: flex; flex-direction: column; gap: 0.2rem; }
  .kpis span { font-size: 0.64rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); min-height: 1.7em; }
  .kpis strong { font-size: 1.35rem; color: var(--navy); font-variant-numeric: tabular-nums; }
  .kpis strong.good { color: #1f7a35; }
  .kpis strong.warn { color: #a36b00; }
  .kpis small { font-size: 0.68rem; color: var(--muted); }
  .sheet h2 { font-size: 1.02rem; color: var(--navy); margin: 1rem 0 0.4rem; }
  .bullets { margin: 0; padding-left: 1.1rem; font-size: 0.82rem; line-height: 1.45; display: flex; flex-direction: column; gap: 0.3rem; }
  .bullets :global(strong) { color: var(--ink); }
  .perf, .decisions { width: 100%; border-collapse: collapse; font-size: 0.78rem; font-variant-numeric: tabular-nums; }
  .perf th, .decisions th { background: var(--navy); color: #fff; text-align: left; padding: 0.4rem 0.5rem; font-weight: 700; }
  .perf td, .decisions td { padding: 0.38rem 0.5rem; border-bottom: 1px solid var(--rule); vertical-align: top; }
  .perf .r, .perf th.r { text-align: right; }
  .perf tfoot td { font-weight: 700; background: var(--tint); border-top: 2px solid var(--navy); }
  .pace-ok { color: #1f7a35; }
  .pace-over { color: #c0392b; }
  .pace-under { color: #a36b00; }
  .neg { color: #c0392b; }
  .pos { color: #1f7a35; }
  .decisions th { background: var(--tint); color: var(--navy); }
  .decisions { table-layout: fixed; }
  .decisions tr.hl td { background: #fff4d6; }
  .decisions tr.hl td:first-child { box-shadow: inset 4px 0 0 var(--gold); font-weight: 700; }
  .chart { width: 100%; }
  .tscroll { overflow-x: auto; }
  .decisions .strong { font-weight: 700; }
  .fine { font-size: 0.7rem; color: var(--muted); margin: 0.45rem 0 0; }
  .fine.top { margin: 0 0 0.5rem; }
  .closing { margin-top: 1rem; }
  .pagefoot { margin-top: auto; padding-top: 1rem; font-size: 0.64rem; color: var(--muted); display: flex; justify-content: space-between; gap: 1rem; }

  @media screen and (max-width: 760px) {
    .sheet { padding: 1rem; min-height: 0; }
    .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .perf { font-size: 0.7rem; }
    .perf th:nth-child(4), .perf td:nth-child(4) { display: none; }
  }

  @media print {
    :global(.page) { padding: 0 !important; max-width: none !important; }
    .paper { gap: 0; }
    .sheet { box-shadow: none; border-radius: 0; max-width: none; min-height: 0; height: auto; padding: 0; break-after: page; }
    .pagefoot { margin-top: 0.5rem; padding-top: 0.4rem; }
    .chart { max-width: 5.9in; margin: 0 auto; }
    .meta { margin-bottom: 0.6rem; }
    .fine { font-size: 0.66rem; }
    .closing { margin-top: 0.6rem; }
    .headline { font-size: 1.4rem; margin-top: 0.7rem; }
    .kpis strong { font-size: 1.2rem; }
    .kpis div { padding: 0.45rem 0.6rem; }
    .sheet h2 { margin: 0.75rem 0 0.3rem; }
    .bullets { font-size: 0.76rem; gap: 0.15rem; line-height: 1.38; }
    .perf, .decisions { font-size: 0.74rem; }
    .perf td, .decisions td { padding: 0.18rem 0.45rem; }
    .perf th, .decisions th { padding: 0.32rem 0.45rem; }
    .sheet:last-child { break-after: auto; }
    .kpis div, .band, .perf th, .perf tfoot td, .decisions th, .decisions tr.hl td { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>

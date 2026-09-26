<script lang="ts">
  import { base } from '$app/paths';
  import { LEVERS, type LeverId } from '$lib/domain';
  import DecisionCell from '$lib/components/DecisionCell.svelte';
  import { lineRecommendation } from '$lib/mediaplan/recommend';
  import { autoApplies } from '$lib/mediaplan/autonomy';
  import { pacingEntry, pacingKey, pacingWhy, remove, upsert } from '$lib/mediaplan/decisions';
  import type { DecisionEntry, Ruling } from '$lib/mediaplan/types';
  import { page } from '$app/state';
  import { records, settings } from '$lib/mediaplan/store.svelte';
  const doc = $derived(records[page.params.id!]);
  import { CHANNELS } from '$lib/mediaplan/types';
  import { cad, lineName, pct, paceAll, shortDate, signedPct, type PacedLine } from '$lib/mediaplan/calc';
  import { localSuggestions, pacingLineState, type LineSuggestion } from '$lib/mediaplan/pacing-jev';
  import { downloadWorkbook } from '$lib/mediaplan/xlsx';

  const plan = $derived(doc.plan);
  const t = $derived(paceAll(plan, doc.pacing));
  let suggestions = $state<LineSuggestion[]>([]);
  let exporting = $state(false);
  // Platform numbers arrive on their own; typing is only for correcting one.
  let editing = $state(false);
  let more = $state(false);

  function ensureActual(id: string) {
    doc.pacing.actuals[id] ??= { spend: 0, yesterday: 0, impressions: 0, conversions: 0, note: '' };
    return doc.pacing.actuals[id];
  }
  $effect(() => {
    for (const l of doc.plan.lines) ensureActual(l.id);
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    const states = t.rows.map((r) => pacingLineState(plan, doc.pacing, r));
    const body = JSON.stringify({ states });
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        const res = await fetch(`${base}/api/pacing-check`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
        if (!res.ok) throw new Error(String(res.status));
        suggestions = (await res.json()).suggestions;
      } catch {
        suggestions = localSuggestions(doc.plan, doc.pacing);
      }
    }, 450);
  });

  const hasBooked = $derived(Object.values(doc.pacing.actuals).some((a) => a.booked));
  const needsYou = $derived(
    suggestions.filter((s, i) => s.needsYou && t.rows[i] && !doc.decisions.some((d) => d.key === pacingKey(doc.pacing.dataThrough, t.rows[i].line.id))).length
  );

  const alternatives = (s: LineSuggestion) =>
    Object.entries(s.distribution ?? {})
      .filter(([k]) => k !== s.lever)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([k]) => LEVERS[k as LeverId].label.toLowerCase());

  function rule(r: PacedLine, s: LineSuggestion, ruling: 'approved' | 'overruled') {
    upsert(doc.decisions, pacingEntry(plan, doc.pacing, r, s, ruling));
  }

  // Routine actions below the "needs a person" bar are applied and recorded as
  // automatic, so they show up in the decision record and the weekly report.
  $effect(() => {
    suggestions.forEach((s, i) => {
      const r = t.rows[i];
      if (!r || !s) return;
      const key = pacingKey(doc.pacing.dataThrough, r.line.id);
      const existing = doc.decisions.find((d) => d.key === key);
      const earned = s.needsYou && autoApplies(s.lever, s.confidence, settings);
      const routine = (!s.needsYou || earned) && s.lever !== 'no_action' && r.status !== 'Held';
      const mode: Ruling = settings.shadow && !earned ? 'shadow' : 'auto';
      const automatic = existing?.ruling === 'auto' || existing?.ruling === 'shadow';
      if (routine && (!existing || (automatic && (existing.action !== lineRecommendation(r, s.lever) || existing.ruling !== mode)))) {
        upsert(doc.decisions, pacingEntry(plan, doc.pacing, r, s, mode));
      } else if (!routine && automatic) {
        remove(doc.decisions, key);
      }
    });
  });
  const source = $derived(suggestions[0]?.source ?? 'sim');

  async function exportXlsx() {
    exporting = true;
    try {
      await downloadWorkbook($state.snapshot(doc.plan), $state.snapshot(doc.pacing));
    } finally {
      exporting = false;
    }
  }
</script>

<div class="page">
  <header class="mp-top">
    <div>
      <h2 class="tab-title">Pacing</h2>
      <p class="lede">Spend against plan, line by line. Lines outside the band get a suggestion.</p>
    </div>
    <div class="mp-actions">
      <button onclick={exportXlsx} disabled={exporting}>{exporting ? 'Building…' : 'Export to Excel'}</button>
    </div>
  </header>

  <section class="mp-card">
    <details class="settings-fold">
      <summary>Date and pacing band</summary>
    <div class="mp-grid settings">
      <label class="mp-field">Data through<input type="date" bind:value={doc.pacing.dataThrough} /></label>
      <label class="mp-field">Over-pace above (%)
        <input type="number" step="1" value={Math.round(doc.pacing.overPace * 100)} oninput={(e) => (doc.pacing.overPace = +e.currentTarget.value / 100)} />
      </label>
      <label class="mp-field">Under-pace below (%)
        <input type="number" step="1" value={Math.round(doc.pacing.underPace * 100)} oninput={(e) => (doc.pacing.underPace = +e.currentTarget.value / 100)} />
      </label>
      <div class="mp-field">Target CPA<span class="static">{cad(plan.targetCpa, 2)} <a href={`${base}/campaign/${page.params.id}/plan`}>edit in Plan</a></span></div>
    </div>
    </details>
    <dl class="tiles">
      <div><dt>Pacing</dt><dd class={t.pacing !== null && (t.pacing > doc.pacing.overPace || t.pacing < doc.pacing.underPace) ? 'mp-warn' : ''}>{t.pacing === null ? '—' : pct(t.pacing)}</dd><small>of {cad(t.planned)} planned to date</small></div>
      <div><dt>{plan.conversionName}s</dt><dd>{t.conversions.toLocaleString('en-CA')}</dd><small>blended CPA {t.cpa === null ? '—' : cad(t.cpa, 2)}</small></div>
      <div><dt>Performance CPA</dt><dd class={t.performanceCpa !== null && t.performanceCpa <= plan.targetCpa ? 'mp-ok' : 'mp-warn'}>{t.performanceCpa === null ? '—' : cad(t.performanceCpa, 2)}</dd><small>target {cad(plan.targetCpa, 2)}</small></div>
      <div><dt>Need you today</dt><dd class={needsYou ? 'mp-warn' : 'mp-ok'}>{needsYou} of {t.rows.length}</dd>
        <small>{source === 'sim' ? 'heuristic stand-in, not Jev' : 'Jev'}</small></div>
    </dl>
  </section>

  <section class="mp-card">
    <div class="tbar">
      <h2>Lines</h2>
      <span class="mp-muted legend">Updated from each platform this morning (illustrative data)</span>
      <span class="tools">
        <button class="mini" onclick={() => (more = !more)}>{more ? 'Fewer columns' : 'More columns'}</button>
        <button class="mini" class:on={editing} onclick={() => (editing = !editing)}>{editing ? 'Done' : 'Correct a number'}</button>
      </span>
    </div>
    <div class="mp-scroll">
      <table class="mp-table pace">
        <thead>
          <tr>
            <th>Line</th><th class="r">Net budget</th><th class="r">Planned to date</th><th class="r">Actual to date</th>
            <th class="r" title="Spend to date ÷ what the flowchart planned by today. Outside the band above, the line is flagged.">Pacing</th><th>Status</th>{#if hasBooked}<th class="r" title="Spend delivered ÷ spend the retailer or publisher booked. Low fill means the inventory ran out, which bidding harder cannot fix.">Fill</th>{/if}{#if more}<th class="r">Remaining</th><th class="r">Yesterday</th><th class="r">Daily target</th>
            <th class="r">Impressions</th>{/if}<th class="r">{plan.conversionName}s</th><th class="r">CPA</th><th class="r">vs target</th>
            <th title="What the model suggests for this line today, how sure it is, and why. Approve or decline; either way it goes on the History tab.">Suggested</th>{#if more || editing}<th>Notes</th>{/if}
          </tr>
        </thead>
        <tbody>
          {#each t.rows as r, i (r.line.id)}
            {@const a = doc.pacing.actuals[r.line.id]}
            {@const s = suggestions[i]}
            {#if a}
              <tr class:flag={s?.needsYou}>
                <td class="name">{CHANNELS[r.line.channel].label}<small>{r.line.partner}</small></td>
                <td class="r num">{cad(r.line.budget)}</td>
                <td class="r num">{cad(r.planned)}</td>
                <td class="r num">{#if editing}<input class="mp-in num input-cell money" type="number" min="0" step="100" bind:value={a.spend} aria-label="Actual spend" />{:else}{cad(a.spend)}{/if}</td>
                <td class="r num">{r.pacing === null ? 'n/a' : pct(r.pacing)}</td>
                <td><span class="mp-pill" data-s={r.status}>{r.status}</span></td>
                {#if hasBooked}
                  <td class="r num" class:mp-warn={!!a.booked && a.spend / a.booked < 0.9}>{a.booked ? pct(a.spend / a.booked) : '—'}</td>
                {/if}
                {#if more}
                  <td class="r num">{cad(r.remaining)}</td>
                  <td class="r num">{#if editing}<input class="mp-in num input-cell small-in" type="number" min="0" step="50" bind:value={a.yesterday} aria-label="Yesterday spend" />{:else}{cad(a.yesterday)}{/if}</td>
                  <td class="r num">{cad(r.dailyTarget)}</td>
                  <td class="r num">{#if editing}<input class="mp-in num input-cell money" type="number" min="0" step="1000" bind:value={a.impressions} aria-label="Impressions" />{:else}{a.impressions ? a.impressions.toLocaleString('en-CA') : '—'}{/if}</td>
                {/if}
                <td class="r num">{#if editing}<input class="mp-in num input-cell small-in" type="number" min="0" step="10" bind:value={a.conversions} aria-label="Conversions" />{:else}{a.conversions.toLocaleString('en-CA')}{/if}</td>
                <td class="r num">{r.cpa === null ? '—' : cad(r.cpa, 2)}</td>
                <td class="r num" class:mp-bad={r.line.role === 'performance' && (r.cpaVsTarget ?? 0) > 0} class:mp-ok={r.line.role === 'performance' && r.cpaVsTarget !== null && r.cpaVsTarget <= 0}>
                  {r.cpaVsTarget === null ? '—' : signedPct(r.cpaVsTarget)}
                </td>
                <td class="sugg">
                  {#if s}
                    <DecisionCell
                      entry={doc.decisions.find((d) => d.key === pacingKey(doc.pacing.dataThrough, r.line.id))}
                      needsYou={s.needsYou}
                      action={lineRecommendation(r, s.lever)}
                      confidence={s.confidence}
                      gate={s.gateProbability}
                      why={pacingWhy(r, plan.targetCpa)}
                      alternatives={alternatives(s)}
                      source={s.source === 'sim' ? 'stand_in' : 'jev'}
                      idle={r.status === 'Held' ? 'Held' : 'Nothing to do'}
                      onrule={(ruling) => rule(r, s, ruling)}
                      onundo={() => remove(doc.decisions, pacingKey(doc.pacing.dataThrough, r.line.id))}
                    />
                  {/if}
                </td>
                {#if more || editing}<td>{#if editing}<textarea class="note" rows="1" bind:value={a.note} aria-label="Notes"></textarea>{:else}<span class="mp-muted small-note">{a.note}</span>{/if}</td>{/if}
              </tr>
            {/if}
          {/each}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td class="r num">{cad(plan.lines.reduce((s, l) => s + l.budget, 0))}</td>
            <td class="r num">{cad(t.planned)}</td>
            <td class="r num">{cad(t.spend)}</td>
            <td class="r num">{t.pacing === null ? '—' : pct(t.pacing)}</td>
            <td></td>
            {#if hasBooked}<td></td>{/if}
            {#if more}
              <td class="r num">{cad(t.remaining)}</td>
              <td class="r num">{cad(t.yesterday)}</td>
              <td class="r num">{cad(t.dailyTarget)}</td>
              <td class="r num">{t.impressions.toLocaleString('en-CA')}</td>
            {/if}
            <td class="r num">{t.conversions.toLocaleString('en-CA')}</td>
            <td class="r num">{t.cpa === null ? '—' : cad(t.cpa, 2)}</td>
            <td class="r num">{t.cpaVsTarget === null ? '—' : signedPct(t.cpaVsTarget)}</td>
            <td></td>{#if more || editing}<td></td>{/if}
          </tr>
        </tfoot>
      </table>
    </div>
    <p class="mp-note" style="margin: 0.6rem 0 0">
      Pacing = actual ÷ planned to date, with the band set above. Daily target = this week's flighted
      spend ÷ its days. Fill = delivered ÷ spend the seller booked, which is how running out of retail or publisher inventory shows up. Awareness lines (CTV, video, audio) are not held to the CPA target. Data through
      {shortDate(doc.pacing.dataThrough)}.
    </p>
  </section>

  <div class="mp-next"><a class="next" href={`${base}/campaign/${page.params.id}/report`}>Next: write the weekly client report →</a></div>
</div>

<style>
  .settings { margin: 0.6rem 0 0.4rem; }
  .settings-fold { margin-bottom: 0.8rem; }
  .settings-fold > summary { cursor: pointer; font-size: 0.85rem; color: var(--series-1); }
  .static { font-size: 0.9rem; text-transform: none; letter-spacing: normal; color: var(--text-primary); padding: 0.32rem 0; }
  .static a { font-size: 0.75rem; margin-left: 0.3rem; }
  .tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.6rem; margin: 0; }
  .tiles div { padding: 0.55rem 0.7rem; background: var(--surface-2); border-radius: 8px; }
  .tiles dt { font-size: 0.64rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); }
  .tiles dd { margin: 0.1rem 0 0; font-size: 1.2rem; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
  .tiles small { font-size: 0.7rem; color: var(--text-muted); }
  .legend { font-size: 0.78rem; font-weight: 400; }
  .tbar { display: flex; align-items: baseline; gap: 0.8rem; flex-wrap: wrap; margin-bottom: 0.5rem; }
  .tbar h2 { font-size: 1rem; margin: 0; }
  .tools { margin-left: auto; display: flex; gap: 0.4rem; }
  .mini { font-size: 0.8rem; padding: 0.3rem 0.8rem; border-radius: 999px; }
  .mini.on { background: var(--series-1); border-color: var(--series-1); color: #fff; }
  .small-note { font-size: 0.75rem; }
  .pace .name { min-width: 11rem; }
  .pace .name small { display: block; color: var(--text-muted); font-size: 0.7rem; }
  .pace .money { width: 7.5rem; }
  .pace .small-in { width: 5.5rem; }
  .pace tr.flag td:first-child { box-shadow: inset 3px 0 0 var(--serious); }
  .sugg { min-width: 12rem; }
  .note { font: inherit; font-size: 0.76rem; min-width: 16rem; width: 100%; color: var(--text-primary); background: var(--surface-2); border: 1px solid var(--border); border-radius: 7px; padding: 0.25rem 0.4rem; resize: vertical; }
  .next { font-weight: 600; font-size: 0.9rem; }
</style>

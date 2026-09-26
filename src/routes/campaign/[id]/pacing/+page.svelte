<script lang="ts">
  import { base } from '$app/paths';
  import { LEVERS, type LeverId } from '$lib/domain';
  import DecisionCell from '$lib/components/DecisionCell.svelte';
  import { pacingKey, pacingWhy, remove, upsert } from '$lib/mediaplan/decisions';
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

  function entryFor(r: PacedLine, s: LineSuggestion, ruling: Ruling): DecisionEntry {
    return {
      key: pacingKey(doc.pacing.dataThrough, r.line.id),
      date: doc.pacing.dataThrough,
      kind: 'pacing',
      subject: lineName(r.line),
      action: LEVERS[s.lever].label,
      why: pacingWhy(r, plan.targetCpa),
      gate: s.gateProbability,
      confidence: s.confidence,
      source: s.source === 'sim' ? 'stand_in' : 'jev',
      ruling,
      ruledBy: ruling === 'auto' || ruling === 'shadow' ? 'rules' : 'manager',
      note: r.actual.note || undefined
    };
  }

  function rule(r: PacedLine, s: LineSuggestion, ruling: 'approved' | 'overruled') {
    upsert(doc.decisions, entryFor(r, s, ruling));
  }

  // Routine actions below the "needs a person" bar are applied and recorded as
  // automatic, so they show up in the decision record and the weekly report.
  $effect(() => {
    suggestions.forEach((s, i) => {
      const r = t.rows[i];
      if (!r || !s) return;
      const key = pacingKey(doc.pacing.dataThrough, r.line.id);
      const existing = doc.decisions.find((d) => d.key === key);
      const routine = !s.needsYou && s.lever !== 'no_action' && r.status !== 'Held';
      const mode: Ruling = settings.shadow ? 'shadow' : 'auto';
      const automatic = existing?.ruling === 'auto' || existing?.ruling === 'shadow';
      if (routine && (!existing || (automatic && (existing.action !== LEVERS[s.lever].label || existing.ruling !== mode)))) {
        upsert(doc.decisions, entryFor(r, s, mode));
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
      <h2 class="tab-title">Daily pacing</h2>
      <p class="lede">
        Enter yesterday's platform numbers each morning. Planned-to-date prorates the flowchart by days
        elapsed, so every line is judged against where it should be today. Jev reads each line and says
        which ones need you.
      </p>
    </div>
    <div class="mp-actions">
      <button class="mp-primary" onclick={exportXlsx} disabled={exporting}>{exporting ? 'Building…' : 'Download workbook with tracker (.xlsx)'}</button>
    </div>
  </header>

  <section class="mp-card">
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
    <dl class="tiles">
      <div><dt>Day</dt><dd>{t.daysElapsed} of {t.flightDays}</dd><small>{t.daysRemaining} days remaining</small></div>
      <div><dt>Spend to date</dt><dd>{cad(t.spend)}</dd><small>{pct(t.budgetPct, 1)} of {cad(plan.totalBudget)}</small></div>
      <div><dt>Pacing</dt><dd class={t.pacing !== null && (t.pacing > doc.pacing.overPace || t.pacing < doc.pacing.underPace) ? 'mp-warn' : ''}>{t.pacing === null ? '—' : pct(t.pacing)}</dd><small>of {cad(t.planned)} planned to date</small></div>
      <div><dt>{plan.conversionName}s</dt><dd>{t.conversions.toLocaleString('en-CA')}</dd><small>blended CPA {t.cpa === null ? '—' : cad(t.cpa, 2)}</small></div>
      <div><dt>Performance CPA</dt><dd class={t.performanceCpa !== null && t.performanceCpa <= plan.targetCpa ? 'mp-ok' : 'mp-warn'}>{t.performanceCpa === null ? '—' : cad(t.performanceCpa, 2)}</dd><small>target {cad(plan.targetCpa, 2)}</small></div>
      <div><dt>Need you today</dt><dd class={needsYou ? 'mp-warn' : 'mp-ok'}>{needsYou} of {t.rows.length}</dd>
        <small>{source === 'sim' ? 'heuristic stand-in, not Jev' : 'Jev'}</small></div>
    </dl>
  </section>

  <section class="mp-card">
    <h2>Line pacing <span class="mp-muted legend">blue fields are today's inputs</span></h2>
    <div class="mp-scroll">
      <table class="mp-table pace">
        <thead>
          <tr>
            <th>Line</th><th class="r">Net budget</th><th class="r">Planned to date</th><th class="r">Actual to date</th>
            <th class="r" title="Spend to date ÷ what the flowchart planned by today. Outside the band above, the line is flagged.">Pacing</th><th>Status</th>{#if hasBooked}<th class="r" title="Spend delivered ÷ spend the retailer or publisher booked. Low fill means the inventory ran out, which bidding harder cannot fix.">Fill</th>{/if}<th class="r">Remaining</th><th class="r">Yesterday</th><th class="r">Daily target</th>
            <th class="r">Impressions</th><th class="r">{plan.conversionName}s</th><th class="r">CPA</th><th class="r">vs target</th>
            <th title="What the model suggests for this line today, how sure it is, and why. Approve or overrule; either way it goes on the Decisions tab.">Suggested</th><th>Action / notes</th>
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
                <td><input class="mp-in num input-cell money" type="number" min="0" step="100" bind:value={a.spend} aria-label="Actual spend" /></td>
                <td class="r num">{r.pacing === null ? 'n/a' : pct(r.pacing)}</td>
                <td><span class="mp-pill" data-s={r.status}>{r.status}</span></td>
                {#if hasBooked}
                  <td class="r num" class:mp-warn={!!a.booked && a.spend / a.booked < 0.9}>{a.booked ? pct(a.spend / a.booked) : '—'}</td>
                {/if}
                <td class="r num">{cad(r.remaining)}</td>
                <td><input class="mp-in num input-cell small-in" type="number" min="0" step="50" bind:value={a.yesterday} aria-label="Yesterday spend" /></td>
                <td class="r num">{cad(r.dailyTarget)}</td>
                <td><input class="mp-in num input-cell money" type="number" min="0" step="1000" bind:value={a.impressions} aria-label="Impressions" /></td>
                <td><input class="mp-in num input-cell small-in" type="number" min="0" step="10" bind:value={a.conversions} aria-label="Conversions" /></td>
                <td class="r num">{r.cpa === null ? '—' : cad(r.cpa, 2)}</td>
                <td class="r num" class:mp-bad={r.line.role === 'performance' && (r.cpaVsTarget ?? 0) > 0} class:mp-ok={r.line.role === 'performance' && r.cpaVsTarget !== null && r.cpaVsTarget <= 0}>
                  {r.cpaVsTarget === null ? '—' : signedPct(r.cpaVsTarget)}
                </td>
                <td class="sugg">
                  {#if s}
                    <DecisionCell
                      entry={doc.decisions.find((d) => d.key === pacingKey(doc.pacing.dataThrough, r.line.id))}
                      needsYou={s.needsYou}
                      action={LEVERS[s.lever].label}
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
                <td><textarea class="note" rows="1" bind:value={a.note} aria-label="Action notes"></textarea></td>
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
            <td class="r num">{cad(t.remaining)}</td>
            <td class="r num">{cad(t.yesterday)}</td>
            <td class="r num">{cad(t.dailyTarget)}</td>
            <td class="r num">{t.impressions.toLocaleString('en-CA')}</td>
            <td class="r num">{t.conversions.toLocaleString('en-CA')}</td>
            <td class="r num">{t.cpa === null ? '—' : cad(t.cpa, 2)}</td>
            <td class="r num">{t.cpaVsTarget === null ? '—' : signedPct(t.cpaVsTarget)}</td>
            <td colspan="2"></td>
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
  .settings { margin-bottom: 0.9rem; }
  .static { font-size: 0.9rem; text-transform: none; letter-spacing: normal; color: var(--text-primary); padding: 0.32rem 0; }
  .static a { font-size: 0.75rem; margin-left: 0.3rem; }
  .tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.6rem; margin: 0; }
  .tiles div { padding: 0.55rem 0.7rem; background: var(--surface-2); border-radius: 8px; }
  .tiles dt { font-size: 0.64rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); }
  .tiles dd { margin: 0.1rem 0 0; font-size: 1.2rem; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
  .tiles small { font-size: 0.7rem; color: var(--text-muted); }
  .legend { font-size: 0.7rem; font-weight: 500; margin-left: 0.4rem; }
  .pace .name { min-width: 11rem; }
  .pace .name small { display: block; color: var(--text-muted); font-size: 0.7rem; }
  .pace .money { width: 7.5rem; }
  .pace .small-in { width: 5.5rem; }
  .pace tr.flag td:first-child { box-shadow: inset 3px 0 0 var(--serious); }
  .sugg { min-width: 12rem; }
  .note { font: inherit; font-size: 0.76rem; min-width: 16rem; width: 100%; color: var(--text-primary); background: var(--surface-2); border: 1px solid var(--border); border-radius: 7px; padding: 0.25rem 0.4rem; resize: vertical; }
  .next { font-weight: 600; font-size: 0.9rem; }
</style>

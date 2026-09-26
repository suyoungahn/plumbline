<script lang="ts">
  import { base } from '$app/paths';
  import { page } from '$app/state';
  import { records } from '$lib/mediaplan/store.svelte';
  const doc = $derived(records[page.params.id!]);
  import { CHANNELS } from '$lib/mediaplan/types';
  import { addDays, cad, cadK, dayMonth, flowTotals, isHeld, pct, spreadEvenly, weekStart, weekly, weightTotal } from '$lib/mediaplan/calc';
  import { downloadWorkbook } from '$lib/mediaplan/xlsx';

  const plan = $derived(doc.plan);
  const ft = $derived(flowTotals(plan));
  const wsum = $derived(weightTotal(plan));
  const weightsOk = $derived(Math.round(wsum * 10000) === 10000);
  const peak = $derived(Math.max(1, ...ft.byWeek));
  let exporting = $state(false);

  function toggleHeld(id: string) {
    const held = doc.plan.heldLineIds;
    doc.plan.heldLineIds = held.includes(id) ? held.filter((x) => x !== id) : [...held, id];
  }

  function setWeight(i: number, v: number) {
    doc.plan.weeks[i].weight = Math.max(0, v / 100);
  }

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
      <h2 class="tab-title">Flowchart</h2>
      <p class="lede">How the budget spreads across the weeks.</p>
    </div>
    <div class="mp-actions">
      <button onclick={() => spreadEvenly(doc.plan)}>Spread evenly</button>
      <button onclick={exportXlsx} disabled={exporting}>{exporting ? 'Building…' : 'Export to Excel'}</button>
    </div>
  </header>

  <section class="mp-card" data-tone={weightsOk ? undefined : 'alert'}>
    <h2>Weekly weights and retail moments</h2>
    <div class="weeks">
      {#each doc.plan.weeks as w, i (i)}
        {@const start = weekStart(plan, i)}
        <div class="week">
          <span class="wk">Wk {i + 1}</span>
          <span class="dates">{dayMonth(start)}–{dayMonth(addDays(start, 6))}</span>
          <div class="bar-slot" title={`Week ${i + 1}: ${cad(ft.byWeek[i])}`}>
            <div class="bar" style:height={`${(ft.byWeek[i] / peak) * 100}%`}></div>
          </div>
          <span class="amt">{cadK(ft.byWeek[i])}</span>
          <label class="mp-field">Weight %
            <input class="input-cell" type="number" step="1" min="0" max="100" value={Math.round(w.weight * 1000) / 10}
              oninput={(e) => setWeight(i, +e.currentTarget.value)} />
          </label>
          <label class="mp-field">Retail moment
            <textarea rows="2" bind:value={w.moment}></textarea>
          </label>
        </div>
      {/each}
    </div>
    <p class="mp-note" style="margin: 0.6rem 0 0">
      Weights total <strong class={weightsOk ? 'mp-ok' : 'mp-bad'}>{pct(wsum, 1)}</strong>{weightsOk ? '' : ', and must equal 100%'}.
      The flight has {plan.weeks.length} weeks; change the dates on the Plan step to add or remove weeks.
    </p>
  </section>

  <section class="mp-card">
    <h2>Weekly net spend by line</h2>
    <div class="mp-scroll">
      <table class="mp-table flow">
        <thead>
          <tr>
            <th>Channel</th><th>Partner</th><th class="r">Net budget</th>
            {#each plan.weeks as _, i (i)}<th class="r">Wk {i + 1}</th>{/each}
            <th class="r">Total</th><th>Check</th><th>Held</th>
          </tr>
        </thead>
        <tbody>
          {#each plan.lines as l (l.id)}
            {@const wk = weekly(plan, l)}
            {@const total = wk.reduce((s, v) => s + v, 0)}
            {@const held = isHeld(plan, l)}
            <tr class:held>
              <td>{CHANNELS[l.channel].label}</td>
              <td class="muted">{l.partner}</td>
              <td class="r num">{cad(l.budget)}</td>
              {#each wk as v, i (i)}<td class="r num" class:live={v > 0}>{v ? cad(v) : '—'}</td>{/each}
              <td class="r num">{cad(total)}</td>
              <td class={held ? 'muted' : Math.round(total - l.budget) === 0 ? 'mp-ok' : 'mp-bad'}>
                {held ? 'Held' : Math.round(total - l.budget) === 0 ? 'OK' : 'Diff'}
              </td>
              <td><input type="checkbox" checked={held} onchange={() => toggleHeld(l.id)} aria-label={`Hold ${l.partner}`} /></td>
            </tr>
          {/each}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="2">Weekly total</td><td class="r num">{cad(plan.lines.reduce((s, l) => s + l.budget, 0))}</td>
            {#each ft.byWeek as v, i (i)}<td class="r num">{cad(v)}</td>{/each}
            <td class="r num">{cad(ft.cumulative[ft.cumulative.length - 1] ?? 0)}</td><td colspan="2"></td>
          </tr>
          <tr class="sub">
            <td colspan="3">Cumulative spend</td>
            {#each ft.cumulative as v, i (i)}<td class="r num">{cad(v)}</td>{/each}
            <td colspan="3"></td>
          </tr>
          <tr class="sub">
            <td colspan="3">Cumulative % of budget</td>
            {#each ft.cumulativePct as v, i (i)}<td class="r num">{pct(v)}</td>{/each}
            <td colspan="3"></td>
          </tr>
        </tfoot>
      </table>
    </div>
    <p class="mp-note" style="margin: 0.6rem 0 0">
      Shaded cells are weeks the line is live. Held lines, like the test and learn reserve, stay unflighted
      until the client approves their release, so the gap in cumulative % is intentional.
    </p>
  </section>

  <div class="mp-next"><a class="next" href={`${base}/campaign/${page.params.id}/pacing`}>Next: track pacing against this →</a></div>
</div>

<style>
  .weeks { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 0.6rem; }
  .week { display: flex; flex-direction: column; gap: 0.35rem; padding: 0.55rem; background: var(--surface-2); border-radius: 8px; }
  .wk { font-weight: 700; font-size: 0.82rem; }
  .dates { font-size: 0.72rem; color: var(--text-muted); margin-top: -0.3rem; }
  .bar-slot { height: 54px; display: flex; align-items: flex-end; border-bottom: 1px solid var(--axis); }
  .bar { width: 100%; background: var(--seq-400); border-radius: 4px 4px 0 0; min-height: 2px; }
  .amt { font-size: 0.76rem; font-variant-numeric: tabular-nums; color: var(--text-secondary); }
  .week textarea { resize: vertical; }
  .flow td.live { background: color-mix(in srgb, var(--seq-100) 55%, transparent); }
  .flow tr.held td { color: var(--text-muted); }
  .flow tfoot tr.sub td { font-weight: 500; color: var(--text-secondary); border-top: none; }
  .next { font-weight: 600; font-size: 0.9rem; }
</style>

<script lang="ts">
  import { base } from '$app/paths';
  import { RECORD_IDS, records, settings } from '$lib/mediaplan/store.svelte';

  // Learn by doing: three real tasks, each ticked off when it is done, skippable,
  // and gone for good once hidden.
  const decided = $derived(RECORD_IDS.some((id) => records[id].decisions.some((d) => d.ruledBy === 'manager')));
  const steps = $derived([
    { done: decided, label: 'Make your first decision', hint: 'Approve or decline one card below. You can undo it.' },
    { done: settings.seenPlan, label: 'Open a campaign plan', hint: 'Line items and budget, like the sheet you know.', href: '/campaign/pcexpress-holiday/plan' },
    { done: settings.seenReport, label: 'Preview a client report', hint: 'Written from the numbers and your decisions.', href: '/campaign/pcexpress-holiday/report' }
  ]);
  const doneCount = $derived(steps.filter((s) => s.done).length);
</script>

{#if !settings.welcomed}
  <section class="gs" aria-label="Getting started">
    <div class="top">
      <div>
        <h2>Getting started</h2>
        <p>Plumbline checks every campaign each morning. You only see what needs a person.</p>
      </div>
      <button class="hide" onclick={() => (settings.welcomed = true)}>{doneCount === steps.length ? 'Done' : 'Hide'}</button>
    </div>
    <ol>
      {#each steps as s, i (s.label)}
        <li class:done={s.done}>
          <span class="dot" aria-hidden="true">{s.done ? '✓' : i + 1}</span>
          <span class="txt">
            {#if s.href && !s.done}<a href={`${base}${s.href}`}>{s.label}</a>{:else}<strong>{s.label}</strong>{/if}
            <small>{s.hint}</small>
          </span>
        </li>
      {/each}
    </ol>
    <p class="mode">Learning mode is on: nothing changes on any platform until your team turns it off.</p>
  </section>
{/if}

<style>
  .gs { margin-bottom: 1.5rem; padding: 1.1rem 1.25rem; border-radius: 14px; background: color-mix(in srgb, var(--series-1) 6%, var(--surface-1)); box-shadow: 0 0 0 1px color-mix(in srgb, var(--series-1) 22%, transparent); }
  .top { display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; }
  h2 { font-size: 1.05rem; font-weight: 650; }
  .top p { margin: 0.2rem 0 0; color: var(--text-secondary); font-size: 0.92rem; }
  .hide { background: none; border: none; color: var(--series-1); font-size: 0.88rem; padding: 0.2rem 0.3rem; }
  ol { list-style: none; padding: 0; margin: 0.9rem 0 0.6rem; display: flex; flex-direction: column; gap: 0.6rem; }
  li { display: flex; gap: 0.7rem; align-items: flex-start; }
  .dot { flex: none; width: 1.5rem; height: 1.5rem; border-radius: 50%; display: grid; place-items: center; font-size: 0.78rem; font-weight: 700; background: var(--surface-3); color: var(--text-secondary); }
  li.done .dot { background: var(--good); color: #fff; }
  .txt { display: flex; flex-direction: column; font-size: 0.95rem; }
  .txt a { font-weight: 600; text-decoration: none; }
  li.done strong { color: var(--text-muted); text-decoration: line-through; font-weight: 500; }
  small { color: var(--text-muted); font-size: 0.82rem; }
  .mode { margin: 0; font-size: 0.82rem; color: var(--text-muted); }
</style>

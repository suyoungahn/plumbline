<script lang="ts">
  import { band, RULING_LABEL, SOURCE_LABEL } from '$lib/mediaplan/decisions';
  import type { DecisionEntry, Provenance } from '$lib/mediaplan/types';

  // One suggestion, presented the same way everywhere: what to do, how sure, why,
  // and a one-click ruling that goes into the campaign's decision record.
  let {
    entry,
    needsYou,
    action,
    confidence,
    gate,
    why,
    alternatives = [],
    source,
    idle = 'Nothing to do',
    onrule,
    onundo
  }: {
    entry?: DecisionEntry;
    needsYou: boolean;
    action: string;
    confidence: number;
    gate: number;
    why: string;
    alternatives?: string[];
    source: Provenance;
    idle?: string;
    onrule: (ruling: 'approved' | 'overruled') => void;
    onundo: () => void;
  } = $props();

  const b = $derived(band(confidence));
  const tip = $derived(`${SOURCE_LABEL[source]}: ${Math.round(gate * 100)}% that this needs a person; ${Math.round(confidence * 100)}% confidence in the action. ${b.hint}`);
</script>

<div class="dc">
  {#if entry}
    <span class="ruled" data-r={entry.ruling}>{RULING_LABEL[entry.ruling]}{entry.ruledBy === 'manager' ? ' by you' : ''}</span>
    <span class="act">{entry.action}</span>
    {#if entry.ruledBy === 'manager'}<button class="undo" onclick={onundo}>undo</button>{/if}
  {:else if needsYou}
    <span class="band" data-b={b.key} title={tip}>{b.label}</span>
    <strong class="act">{action}</strong>
    {#if why}<span class="why">{why}</span>{/if}
    {#if b.key === 'unsure' && alternatives.length}<span class="alt">Also close: {alternatives.join(', ')}</span>{/if}
    <span class="btns">
      <button class="ok" onclick={() => onrule('approved')}>Approve</button>
      <button onclick={() => onrule('overruled')}>Overrule</button>
    </span>
    <span class="src">{SOURCE_LABEL[source]}</span>
  {:else}
    <span class="idle">{idle}</span>
  {/if}
</div>

<style>
  .dc { display: flex; flex-direction: column; gap: 0.2rem; font-size: 0.75rem; min-width: 11rem; }
  .band { align-self: flex-start; font-size: 0.64rem; font-weight: 700; padding: 0.08rem 0.4rem; border-radius: 20px; cursor: help; }
  .band[data-b='clear'] { background: color-mix(in srgb, var(--good) 16%, transparent); color: var(--good-text); }
  .band[data-b='judgment'] { background: color-mix(in srgb, var(--warning) 24%, transparent); color: var(--text-primary); }
  .band[data-b='unsure'] { background: color-mix(in srgb, var(--serious) 18%, transparent); color: var(--text-primary); }
  .act { font-size: 0.8rem; }
  .why, .alt, .src, .idle { color: var(--text-muted); font-size: 0.7rem; }
  .src { font-style: italic; }
  .btns { display: flex; gap: 0.3rem; margin-top: 0.15rem; }
  .btns button { font-size: 0.72rem; padding: 0.15rem 0.5rem; }
  .btns .ok { background: var(--series-1); border-color: var(--series-1); color: #fff; font-weight: 600; }
  .ruled { align-self: flex-start; font-size: 0.64rem; font-weight: 700; padding: 0.08rem 0.4rem; border-radius: 20px; background: var(--surface-3); color: var(--text-secondary); }
  .ruled[data-r='approved'] { background: color-mix(in srgb, var(--series-1) 16%, transparent); color: var(--series-1); }
  .ruled[data-r='shadow'] { background: color-mix(in srgb, var(--series-7) 12%, transparent); color: var(--series-7); }
  .ruled[data-r='auto'] { background: color-mix(in srgb, var(--good) 14%, transparent); color: var(--good-text); }
  .undo { align-self: flex-start; background: none; border: none; padding: 0; color: var(--series-1); font-size: 0.7rem; }
</style>

<script lang="ts">
  let {
    value,
    max = 1,
    label,
    caption = '',
    tone = 'seq'
  }: {
    value: number;
    max?: number;
    label: string;
    caption?: string;
    tone?: 'seq' | 'good' | 'warning' | 'serious' | 'critical';
  } = $props();

  const pct = $derived(Math.min(Math.max(value / max, 0), 1));
</script>

<div class="meter">
  <div class="head">
    <span class="eyebrow">{label}</span>
    <strong class="tabular">{max === 1 ? `${(value * 100).toFixed(0)}%` : value.toFixed(1)}</strong>
  </div>
  <div class="track" role="meter" aria-valuenow={value} aria-valuemin="0" aria-valuemax={max} aria-label={label}>
    <div class="fill" data-tone={tone} style:width={`${pct * 100}%`}></div>
  </div>
  {#if caption}<span class="caption">{caption}</span>{/if}
</div>

<style>
  .meter { display: flex; flex-direction: column; gap: 0.3rem; }
  .head { display: flex; align-items: baseline; justify-content: space-between; gap: 0.5rem; }
  .head strong { font-size: 1.05rem; letter-spacing: -0.015em; }
  .track { height: 8px; background: var(--surface-3); border-radius: 4px; overflow: hidden; }
  .fill { height: 100%; border-radius: 0 4px 4px 0; transition: width 320ms cubic-bezier(0.22, 1, 0.36, 1); }
  .fill[data-tone='seq'] { background: var(--series-1); }
  .fill[data-tone='good'] { background: var(--good); }
  .fill[data-tone='warning'] { background: var(--warning); }
  .fill[data-tone='serious'] { background: var(--serious); }
  .fill[data-tone='critical'] { background: var(--critical); }
  .caption { font-size: 0.73rem; color: var(--text-muted); }
</style>

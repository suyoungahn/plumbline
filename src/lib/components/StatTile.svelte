<script lang="ts">
  let {
    label,
    value,
    detail = '',
    status = 'neutral'
  }: {
    label: string;
    value: string;
    detail?: string;
    status?: 'neutral' | 'good' | 'warning' | 'serious' | 'critical';
  } = $props();
</script>

<div class="tile">
  <span class="eyebrow">{label}</span>
  <strong class="value tabular" data-status={status}>{value}</strong>
  {#if detail}<span class="detail">{detail}</span>{/if}
</div>

<style>
  .tile {
    display: flex; flex-direction: column; gap: 0.15rem;
    padding: 0.7rem 0.9rem;
    background: var(--surface-1);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    min-width: 0;
  }
  .value { font-size: 1.4rem; line-height: 1.15; letter-spacing: -0.02em; }

  .value[data-status='good'] { color: var(--good-text); }
  .value[data-status='critical'] { color: var(--critical); }
  .value[data-status='serious'] { color: var(--serious); }
  .value[data-status='warning'] { color: var(--text-primary); }
  .detail { font-size: 0.75rem; color: var(--text-secondary); }
</style>

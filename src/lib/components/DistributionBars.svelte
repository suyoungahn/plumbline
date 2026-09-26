<script lang="ts">

  let {
    items,
    selected,
    max = 1
  }: {
    items: { key: string; label: string; value: number }[];
    selected?: string;
    max?: number;
  } = $props();

  const sorted = $derived([...items].sort((a, b) => b.value - a.value));
</script>

<ul class="bars">
  {#each sorted as item (item.key)}
    <li class:is-selected={item.key === selected}>
      <span class="label">{item.label}</span>
      <span class="track">
        <span
          class="fill"
          style:width={`${Math.max(item.value / max, 0) * 100}%`}
          title={`${item.label}: ${(item.value * 100).toFixed(1)} percent`}
        ></span>
      </span>
      <span class="pct tabular">{(item.value * 100).toFixed(0)}%</span>
    </li>
  {/each}
</ul>

<style>
  .bars { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
  li {
    display: grid;
    grid-template-columns: 8.5rem 1fr 2.6rem;
    align-items: center;
    gap: 0.6rem;
    padding: 0.18rem 0;
  }
  .label { font-size: 0.8rem; color: var(--text-secondary); }
  li.is-selected .label { color: var(--text-primary); font-weight: 600; }
  .track { height: 15px; background: var(--surface-3); border-radius: 4px; overflow: hidden; }
  .fill {
    display: block; height: 100%;
    background: var(--seq-250);
    border-radius: 0 4px 4px 0;
    transition: width 320ms cubic-bezier(0.22, 1, 0.36, 1);
  }
  li.is-selected .fill { background: var(--seq-450, var(--series-1)); }
  .pct { font-size: 0.78rem; color: var(--text-muted); text-align: right; }
  li.is-selected .pct { color: var(--text-primary); font-weight: 600; }
</style>

<script lang="ts">
  import type { RailStat } from './stat-rail';

  let { stats, title = 'At a glance' }: { stats: RailStat[]; title?: string } = $props();
</script>

<aside class="rail">
  <span class="rt">{title}</span>
  <ul>
    {#each stats as s (s.label)}
      <li data-tone={s.tone ?? 'neutral'}>
        <span class="l">{s.label}</span>
        <strong class="v">{s.value}</strong>
        {#if s.bar !== undefined}
          <span class="track">
            <span class="fill" style:width={`${Math.min(1, Math.max(0, s.bar)) * 100}%`}></span>
            {#if s.threshold !== undefined && s.threshold < 1}
              <span class="cut" style:left={`${s.threshold * 100}%`}></span>
            {/if}
          </span>
        {/if}
        {#if s.note}<span class="n">{s.note}</span>{/if}
      </li>
    {/each}
  </ul>
</aside>

<style>
  .rail {
    position: sticky;
    top: 4.2rem;
    align-self: start;
    padding: 0.85rem 0.9rem;
    background: var(--surface-1);
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }
  .rt {
    display: block;
    font-size: 0.62rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
    margin-bottom: 0.7rem;
  }
  ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.75rem; }
  li { display: flex; flex-direction: column; gap: 0.1rem; }
  .l { font-size: 0.64rem; text-transform: uppercase; letter-spacing: 0.055em; color: var(--text-muted); }
  .v { font-size: 1.15rem; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; line-height: 1.15; }
  li[data-tone='good'] .v { color: var(--good-text); }
  li[data-tone='bad'] .v { color: var(--critical); }
  li[data-tone='warn'] .v { color: var(--serious); }
  .n { font-size: 0.66rem; color: var(--text-secondary); }
  .track { position: relative; height: 5px; background: var(--surface-3); border-radius: 3px; margin-top: 0.25rem; }
  .fill { position: absolute; inset: 0 auto 0 0; border-radius: 3px; background: var(--series-1); transition: width 300ms cubic-bezier(0.22, 1, 0.36, 1); }
  li[data-tone='good'] .fill { background: var(--good); }
  li[data-tone='bad'] .fill { background: var(--critical); }
  li[data-tone='warn'] .fill { background: var(--serious); }
  .cut { position: absolute; top: -2px; bottom: -2px; width: 2px; background: var(--text-primary); border-radius: 1px; }

  @media (max-width: 900px) {
    .rail { position: static; }
    ul { flex-direction: row; flex-wrap: wrap; gap: 1.1rem; }
    .track { display: none; }
  }
</style>

<script lang="ts">
  import { RECORD_IDS, records, settings } from '$lib/mediaplan/store.svelte';
  import { ACTION_TYPES, MIN_AGREEMENT, MIN_RULINGS, trackRecord } from '$lib/mediaplan/autonomy';

  // Where the team hands routine calls to Plumbline, one kind of action at a time,
  // once its record shows people agree with it.
  const all = $derived(RECORD_IDS.flatMap((id) => records[id].decisions));
  const groups = ['Campaign and pacing', 'Search terms'] as const;
  const autoCount = $derived(ACTION_TYPES.filter((a) => settings.autonomy[a.id] === 'auto').length);
</script>

<div class="page auto">
  <header>
    <h1>Autonomy</h1>
    <p class="sub">Hand over the calls Plumbline has earned. Keep the judgment calls.</p>
  </header>

  <section class="mode" class:on={settings.shadow}>
    <div>
      <h2>{settings.shadow ? 'Learning mode is on' : 'Learning mode is off'}</h2>
      <p>{settings.shadow ? 'Plumbline suggests and records. Nothing changes on any platform.' : `Routine changes apply on their own${autoCount ? `, and so ${autoCount === 1 ? 'does 1 action type' : `do ${autoCount} action types`} set to automatic` : ''}.`}</p>
    </div>
    <button class:primary={settings.shadow} onclick={() => (settings.shadow = !settings.shadow)}>{settings.shadow ? 'Turn off' : 'Turn back on'}</button>
  </section>

  {#each groups as g (g)}
    <section class="group">
      <h2>{g}</h2>
      <ul>
        {#each ACTION_TYPES.filter((a) => a.group === g) as a (a.id)}
          {@const t = trackRecord(a.id, all)}
          {@const isAuto = settings.autonomy[a.id] === 'auto'}
          <li>
            <div class="name">
              <strong>{a.label}</strong>
              {#if a.locked}
                <small>{a.locked}</small>
              {:else}
                <small>
                  Approved {t.approved} of {t.ruled}
                  <span class="meter" aria-hidden="true"><span style:width={`${Math.round(t.rate * 100)}%`} class:ok={t.eligible}></span></span>
                  {Math.round(t.rate * 100)}%
                </small>
              {/if}
            </div>
            {#if a.locked}
              <span class="lock">Always you</span>
            {:else}
              <div class="seg" role="radiogroup" aria-label={`${a.label} autonomy`}>
                <button role="radio" aria-checked={!isAuto} class:on={!isAuto} onclick={() => (settings.autonomy[a.id] = 'manual')}>Manual</button>
                <button role="radio" aria-checked={isAuto} class:on={isAuto} disabled={!t.eligible && !isAuto}
                  title={t.eligible ? '' : `Unlocks at ${MIN_RULINGS} rulings with ${Math.round(MIN_AGREEMENT * 100)}% agreement`}
                  onclick={() => (settings.autonomy[a.id] = 'auto')}>Automatic</button>
              </div>
            {/if}
          </li>
        {/each}
      </ul>
    </section>
  {/each}

  <p class="foot">
    Automatic unlocks at {MIN_RULINGS} rulings with {Math.round(MIN_AGREEMENT * 100)}% agreement. Unsure calls always come to you.
    Track records include the last 30 days (illustrative).
  </p>
</div>

<style>
  .auto { max-width: 760px; }
  h1 { font-size: 2rem; font-weight: 700; letter-spacing: -0.025em; }
  .sub { font-size: 1.05rem; color: var(--text-secondary); margin: 0.3rem 0 1.5rem; }
  .mode { display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding: 1.1rem 1.25rem; border-radius: 14px; background: var(--surface-1); box-shadow: 0 0 0 1px var(--border); margin-bottom: 1.5rem; }
  .mode.on { background: color-mix(in srgb, var(--series-7) 8%, var(--surface-1)); box-shadow: 0 0 0 1px color-mix(in srgb, var(--series-7) 30%, transparent); }
  .mode h2 { font-size: 1.05rem; }
  .mode p { margin: 0.2rem 0 0; color: var(--text-secondary); font-size: 0.92rem; }
  button { border-radius: 999px; font-size: 0.88rem; padding: 0.45rem 1rem; white-space: nowrap; }
  .primary { background: var(--series-1); border-color: var(--series-1); color: #fff; font-weight: 600; }
  .group { margin-bottom: 1.5rem; }
  .group h2 { font-size: 0.95rem; color: var(--text-secondary); margin-bottom: 0.5rem; }
  ul { list-style: none; padding: 0; margin: 0; background: var(--surface-1); border-radius: 14px; box-shadow: 0 0 0 1px var(--border); }
  li { display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding: 0.85rem 1.1rem; border-top: 1px solid var(--grid); }
  li:first-child { border-top: none; }
  .name { display: flex; flex-direction: column; gap: 0.15rem; min-width: 0; }
  .name strong { font-weight: 600; }
  .name small { color: var(--text-muted); font-size: 0.82rem; display: flex; align-items: center; gap: 0.4rem; }
  .meter { display: inline-block; width: 64px; height: 5px; border-radius: 3px; background: var(--surface-3); overflow: hidden; }
  .meter span { display: block; height: 100%; background: var(--warning); }
  .meter span.ok { background: var(--good); }
  .seg { display: inline-flex; padding: 3px; gap: 2px; border-radius: 999px; background: var(--surface-3); }
  .seg button { border: none; background: none; padding: 0.3rem 0.9rem; font-size: 0.82rem; color: var(--text-secondary); }
  .seg button.on { background: var(--surface-1); color: var(--text-primary); font-weight: 600; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1); }
  .lock { font-size: 0.82rem; color: var(--text-muted); }
  .foot { font-size: 0.82rem; color: var(--text-muted); }
</style>

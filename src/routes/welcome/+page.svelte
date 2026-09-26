<script lang="ts">
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import { settings } from '$lib/mediaplan/store.svelte';

  // Four screens, one idea each, before the product. Skippable, and replayable from
  // "How it works" in the header.
  const slides = [
    { title: 'Seven tools. Every morning. By hand.', body: 'Numbers copied between sheets, platforms and decks.' },
    { title: 'Every campaign, checked daily.', body: 'You see only what needs a decision.' },
    { title: 'You make the call.', body: 'Approve, decline or open the details.' },
    { title: 'Hand over routine work.', body: 'Turn on automatic actions as they prove reliable.' }
  ];
  let i = $state(0);

  function finish() {
    settings.introSeen = true;
    goto(`${base}/today`);
  }
  function key(e: KeyboardEvent) {
    if (e.key === 'ArrowRight') i = Math.min(slides.length - 1, i + 1);
    if (e.key === 'ArrowLeft') i = Math.max(0, i - 1);
    if (e.key === 'Escape') finish();
  }
  const TOOLS = ['Google Sheets', 'DV360', 'The Trade Desk', 'Meta', 'Walmart Connect', 'Loblaw Advance', 'PowerPoint'];
</script>

<svelte:window onkeydown={key} />

<div class="intro">
  <button class="skip" onclick={finish}>Skip</button>

  <div class="stage" aria-live="polite">
    <div class="art" aria-hidden="true">
      {#if i === 0}
        <div class="tools">
          {#each TOOLS as t, k (t)}<span style:--r={`${(k % 2 ? 1 : -1) * (2 + k)}deg`}>{t}</span>{/each}
        </div>
      {:else if i === 1}
        <div class="funnel">
          <div class="dots">{#each Array(24) as _, k (k)}<span class:hot={k === 3 || k === 11 || k === 19}></span>{/each}</div>
          <div class="arrow">↓</div>
          <div class="three"><span>3 to review</span><span class="quiet">21 on track</span></div>
        </div>
      {:else if i === 2}
        <div class="card">
          <small>McCain Foods · Superfries freezer reset</small>
          <strong>Walmart onsite ran out of inventory</strong>
          <p>Suggested: <b>Move CA$76K to programmatic</b></p>
          <div class="btns"><span class="b primary">Approve</span><span class="b">Decline</span><span class="b plain">Details</span></div>
        </div>
      {:else}
        <ol class="ladder">
          <li class="done"><b>Learning mode</b><span>You review everything</span></li>
          <li><b>Routine changes</b><span>Applied automatically</span></li>
          <li><b>Proven actions</b><span>Turned on one at a time</span></li>
        </ol>
      {/if}
    </div>

    <h1>{slides[i].title}</h1>
    <p>{slides[i].body}</p>
  </div>

  <div class="nav">
    <button class="back" disabled={i === 0} onclick={() => (i -= 1)}>Back</button>
    <div class="pips" role="tablist" aria-label="Intro steps">
      {#each slides as s, k (s.title)}
        <button role="tab" aria-selected={k === i} aria-label={`Step ${k + 1}`} class:on={k === i} onclick={() => (i = k)}></button>
      {/each}
    </div>
    {#if i < slides.length - 1}
      <button class="next" onclick={() => (i += 1)}>Next</button>
    {:else}
      <button class="next" onclick={finish}>Open my Inbox</button>
    {/if}
  </div>
</div>

<style>
  .intro { min-height: 100dvh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem 1rem; position: relative; background: var(--plane); }
  .skip { position: absolute; top: 1.2rem; right: 1.2rem; background: none; border: none; color: var(--text-secondary); font-size: 0.95rem; }
  .stage { max-width: 620px; text-align: center; }
  .art { height: 240px; display: grid; place-items: center; margin-bottom: 1.5rem; }
  h1 { font-size: clamp(1.6rem, 4vw, 2.3rem); font-weight: 700; letter-spacing: -0.03em; line-height: 1.15; }
  .stage > p { font-size: 1.1rem; color: var(--text-secondary); margin: 0.8rem auto 0; max-width: 34em; line-height: 1.5; }

  .tools { display: flex; flex-wrap: wrap; gap: 0.6rem; justify-content: center; max-width: 440px; }
  .tools span { transform: rotate(var(--r)); padding: 0.5rem 0.9rem; border-radius: 10px; background: var(--surface-1); box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08), 0 0 0 1px var(--border); font-size: 0.9rem; font-weight: 500; }

  .funnel { display: flex; flex-direction: column; align-items: center; gap: 0.8rem; }
  .dots { display: grid; grid-template-columns: repeat(12, 14px); gap: 8px; }
  .dots span { width: 14px; height: 14px; border-radius: 50%; background: color-mix(in srgb, var(--good) 45%, transparent); }
  .dots span.hot { background: var(--series-2); box-shadow: 0 0 0 4px color-mix(in srgb, var(--series-2) 25%, transparent); }
  .arrow { font-size: 1.4rem; color: var(--text-muted); }
  .three { display: flex; gap: 1rem; font-weight: 600; }
  .three span { padding: 0.4rem 0.9rem; border-radius: 999px; background: color-mix(in srgb, var(--series-2) 15%, transparent); }
  .three .quiet { background: color-mix(in srgb, var(--good) 14%, transparent); color: var(--good-text); }

  .card { text-align: left; width: min(420px, 100%); padding: 1.1rem 1.25rem; border-radius: 14px; background: var(--surface-1); box-shadow: 0 6px 24px rgba(0, 0, 0, 0.1), 0 0 0 1px var(--border); display: flex; flex-direction: column; gap: 0.25rem; }
  .card small { color: var(--text-muted); }
  .card strong { font-size: 1.15rem; }
  .card p { margin: 0.1rem 0 0.6rem; color: var(--text-secondary); }
  .card b { color: var(--text-primary); }
  .btns { display: flex; gap: 0.5rem; }
  .b { padding: 0.4rem 0.95rem; border-radius: 999px; border: 1px solid var(--border); font-size: 0.88rem; }
  .b.primary { background: var(--series-1); border-color: var(--series-1); color: #fff; font-weight: 600; }
  .b.plain { border: none; color: var(--series-1); }

  .ladder { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.6rem; width: min(360px, 100%); text-align: left; }
  .ladder li { display: flex; flex-direction: column; padding: 0.7rem 1rem; border-radius: 12px; background: var(--surface-1); box-shadow: 0 0 0 1px var(--border); }
  .ladder li:nth-child(2) { margin-left: 1.5rem; }
  .ladder li:nth-child(3) { margin-left: 3rem; }
  .ladder li.done { box-shadow: 0 0 0 2px var(--series-7); }
  .ladder span { font-size: 0.85rem; color: var(--text-muted); }

  .nav { display: flex; align-items: center; gap: 1.2rem; margin-top: 2.5rem; }
  .nav button { border-radius: 999px; padding: 0.55rem 1.3rem; font-size: 0.95rem; }
  .next { background: var(--series-1); border-color: var(--series-1); color: #fff; font-weight: 600; min-width: 9rem; }
  .next:hover:not(:disabled) { background: var(--series-1); filter: brightness(1.08); }
  .back { background: none; border: none; color: var(--text-secondary); }
  .back:disabled { visibility: hidden; }
  .pips { display: flex; gap: 0.5rem; }
  .pips button { width: 8px; height: 8px; min-width: 0; padding: 0; border-radius: 50%; border: none; background: var(--axis); }
  .pips button.on { background: var(--series-1); width: 22px; border-radius: 4px; }
</style>

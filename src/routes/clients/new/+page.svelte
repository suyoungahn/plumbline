<script lang="ts">
  import { base } from '$app/paths';
  import { goto } from '$app/navigation';
  import { SUPPLY } from '$lib/supply';
  import { createClient } from '$lib/mediaplan/store.svelte';
  import { SCENARIO_TODAY } from '$lib/mediaplan/book';

  const RETAILERS = [...new Set(SUPPLY.filter((s) => s.surface === 'sponsored_display' || s.surface === 'in_app').map((s) => s.retailer))];

  let name = $state('');
  let category = $state('');
  let retailers = $state<string[]>([]);
  let contactName = $state('');
  let contactEmail = $state('');
  let tried = $state(false);

  const toggle = (r: string) => (retailers = retailers.includes(r) ? retailers.filter((x) => x !== r) : [...retailers, r]);

  function save() {
    tried = true;
    if (!name.trim()) return;
    const id = createClient({
      name: name.trim(),
      category: category.trim() || 'Uncategorised',
      retailers,
      markets: ['CA'],
      contact: contactName || contactEmail ? { name: contactName.trim(), email: contactEmail.trim() } : undefined,
      since: SCENARIO_TODAY
    });
    goto(`${base}/campaigns/new?client=${id}`);
  }
</script>

<div class="page form">
  <a class="back" href={`${base}/clients`}>Clients</a>
  <h1>New client</h1>

  <form onsubmit={(e) => { e.preventDefault(); save(); }}>
    <label class="mp-field">Name
      <input bind:value={name} placeholder="e.g. Saputo Dairy" aria-invalid={tried && !name.trim()} />
      {#if tried && !name.trim()}<span class="err">Enter a name.</span>{/if}
    </label>
    <label class="mp-field">Category<input bind:value={category} placeholder="e.g. Cheese and dairy" /></label>

    <fieldset>
      <legend>Retail partners</legend>
      <div class="chips">
        {#each RETAILERS as r (r)}
          <button type="button" class="chip" class:on={retailers.includes(r)} aria-pressed={retailers.includes(r)} onclick={() => toggle(r)}>{r}</button>
        {/each}
      </div>
    </fieldset>

    <div class="two">
      <label class="mp-field">Contact<input bind:value={contactName} placeholder="Name" /></label>
      <label class="mp-field">Email<input type="email" bind:value={contactEmail} placeholder="name@company.ca" /></label>
    </div>

    <p class="note">Market: Canada, including Quebec. English and French creative required.</p>

    <div class="actions">
      <a class="btn" href={`${base}/clients`}>Cancel</a>
      <button type="submit" class="btn primary">Create and plan a campaign</button>
    </div>
  </form>
</div>

<style>
  .form { max-width: 560px; }
  .back { font-size: 0.85rem; text-decoration: none; }
  .back::before { content: '‹ '; }
  h1 { font-size: 2rem; font-weight: 700; letter-spacing: -0.025em; margin: 0.3rem 0 1.4rem; }
  form { display: flex; flex-direction: column; gap: 1rem; }
  fieldset { border: none; padding: 0; margin: 0; }
  legend { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); margin-bottom: 0.4rem; }
  .chips { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .chip { border-radius: 999px; font-size: 0.85rem; padding: 0.35rem 0.85rem; }
  .chip.on { background: var(--series-1); border-color: var(--series-1); color: #fff; }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem; }
  .note { font-size: 0.82rem; color: var(--text-muted); margin: 0; }
  .err { font-size: 0.78rem; color: var(--critical); text-transform: none; letter-spacing: normal; }
  .actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 0.5rem; }
  .btn { display: inline-block; font-size: 0.9rem; padding: 0.5rem 1.1rem; border-radius: 999px; border: 1px solid var(--border); text-decoration: none; color: var(--text-primary); background: var(--surface-1); }
  .btn.primary { background: var(--series-1); border-color: var(--series-1); color: #fff; font-weight: 600; }
  @media (max-width: 560px) { .two { grid-template-columns: 1fr; } }
</style>

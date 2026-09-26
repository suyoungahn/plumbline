<script lang="ts">
  import { base } from '$app/paths';
  import { page } from '$app/state';
  import '../app.css';
  import { onMount } from 'svelte';
  import { restore } from '$lib/state.svelte';
  import { records, restoreCampaigns, saveCampaigns } from '$lib/mediaplan/store.svelte';

  let { children } = $props();

  // Four places: what needs you, every campaign (each with the same tabs), the
  // client view, and the record of every decision.
  const nav = [
    { href: '/today', label: 'Inbox', also: ['/keywords'] },
    { href: '/campaigns', label: 'Campaigns', also: ['/campaign', '/optimize', '/client-report'] },
    { href: '/clients', label: 'Clients', also: ['/reporting'] },
    { href: '/jev', label: 'Decision log', also: [] as string[] }
  ];

  const current = $derived(page.url.pathname);

  const onStage = (href: string) => {
    const full = `${base}${href}`;
    return current === full || current.startsWith(full + '/');
  };

  onMount(() => {
    restore();
    restoreCampaigns();
  });

  $effect(() => {
    JSON.stringify(records);
    saveCampaigns();
  });
</script>

<div class="shell">
  <header class="no-print">
    <div class="brand">
      <span class="mark" aria-hidden="true"></span>
      <div>
        <strong>Plumbline</strong>
        <span class="sub">Northfield Media · Retail Media, Canada</span>
      </div>
    </div>

    <nav aria-label="Main">
      {#each nav as s (s.href)}
        {@const on = [s.href, ...s.also].some(onStage)}
        <a href={`${base}${s.href}`} class:active={on} aria-current={on ? 'page' : undefined}>{s.label}</a>
      {/each}
    </nav>
  </header>

  <main>{@render children()}</main>
</div>

<style>
  .shell { min-height: 100dvh; display: flex; flex-direction: column; }

  header {
    display: flex; align-items: center; gap: 0.75rem 2rem; flex-wrap: wrap;
    padding: 0.75rem 1.25rem;
    border-bottom: 1px solid var(--border);
    background: var(--surface-1);
    position: sticky; top: 0; z-index: 10;
  }

  .brand { display: flex; align-items: center; gap: 0.6rem; }
  .brand strong { display: block; font-size: 0.95rem; letter-spacing: -0.01em; }
  .sub { display: block; font-size: 0.75rem; color: var(--text-muted); }
  .mark {
    width: 22px; height: 22px; border-radius: 6px;
    background: linear-gradient(135deg, var(--series-1), var(--series-7));
  }

  nav { display: flex; gap: 0.25rem; align-items: center; flex-wrap: wrap; }
  nav a {
    display: flex; align-items: center; gap: 0.45rem;
    padding: 0.4rem 0.75rem; border-radius: 7px;
    font-size: 0.85rem; font-weight: 500;
    color: var(--text-secondary); text-decoration: none;
    border: 1px solid transparent;
  }
  nav a:hover { background: var(--hover); color: var(--text-primary); }
  nav a.active {
    background: var(--surface-2); color: var(--text-primary);
    border-color: var(--border);
  }

  main { flex: 1; }

  @media (max-width: 720px) {
    header { flex-direction: column; align-items: flex-start; gap: 0.75rem; }
  }
</style>

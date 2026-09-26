<script lang="ts">
  import { base } from '$app/paths';
  import { page } from '$app/state';
  import '../app.css';
  import { onMount } from 'svelte';
  import { restore } from '$lib/state.svelte';
  import { doc, restoreCampaign, saveCampaign } from '$lib/mediaplan/store.svelte';

  let { children } = $props();

  // One campaign, start to finish, and then the whole book the manager runs.
  const campaignSteps = [
    { href: '/plan', label: 'Plan', n: 1 },
    { href: '/flowchart', label: 'Flowchart', n: 2 },
    { href: '/pacing', label: 'Pacing', n: 3 },
    { href: '/weekly-report', label: 'Weekly report', n: 4 }
  ];
  const book = [
    { href: '/today', label: 'Today' },
    { href: '/keywords', label: 'Search terms' },
    { href: '/clients', label: 'Clients' },
    { href: '/reporting', label: 'Reporting' },
    { href: '/jev', label: 'Decision log' }
  ];

  const current = $derived(page.url.pathname);

  const onStage = (href: string) => {
    const full = `${base}${href}`;
    return current === full || current.startsWith(full + '/');
  };

  onMount(() => {
    restore();
    restoreCampaign();
  });

  $effect(() => {
    JSON.stringify(doc);
    saveCampaign();
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

    <nav aria-label="Campaign steps">
      <span class="group">Campaign</span>
      {#each campaignSteps as s (s.href)}
        <a href={`${base}${s.href}`} class:active={onStage(s.href)} aria-current={onStage(s.href) ? 'page' : undefined}>
          <span class="n">{s.n}</span>{s.label}
        </a>
      {/each}
    </nav>
    <nav aria-label="Agency book" class="book">
      <span class="group">Book</span>
      {#each book as s (s.href)}
        <a href={`${base}${s.href}`} class:active={onStage(s.href)} aria-current={onStage(s.href) ? 'page' : undefined}>{s.label}</a>
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
  nav.book { margin-left: auto; }
  .group { font-size: 0.62rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-muted); margin-right: 0.2rem; }
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
  nav .n {
    display: grid; place-items: center;
    width: 17px; height: 17px; border-radius: 50%;
    font-size: 0.65rem; font-weight: 700;
    background: var(--surface-3); color: var(--text-muted);
  }
  nav a.active .n { background: var(--series-1); color: #fff; }

  main { flex: 1; }

  @media (max-width: 720px) {
    header { flex-direction: column; align-items: flex-start; gap: 0.75rem; }
    nav.book { margin-left: 0; }
  }
</style>

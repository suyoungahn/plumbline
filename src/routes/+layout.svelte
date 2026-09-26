<script lang="ts">
  import { base } from '$app/paths';
  import { page } from '$app/state';
  import '../app.css';
  import { onMount } from 'svelte';
  import { restore } from '$lib/state.svelte';

  let { children } = $props();

  const stages = [
    { href: '/plan', label: 'Plan', n: 1 },
    { href: '/today', label: 'Today', n: 2 },
    { href: '/clients', label: 'Clients', n: 3 },
    { href: '/reporting', label: 'Reporting', n: 4 },
    { href: '/jev', label: 'Decision log', n: 5 }
  ];

  const current = $derived(page.url.pathname);

  const onStage = (href: string) => {
    const full = `${base}${href}`;
    return current === full || current.startsWith(full + '/');
  };

  onMount(restore);
</script>

<div class="shell">
  <header>
    <div class="brand">
      <span class="mark" aria-hidden="true"></span>
      <div>
        <strong>Plumbline</strong>
        <span class="sub">Northfield Media · Retail Media, Italy</span>
      </div>
    </div>

    <nav aria-label="Campaign lifecycle">
      {#each stages as s (s.href)}
        <a href={`${base}${s.href}`} class:active={onStage(s.href)} aria-current={onStage(s.href) ? 'page' : undefined}>
          <span class="n">{s.n}</span>{s.label}
        </a>
      {/each}
    </nav>
  </header>

  <main>{@render children()}</main>
</div>

<style>
  .shell { min-height: 100dvh; display: flex; flex-direction: column; }

  header {
    display: flex; align-items: center; gap: 2rem;
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

  nav { display: flex; gap: 0.25rem; }
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
    nav { flex-wrap: wrap; }
  }
</style>

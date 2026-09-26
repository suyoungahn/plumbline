<script lang="ts">
  import { base } from '$app/paths';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  onMount(() => { goto(`${base}/today`, { replaceState: true }); });
</script>

<div class="page"><p style="color:var(--text-muted)">Opening today’s queue…</p></div>

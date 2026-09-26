<script lang="ts">
  // Renders **bold** runs in report text without injecting HTML.
  let { text }: { text: string } = $props();
  const parts = $derived(text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean));
</script>

{#each parts as p, i (i)}{#if p.startsWith('**') && p.endsWith('**')}<strong>{p.slice(2, -2)}</strong>{:else}{p}{/if}{/each}

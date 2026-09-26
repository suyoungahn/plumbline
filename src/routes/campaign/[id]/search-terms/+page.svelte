<script lang="ts">
  import { page } from '$app/state';
  import SearchTerms from '$lib/components/SearchTerms.svelte';
</script>

<SearchTerms campaignId={page.params.id} />

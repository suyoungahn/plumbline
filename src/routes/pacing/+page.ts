import { redirect } from '@sveltejs/kit';
import { base } from '$app/paths';
import { SAMPLE_ID } from '$lib/mediaplan/store.svelte';

// The campaign flow now lives inside each campaign's workspace.
export const load = () => {
  redirect(307, `${base}/campaign/${SAMPLE_ID}/pacing`);
};

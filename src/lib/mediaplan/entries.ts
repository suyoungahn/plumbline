import { CAMPAIGNS, FEATURED } from '$lib/scenario/campaigns';
import { SAMPLE_ID } from './store.svelte';

// Every campaign workspace page is prerendered for each campaign in the book.
export const campaignEntries = () => [{ id: SAMPLE_ID }, ...CAMPAIGNS.map((c) => ({ id: c.id }))];

// Search terms exist only for the featured campaigns.
export const searchTermEntries = () => FEATURED.map((c) => ({ id: c.id }));

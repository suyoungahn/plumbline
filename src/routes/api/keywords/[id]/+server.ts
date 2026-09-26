import { STATIC_BUILD } from '$lib/build-target';

export const prerender = STATIC_BUILD;

import { json } from '@sveltejs/kit';
import { keywordsReport } from '$lib/server/keywords';
import { FEATURED } from '$lib/scenario/campaigns';
import type { RequestHandler } from './$types';

export const entries = () => FEATURED.map((c) => ({ id: c.id }));

export const GET: RequestHandler = async ({ params }) => json(await keywordsReport(params.id));

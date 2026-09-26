import { STATIC_BUILD } from '$lib/build-target';

export const prerender = STATIC_BUILD;

import { json } from '@sveltejs/kit';
import { keywordsReport } from '$lib/server/keywords';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => json(await keywordsReport());

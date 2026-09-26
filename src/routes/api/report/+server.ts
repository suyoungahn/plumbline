import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { json } from '@sveltejs/kit';
import { LEVERS, SEVERITY_MAX, type LedgerEntry } from '$lib/domain';
import { ADVERTISER, POLICY, TICKS } from '$lib/scenario/nuvola';
import { resolveMode } from '$lib/server/jev';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = env.NARRATE_MODEL ?? 'anthropic/claude-sonnet-5';
const FIXTURE_DIR = join(process.cwd(), 'fixtures', 'report');

export const POST: RequestHandler = async ({ request }) => {
  const { ledger } = (await request.json()) as { ledger: LedgerEntry[] };
  const first = TICKS[0];
  const last = TICKS[TICKS.length - 1];

  const facts = ledger
    .map((e) => {
      const tick = TICKS.find((t) => t.day === e.proposal.day);
      const who = e.ruledBy === 'threshold' ? 'executed automatically' : `${e.ruling} by the operator`;
      return `Day ${e.proposal.day}: ${LEVERS[e.proposal.lever].label}, ${who}. Severity ${e.proposal.severity.toFixed(1)} of ${SEVERITY_MAX}, CPA at the time CA$${tick?.cpaEur.toFixed(2)}.`;
    })
    .join('\n');

  const mode = resolveMode();
  const key = env.OPENROUTER_API_KEY;

  if (mode === 'sim' || !key) {
    return json({
      generated: false,
      text: [
        `${ADVERTISER.brand} ${ADVERTISER.market}, days 9 to ${last.day}.`,
        ``,
        `CPA moved from CA$${first.cpaEur.toFixed(2)} to CA$${last.cpaEur.toFixed(2)} against a CA$${POLICY.targetCpaEur.toFixed(2)} target. ${ledger.length} decisions were recorded over the period.`,
        ``,
        facts || 'No decisions were ruled on in this run.',
        ``,
        `Every line above is a ledger entry, not a reconstruction.`
      ].join('\n'),
      facts
    });
  }

  const prompt = [
    `Write a short client update for ${ADVERTISER.brand}, a Canadian dairy brand from Agropur, from their media agency.`,
    `Objective: ${POLICY.objective}. Target CPA CA$${POLICY.targetCpaEur}.`,
    `CPA moved from CA$${first.cpaEur.toFixed(2)} on day ${first.day} to CA$${last.cpaEur.toFixed(2)} on day ${last.day}.`,
    ``,
    `Decision record:`,
    facts,
    ``,
    `Three short paragraphs. State what happened, what was decided and by whom (a human operator or an automatic threshold), and what is being watched next. Do not invent any number that is not above. Do not use em dashes. Write plainly, as an experienced account director would.`
  ].join('\n');

  const name = createHash('sha256').update(`${MODEL}|${prompt}`).digest('hex').slice(0, 16);
  const path = join(FIXTURE_DIR, `${name}.txt`);

  if (mode === 'replay') {
    try {
      return json({ generated: true, text: await readFile(path, 'utf8'), facts, replayed: true });
    } catch {
    }
  }

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 500, messages: [{ role: 'user', content: prompt }] })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    const text: string = j?.choices?.[0]?.message?.content?.trim() ?? '';
    if (text) {
      await mkdir(FIXTURE_DIR, { recursive: true });
      await writeFile(path, text);
    }
    return json({ generated: true, text, facts, replayed: false });
  } catch (e) {
    console.error("[report] generation failed:", e);
    return json({ generated: false, text: facts, facts });
  }
};

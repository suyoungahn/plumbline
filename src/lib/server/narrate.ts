import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { LEVERS, SEVERITY_MAX, severityLabel, type Policy, type Proposal, type Tick } from '$lib/domain';
import { env } from '$env/dynamic/private';

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

function sanitize(text: string): string {
  return text
    .replace(/^\s*\*\*[^*]+\*\*:?\s*/i, '')
    .replace(/^\s*(rationale|note)\s*:\s*/i, '')
    .replace(/\s*\u2014\s*/g, ', ')
    .replace(/\s*\u2013\s*/g, ' to ')
    .replace(/\n{2,}/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

const FIXTURE_DIR = join(process.cwd(), 'fixtures', 'narrate');

const MODEL = env.NARRATE_MODEL ?? 'anthropic/claude-haiku-4.5';

export async function narrate(
  policy: Policy,
  tick: Tick,
  proposal: Proposal,
  mode: 'live' | 'replay' | 'sim' = 'replay',
  fixture?: string
): Promise<string | undefined> {
  const target = tick.lineItems.find((l) => l.id === proposal.targetLineItemId);

  const shared = [
    `Campaign objective: ${policy.objective}`,
    `Target CPA: USD ${policy.targetCpaEur}. Pacing tolerance: ${policy.pacingTolerance.join(' to ')}.`,
    `Day ${tick.day} of ${policy.flightDays}. Budget USD ${tick.budgetEur.toLocaleString()}. Spend USD ${tick.spendToDateEur.toLocaleString()}. Pacing index ${tick.pacingIndex}. CPA USD ${tick.cpaEur}.`,
    '',
    'Line items:',
    ...tick.lineItems.map(
      (l) =>
        `- ${l.platform} / ${l.audience} / ${l.placement}: ${Math.round(l.shareOfSpend * 100)} percent of spend, CPA USD ${l.cpaEur}, CTR ${(l.ctr * 100).toFixed(2)} percent, headroom ${l.headroom}, bid vs CPA-justified ${l.bidVsJustified}${l.note ? `. ${l.note}` : ''}`
    ),
    ''
  ];

  const prompt = proposal.gateOpen
    ? [
        ...shared,
        `A decision model has selected the lever "${LEVERS[proposal.lever].label}" (${LEVERS[proposal.lever].meaning})${target ? `, acting on ${target.platform} / ${target.audience}` : ''}. It rated intervention necessity at ${(proposal.gateProbability * 100).toFixed(0)} percent, and severity at ${proposal.severity.toFixed(1)} on a 0 to ${SEVERITY_MAX} scale where ${SEVERITY_MAX} is the most severe, which reads as: ${severityLabel(proposal.severity)}.`,
        `Its confidence in the lever choice is ${(proposal.leverConfidence * 100).toFixed(0)} percent.`,
        '',
        'Write the rationale an agency operator would read before ruling on this. Two sentences maximum. State the specific evidence in the numbers above that justifies this lever, and name the one thing that could make it the wrong call. Do not restate the lever name. Do not use em dashes.'
      ].join('\n')
    : [
        ...shared,
        `A decision model was asked whether this campaign needs operator intervention right now and answered ${(proposal.gateProbability * 100).toFixed(0)} percent, which is below the 50 percent bar, so NOTHING is being proposed and nothing enters the operator queue. It rated severity at ${proposal.severity.toFixed(1)} on a 0 to ${SEVERITY_MAX} scale, which reads as: ${severityLabel(proposal.severity)}.`,
        '',
        'Write the note an agency operator would read explaining why nothing was raised. Two sentences maximum. State the specific evidence in the numbers above that shows the campaign is inside its tolerances, and name the one thing that would change that. Do not recommend an action. Do not use em dashes.'
      ].join('\n');

  const name = fixture ?? createHash('sha256').update(`${MODEL}|${prompt}`).digest('hex').slice(0, 16);
  const path = join(FIXTURE_DIR, `${name}.txt`);

  if (mode === 'sim') return undefined;

  if (mode === 'replay') {
    try {
      return await readFile(path, 'utf8');
    } catch {
    }
  }

  const key = env.OPENROUTER_API_KEY;
  if (!key) return undefined;

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    if (!res.ok) {
      console.error("[narrate] HTTP", res.status, (await res.text()).slice(0, 300));
      return undefined;
    }
    const json = await res.json();
    const raw: string | undefined = json?.choices?.[0]?.message?.content?.trim();
    if (!raw) return undefined;
    const text = sanitize(raw);
    await mkdir(FIXTURE_DIR, { recursive: true });
    await writeFile(path, text);
    return text;
  } catch (e) {
    console.error("[narrate] failed:", e);
    return undefined;
  }
}

import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { simulate } from '$lib/heuristic';
import { FIXTURES } from './fixtures';
import type { JevAnswer, JevQuestion, JevResult, JevUsage } from '$lib/jev-types';
import { env } from '$env/dynamic/private';

const ENDPOINT = 'https://openrouter.ai/api/alpha/decisions';
const FIXTURE_DIR = join(process.cwd(), 'fixtures', 'jev');

export type JevMode = 'live' | 'replay' | 'sim';

export type JevEnvelope = {
  recordedAt: string;

  latencyMs: number;

  request: unknown;

  response: Record<string, unknown>;
};

export type AskOptions = {
  mode?: JevMode;

  fixture?: string;
};

function requestKey(body: unknown, fixture?: string): string {
  if (fixture) return fixture;
  return createHash('sha256').update(JSON.stringify(body)).digest('hex').slice(0, 16);
}

function normalizeAnswer(key: string, raw: Record<string, unknown>): JevAnswer {
  const type = raw.type;

  if (type === 'noul') {
    const p = raw.noul ?? raw.probability;
    if (typeof p !== 'number') throw new Error(`Jev: no noul probability on "${key}"`);
    return { type: 'noul', probability: p };
  }

  if (type === 'choice') {
    const probabilities = raw.probabilities as Record<string, number> | undefined;
    if (!probabilities) throw new Error(`Jev: no choice distribution on "${key}"`);
    const selected =
      (raw.choice as string) ??
      (raw.selected as string) ??
      Object.entries(probabilities).sort((a, b) => b[1] - a[1])[0][0];
    return {
      type: 'choice',
      selected,
      probabilities,
      confidence: (raw.confidence as number) ?? 0
    };
  }

  if (type === 'score') {
    const score = raw.score as number | undefined;
    if (typeof score !== 'number') throw new Error(`Jev: no score on "${key}"`);
    return {
      type: 'score',
      score,
      probabilities: (raw.probabilities as Record<string, number>) ?? {},
      confidence: (raw.confidence as number) ?? 0,
      legend: raw.legend as Record<string, string> | undefined
    };
  }

  throw new Error(`Jev: unknown answer type "${String(type)}" on "${key}"`);
}

function normalizeUsage(raw: Record<string, unknown> | undefined): JevUsage {
  return {
    inputTokens: (raw?.input_tokens as number) ?? 0,
    outputTokens: (raw?.output_tokens as number) ?? 0,
    cost: (raw?.cost as number) ?? 0
  };
}

function unwrap(raw: Record<string, unknown>): {
  response: Record<string, unknown>;
  latencyMs: number;
  recordedAt: string | null;
} {
  if (raw.response && typeof raw.response === 'object') {
    return {
      response: raw.response as Record<string, unknown>,
      latencyMs: (raw.latencyMs as number) ?? 0,
      recordedAt: (raw.recordedAt as string) ?? null
    };
  }
  return { response: raw, latencyMs: 0, recordedAt: null };
}

function normalize(
  payload: Record<string, unknown>,
  flags: { replayed: boolean; simulated: boolean }
): JevResult {
  const { response, latencyMs, recordedAt } = unwrap(payload);
  const rawAnswers = (response.answers ?? {}) as Record<string, Record<string, unknown>>;
  const answers: Record<string, JevAnswer> = {};
  for (const [key, value] of Object.entries(rawAnswers)) {
    answers[key] = normalizeAnswer(key, value);
  }
  return {
    answers,
    usage: normalizeUsage(response.usage as Record<string, unknown> | undefined),
    model: (response.model as string) ?? 'unknown',
    latencyMs,
    recordedAt,
    ...flags
  };
}

export function resolveMode(explicit?: JevMode): JevMode {
  if (explicit) return explicit;
  const fromEnv = env.JEV_MODE as JevMode | undefined;
  if (fromEnv) return fromEnv;
  return 'replay';
}

export async function askJev(
  state: unknown,
  questions: Record<string, JevQuestion>,
  options: AskOptions = {}
): Promise<JevResult> {
  const model = env.JEV_MODEL ?? 'typesafe/jev-1.13';
  const body = { model, state, questions };
  const name = requestKey(body, options.fixture);
  const path = join(FIXTURE_DIR, `${name}.json`);
  const mode = resolveMode(options.mode);

  if (mode === 'sim') {
    const payload = simulate(state, questions);
    return normalize(payload as unknown as Record<string, unknown>, {
      replayed: false,
      simulated: true
    });
  }

  if (mode === 'replay') {
    if (FIXTURES[name]) return normalize(FIXTURES[name], { replayed: true, simulated: false });
    try {
      return normalize(JSON.parse(await readFile(path, 'utf8')), {
        replayed: true,
        simulated: false
      });
    } catch {
    }
  }

  const key = env.OPENROUTER_API_KEY;
  if (!key) {
    const payload = simulate(state, questions);
    return normalize(payload as unknown as Record<string, unknown>, {
      replayed: false,
      simulated: true
    });
  }

  const startedAt = Date.now();
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const text = await res.text();
  const latencyMs = Date.now() - startedAt;
  if (!res.ok) throw new Error(`Jev ${res.status}: ${text.slice(0, 400)}`);

  const envelope: JevEnvelope = {
    recordedAt: new Date().toISOString(),
    latencyMs,
    request: body,
    response: JSON.parse(text)
  };

  await mkdir(FIXTURE_DIR, { recursive: true });
  await writeFile(path, JSON.stringify(envelope, null, 2));

  return normalize(envelope as unknown as Record<string, unknown>, { replayed: false, simulated: false });
}

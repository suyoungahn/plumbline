import { STATIC_BUILD } from '$lib/build-target';

export const prerender = STATIC_BUILD;

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { json } from '@sveltejs/kit';
import { simulate } from '$lib/heuristic';
import { FIXTURES } from '$lib/server/fixtures';
import { GATE_THRESHOLD } from '$lib/domain';
import type { JevQuestion } from '$lib/jev-types';
import type { RequestHandler } from './$types';

const DIR = join(process.cwd(), 'fixtures', 'jev');

export const GET: RequestHandler = () => {
  // Bundled recordings, plus any recorded live since the build (when running locally).
  const onDisk = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith('.json')) : [];
  const names = [...new Set([...Object.keys(FIXTURES).map((n) => `${n}.json`), ...onDisk])];
  if (!names.length) return json({ calls: [], aggregate: null });

  const calls = names
    .map((f) => {
      const raw: any = FIXTURES[f.replace(/\.json$/, '')] ?? JSON.parse(readFileSync(join(DIR, f), 'utf8'));
      const envelope = raw.response ? raw : { request: null, response: raw, latencyMs: 0, recordedAt: null };
      const req = envelope.request as { model?: string; state?: unknown; questions?: Record<string, JevQuestion> } | null;
      const res = envelope.response as Record<string, any>;

      const gate = res.answers?.gate;
      const lever = res.answers?.lever;
      const severity = res.answers?.severity;

      let baseline: { lever: string; confidence: number; gate: number } | null = null;
      if (req?.state && req?.questions) {
        const sim = simulate(req.state, req.questions);
        const bLever = sim.answers.lever as Record<string, any> | undefined;
        const bGate = sim.answers.gate as Record<string, any> | undefined;
        baseline = {
          lever: (bLever?.choice as string) ?? 'n/a',
          confidence: (bLever?.confidence as number) ?? 0,
          gate: (bGate?.noul as number) ?? 0
        };
      }

      const jevLever = (lever?.choice as string) ?? null;
      const jevConf = (lever?.confidence as number) ?? 0;
      const jevGate = (gate?.noul as number) ?? 0;

      return {
        id: f.replace(/\.json$/, ''),
        recordedAt: envelope.recordedAt,
        latencyMs: envelope.latencyMs,
        model: res.model ?? null,
        provider: res.provider ?? null,
        usage: res.usage ?? null,

        questions: req?.questions
          ? Object.entries(req.questions).map(([key, q]) => ({
              key,
              type: q.type,
              instructions: q.instructions,
              optionCount: q.type === 'choice' ? Object.keys(q.criteria).length : q.type === 'score' ? q.criteria.length : 2
            }))
          : [],
        stateFieldCount: req?.state && typeof req.state === 'object' ? Object.keys(req.state as object).length : 0,
        state: req?.state ?? null,

        answers: res.answers ?? null,
        gate: jevGate,
        gateOpen: jevGate >= GATE_THRESHOLD,
        lever: jevLever,
        leverConfidence: jevConf,
        severity: (severity?.score as number) ?? null,
        severityConfidence: (severity?.confidence as number) ?? 0,
        baseline,

        leverDiffers: baseline ? baseline.lever !== jevLever : null,
        gateDiffers: baseline ? baseline.gate >= GATE_THRESHOLD !== (jevGate >= GATE_THRESHOLD) : null
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  const withBaseline = calls.filter((c) => c.baseline);
  const conf = calls.map((c) => c.leverConfidence).filter((n) => n > 0);
  const lat = calls.map((c) => c.latencyMs).filter((n) => n > 0);
  const median = (xs: number[]) => {
    if (xs.length === 0) return 0;
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };

  const buckets = [0, 0.2, 0.4, 0.6, 0.8].map((lo, i, arr) => {
    const hi = i === arr.length - 1 ? 1.01 : arr[i + 1];
    return { label: `${(lo * 100).toFixed(0)}-${(Math.min(hi, 1) * 100).toFixed(0)}%`, lo, hi, n: conf.filter((c) => c >= lo && c < hi).length };
  });

  const rulesWouldHaveActed = withBaseline.filter(
    (c) => c.baseline!.confidence >= 0.8 && c.leverConfidence < 0.5
  );

  return json({
    calls,
    aggregate: {
      calls: calls.length,
      totalCostUsd: Number(calls.reduce((s, c) => s + (c.usage?.cost ?? 0), 0).toFixed(6)),
      meanCostUsd: calls.length ? Number((calls.reduce((s, c) => s + (c.usage?.cost ?? 0), 0) / calls.length).toFixed(7)) : 0,
      totalInputTokens: calls.reduce((s, c) => s + (c.usage?.input_tokens ?? 0), 0),
      medianLatencyMs: median(lat),
      maxLatencyMs: lat.length ? Math.max(...lat) : 0,
      gateOpen: calls.filter((c) => c.gateOpen).length,
      gateShut: calls.filter((c) => !c.gateOpen).length,
      questionsPerCall: calls[0]?.questions.length ?? 0,
      confidence: {
        min: conf.length ? Number(Math.min(...conf).toFixed(2)) : 0,
        max: conf.length ? Number(Math.max(...conf).toFixed(2)) : 0,
        median: Number(median(conf).toFixed(2)),
        buckets
      },
      baseline: {
        compared: withBaseline.length,
        leverDisagreements: withBaseline.filter((c) => c.leverDiffers).length,
        gateDisagreements: withBaseline.filter((c) => c.gateDiffers).length,
        rulesWouldHaveActedAlone: rulesWouldHaveActed.length,
        examples: rulesWouldHaveActed.slice(0, 4).map((c) => ({
          id: c.id,
          jevLever: c.lever,
          jevConfidence: c.leverConfidence,
          rulesLever: c.baseline!.lever,
          rulesConfidence: c.baseline!.confidence
        }))
      }
    }
  });
};

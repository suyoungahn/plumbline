import { STATIC_BUILD } from '$lib/build-target';

export const prerender = STATIC_BUILD;

import { json } from '@sveltejs/kit';
import { POLICY, TICKS } from '$lib/scenario/nuvola';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => {
  const rows = TICKS.map((t) => {
    const sharesSum = t.lineItems.reduce((s, l) => s + l.shareOfSpend, 0);
    const derivedConversions = t.lineItems.reduce(
      (s, l) => s + (t.spendToDateEur * l.shareOfSpend) / l.cpaEur,
      0
    );
    const derivedCpa = t.spendToDateEur / derivedConversions;
    const evenPace = (t.budgetEur / POLICY.flightDays) * t.day;
    const derivedPacing = t.spendToDateEur / evenPace;

    const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

    return {
      day: t.day,
      shares_sum: Number(sharesSum.toFixed(4)),
      shares_ok: near(sharesSum, 1, 0.005),
      stated_cpa: t.cpaEur,
      derived_cpa: Number(derivedCpa.toFixed(2)),
      cpa_ok: near(derivedCpa, t.cpaEur, 0.15),
      stated_conversions: t.conversions,
      derived_conversions: Math.round(derivedConversions),
      conversions_ok: near(derivedConversions, t.conversions, Math.max(25, t.conversions * 0.01)),
      stated_pacing: t.pacingIndex,
      derived_pacing: Number(derivedPacing.toFixed(3)),
      pacing_ok: near(derivedPacing, t.pacingIndex, 0.01)
    };
  });

  const failures = rows.filter(
    (r) => !r.shares_ok || !r.cpa_ok || !r.conversions_ok || !r.pacing_ok
  );
  return json({ ok: failures.length === 0, failures: failures.map((f) => f.day), rows });
};

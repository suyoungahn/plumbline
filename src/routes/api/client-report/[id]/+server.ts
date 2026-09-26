import { STATIC_BUILD } from '$lib/build-target';

export const prerender = STATIC_BUILD;

import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { decideCampaign } from '$lib/server/decide-campaign';
import { CAMPAIGNS, campaignById, metrics } from '$lib/scenario/campaigns';
import { CLIENTS, MANAGER, type ClientId } from '$lib/portfolio';
import { SURFACES, type SurfaceId } from '$lib/placements';
import { LEVERS, severityLabel, type LeverId } from '$lib/domain';
import { resolveMode } from '$lib/server/jev';
import type { RequestHandler } from './$types';

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = env.NARRATE_MODEL ?? 'anthropic/claude-haiku-4.5';

const eur = (n: number) => `USD ${n.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;

export const entries = () => CAMPAIGNS.map((c) => ({ id: c.id }));

export const GET: RequestHandler = async ({ params }) => {
  const c = campaignById(params.id);
  if (!c) throw error(404, `No campaign ${params.id}`);

  const m = metrics(c);
  const p = await decideCampaign(c);
  const client = CLIENTS[c.clientId as ClientId];

  const facts = [
    `Campaign: ${c.name} for ${client.name}, day ${c.day} of ${c.flightDays}.`,
    `Objective: ${c.objective}.`,
    `Delivered ${eur(m.delivered)} of a ${eur(c.budgetEur)} budget, ${m.conversions.toLocaleString()} conversions.`,
    `Blended cost per acquisition ${m.cpa.toFixed(2)} against a target of ${c.targetCpaEur.toFixed(2)}, ${m.cpaVsTargetPct} percent.`,
    `Pacing index ${m.pacing.toFixed(2)}.`,
    m.underfillEur > 0
      ? `${eur(m.underfillEur)} of the plan could not be delivered because onsite inventory was not available.`
      : `All allocated budget was delivered.`,
    m.spendAtRisk > 0 ? `${eur(m.spendAtRisk)} of delivered spend sits on placements above target cost per acquisition.` : '',
    p.gateOpen
      ? `Current action: ${LEVERS[p.lever as LeverId].label}${p.targetSurface ? ` on ${SURFACES[p.targetSurface as SurfaceId].label}` : ''}. Severity ${severityLabel(p.severity)}.`
      : `No intervention is required. The campaign is inside its tolerances.`
  ]
    .filter(Boolean)
    .join('\n');

  let summary: string | null = null;
  let generated = false;
  if (resolveMode() !== 'sim' && env.OPENROUTER_API_KEY) {
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 180,
          messages: [
            {
              role: 'user',
              content: `Write two short paragraphs for an advertiser, from their media agency, summarising this campaign mid-flight. Use only the facts below and invent nothing. Be plain and direct, as an experienced account director would write. No em dashes, no markdown headings, no preamble.\n\n${facts}`
            }
          ]
        })
      });
      if (res.ok) {
        const j = await res.json();
        const raw: string | undefined = j?.choices?.[0]?.message?.content?.trim();
        if (raw) {
          summary = raw
            .replace(/^\s*\*\*[^*]+\*\*:?\s*/i, '')
            .replace(/\s*—\s*/g, ', ')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
          generated = true;
        }
      }
    } catch {
    }
  }

  const lines = c.lines.map((l) => ({
    placement: `${SURFACES[l.surface as SurfaceId].label}${l.retailer ? ` · ${l.retailer}` : ''}`,
    audience: l.audience,
    allocated: l.allocatedEur,
    delivered: l.deliveredEur,
    fillRate: Number((l.deliveredEur / l.allocatedEur).toFixed(3)),
    cpa: l.cpaEur,
    vsTarget: Number((((l.cpaEur - c.targetCpaEur) / c.targetCpaEur) * 100).toFixed(1))
  }));

  const markdown = [
    `# ${client.name} · ${c.name}`,
    ``,
    `**${MANAGER.agency}** · day ${c.day} of ${c.flightDays} · generated ${new Date().toISOString().slice(0, 10)}`,
    ``,
    summary ?? `Delivered ${eur(m.delivered)} of ${eur(c.budgetEur)} at a blended cost per acquisition of ${m.cpa.toFixed(2)} against a ${c.targetCpaEur.toFixed(2)} target.`,
    ``,
    `## Performance`,
    ``,
    `| | |`,
    `|---|---|`,
    `| Budget | ${eur(c.budgetEur)} |`,
    `| Delivered | ${eur(m.delivered)} |`,
    `| Conversions | ${m.conversions.toLocaleString()} |`,
    `| Cost per acquisition | ${m.cpa.toFixed(2)} (target ${c.targetCpaEur.toFixed(2)}, ${m.cpaVsTargetPct}%) |`,
    `| Pacing index | ${m.pacing.toFixed(2)} |`,
    m.underfillEur > 0 ? `| Undeliverable | ${eur(m.underfillEur)} |` : '',
    ``,
    `## By placement`,
    ``,
    `| Placement | Audience | Allocated | Delivered | Fill | CPA | vs target |`,
    `|---|---|---|---|---|---|---|`,
    ...lines.map(
      (l) =>
        `| ${l.placement} | ${l.audience} | ${eur(l.allocated)} | ${eur(l.delivered)} | ${(l.fillRate * 100).toFixed(0)}% | ${l.cpa.toFixed(2)} | ${l.vsTarget > 0 ? '+' : ''}${l.vsTarget}% |`
    ),
    ``,
    `## What we did, and why`,
    ``,
    p.gateOpen
      ? `**${LEVERS[p.lever as LeverId].label}**${p.targetSurface ? ` on ${SURFACES[p.targetSurface as SurfaceId].label}` : ''}. ${LEVERS[p.lever as LeverId].meaning}.`
      : `**No intervention.** The campaign is inside its tolerances on cost, pacing and delivery.`,
    ``,
    `The decision was evaluated automatically with a confidence of ${(p.leverConfidence * 100).toFixed(0)} percent and a severity of ${p.severity.toFixed(1)} out of 4 (${severityLabel(p.severity)}). ${p.gateOpen ? 'It was reviewed by a person before being applied.' : 'Nothing was raised for review.'}`,
    ``,
    `---`,
    ``,
    `*Every figure above comes from the decision record, written at the time each decision was taken. Illustrative scenario, not real campaign data.*`
  ]
    .filter((x) => x !== '')
    .join('\n');

  return json({
    campaign: { id: c.id, name: c.name, client: client.name },
    metrics: m,
    lines,
    decision: {
      gateOpen: p.gateOpen,
      lever: p.lever,
      leverLabel: LEVERS[p.lever as LeverId].label,
      confidence: p.leverConfidence,
      severity: p.severity,
      severityLabel: severityLabel(p.severity)
    },
    summary,
    generated,
    facts,
    markdown
  });
};

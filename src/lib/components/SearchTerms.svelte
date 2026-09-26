<script lang="ts">
  import { base } from '$app/paths';
  import DistributionBars from '$lib/components/DistributionBars.svelte';
  import { decisionCost, money, dollars } from '$lib/money';
  import { MANAGER, type ClientId } from '$lib/portfolio';
  import { TERM_ACTIONS, TERM_QUESTIONS, type SearchTerm, type TermActionId, type TermDecision } from '$lib/keywords';
  import { LEXICON } from '$lib/scenario/search-terms';
  import { records } from '$lib/mediaplan/store.svelte';
  import { band, remove, termKey, upsert } from '$lib/mediaplan/decisions';

  type Row = {
    term: SearchTerm;
    campaign: { id: string; clientId: ClientId; name: string; client: string; targetCpaEur: number };
    decision: TermDecision;
  };
  type Group = { action: TermActionId; count: number; spendEur: number; conversions: number; examples: Row[] };

  let queue = $state<Row[]>([]);
  let groups = $state<Group[]>([]);
  let summary = $state<Record<string, any> | null>(null);
  let loading = $state(true);

  // Pass a campaign id to show one campaign's terms; leave it out for the whole book.
  let { campaignId }: { campaignId?: string } = $props();

  $effect(() => {
    const url = campaignId ? `${base}/api/keywords/${campaignId}` : `${base}/api/keywords/all`;
    loading = true;
    fetch(url)
      .then((res) => res.json())
      .then((j) => {
        queue = j.queue;
        groups = j.groups;
        summary = j.summary;
      })
      .finally(() => (loading = false));
  });

  const possessive = (name: string) => (name.endsWith('s') ? `${name}'` : `${name}'s`);
  const cpa = (t: SearchTerm) => (t.conversions > 0 ? t.spendEur / t.conversions : null);

  function why(r: Row): string {
    const lex = LEXICON[r.campaign.clientId]!;
    const lower = r.term.term.toLowerCase();
    if (lex.brandSafety.some((b) => lower.includes(b)))
      return `On ${possessive(r.campaign.client)} brand-safety list. Stopping it is almost certainly right, but a person confirms and tells the client.`;
    if (lex.competitorBrands.some((b) => lower.includes(b)))
      return 'Names a competitor or a retailer private-label brand. Whether to bid on it is the client\'s call, and some retailers restrict it.';
    if (r.term.conversions === 0)
      return `${dollars(r.term.spendEur)} spent and nothing sold on a term that looks relevant. Enough money that a person checks before it is cut.`;
    return 'Material spend sitting right at target CPA. Jev is split between the options, so it asks instead of guessing.';
  }

  // Rulings live in each campaign's decision record, so they survive a reload and
  // feed that campaign's weekly report.
  const rulingFor = (r: Row) => records[r.campaign.id]?.decisions.find((d) => d.key === termKey(r.term.id));
  const remaining = $derived(queue.filter((r) => !rulingFor(r)).length);

  function rule(r: Row, ruling: 'approved' | 'overruled') {
    const rec = records[r.campaign.id];
    if (!rec) return;
    upsert(rec.decisions, {
      key: termKey(r.term.id),
      date: rec.pacing.dataThrough,
      kind: 'search_term',
      subject: `"${r.term.term}" on ${r.term.retailer}`,
      action: TERM_ACTIONS[r.decision.action].label,
      why: why(r),
      gate: r.decision.gateProbability,
      confidence: r.decision.confidence,
      source: r.decision.source === 'sim' ? 'stand_in' : r.decision.source === 'replay' ? 'jev_recorded' : 'jev',
      ruling,
      ruledBy: 'manager'
    });
  }
  const pct = (n: number) => `${(n * 100).toFixed(0)}%`;
</script>

<div class="page">
  <header class="top">
    <div>
      <span class="eyebrow">Retail search · onsite and in-app · last 14 days</span>
      {#if campaignId}<h2 class="tab-title">Search terms</h2>{:else}<h1>Search terms, all campaigns</h1>{/if}
      <p class="lede">
        Every search a shopper typed that showed one of our ads. Checking these by hand is one of the
        most time-consuming jobs in retail media. Here every term goes through the same three typed
        questions, and only the exceptions reach {MANAGER.name}.
      </p>
    </div>
    <p class="disclaimer">Illustrative scenario. Not real search data.</p>
  </header>

  {#if loading}
    <p class="muted">Evaluating the search-term report…</p>
  {:else if summary}
    <section class="hero">
      <div class="ratio">
        <div class="big">
          <strong>{summary.needsHuman}</strong>
          <span>need you</span>
        </div>
        <div class="vs">of {summary.terms.toLocaleString()}</div>
        <div class="big quiet">
          <strong>{(summary.autoApplied + summary.leftAlone).toLocaleString()}</strong>
          <span>handled without you</span>
        </div>
      </div>
      <dl class="figures">
        <div><dt>Spend evaluated</dt><dd>{money(summary.spendEvaluated)}</dd></div>
        <div><dt>Changes applied</dt><dd>{summary.autoApplied}</dd></div>
        <div><dt>Wasted spend stopped</dt><dd class="good">{money(summary.wastedStopped)}</dd></div>
        <div><dt>Cost to decide</dt><dd>{decisionCost(summary.decisionCostUsd)}{summary.costEstimated ? '*' : ''}</dd></div>
      </dl>
    </section>

    <p class="claim">
      {summary.terms.toLocaleString()} search terms across {summary.campaigns} {summary.campaigns === 1 ? 'campaign' : 'campaigns'}, including
      {summary.frenchTerms} French searches from Quebec shoppers, were evaluated for
      <strong>{decisionCost(summary.decisionCostUsd)}</strong>. {summary.autoApplied} changes went through on
      their own, {summary.leftAlone} terms were left alone for lack of data, and {MANAGER.name} reads
      {summary.needsHuman}.
      {#if summary.source !== 'replay' && summary.source !== 'live'}
        <span class="badge sim">Heuristic stand-in, not Jev</span>
      {/if}
    </p>
    {#if summary.costEstimated}
      <p class="muted small">
        * No search-term decisions have been recorded from Jev yet, so these come from the local
        heuristic, and the cost is estimated at Jev's per-call price. Run with
        <code>JEV_MODE=live</code> to record the real ones.
      </p>
    {/if}

    <h2 class="section-head">Needs a decision <span class="count">{remaining} left</span></h2>
    <ul class="queue">
      {#each queue as r (r.term.id)}
        {@const c = cpa(r.term)}
        {@const b = band(r.decision.confidence)}
        {@const ruled = rulingFor(r)?.ruling}
        <li class="card" data-ruled={ruled ?? ''}>
          <div class="card-top">
            <div>
              <span class="client">{r.campaign.client} · {r.term.retailer}</span>
              <strong class="term">“{r.term.term}”</strong>
              <span class="kw">
                matched {r.term.matchType} keyword <code>{r.term.keyword}</code>
                {#if r.term.language === 'fr-CA'}<span class="fr">fr-CA</span>{/if}
                · <a href={`${base}/campaign/${r.campaign.id}`}>{r.campaign.name}</a>
              </span>
            </div>
            <span class="stake">{dollars(r.term.spendEur)} <small>spent</small></span>
          </div>

          <p class="why">{why(r)}</p>

          <div class="facts">
            <span>{r.term.clicks} clicks</span>
            <span>{r.term.conversions} sales</span>
            <span class:bad={c !== null && c > r.campaign.targetCpaEur}>
              CPA {c === null ? '—' : dollars(c)} vs {dollars(r.campaign.targetCpaEur)}
            </span>
          </div>

          <div class="decide">
            <div class="dist">
              <span class="proposed">
                Proposed: <strong>{TERM_ACTIONS[r.decision.action].label}</strong>
              </span>
              <DistributionBars
                items={Object.entries(r.decision.distribution)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 3)
                  .map(([k, v]) => ({ key: k, label: TERM_ACTIONS[k as TermActionId]?.label ?? k, value: v }))}
                selected={r.decision.action}
              />
            </div>
            <div class="jevline">
              <span class="bandchip" data-b={b.key} title={`${pct(r.decision.gateProbability)} that this needs a person; ${pct(r.decision.confidence)} confidence in the action; severity ${r.decision.severity.toFixed(1)} of 4. ${b.hint}`}>{b.label}</span>
              <span class="jl">{b.hint}</span>
              <span class="jl src">{r.decision.source === 'sim' ? 'Stand-in rules' : 'Jev'}</span>
            </div>
            <div class="btns">
              {#if ruled}
                <span class="ruled">{ruled === 'approved' ? 'Approved' : 'Overruled'}</span>
                <button class="link" onclick={() => remove(records[r.campaign.id].decisions, termKey(r.term.id))}>undo</button>
              {:else}
                <button class="primary" onclick={() => rule(r, 'approved')}>Approve</button>
                <button onclick={() => rule(r, 'overruled')}>Overrule</button>
              {/if}
            </div>
          </div>
        </li>
      {/each}
    </ul>

    <h2 class="section-head">Handled without you</h2>
    <div class="groups">
      {#each groups as g (g.action)}
        <details class="group" data-action={g.action}>
          <summary>
            <span class="gname"><span class="dot" data-action={g.action}></span>{TERM_ACTIONS[g.action].done}</span>
            <span class="gcount">{g.count} terms</span>
            <span class="gspend">{money(g.spendEur)} spend</span>
          </summary>
          <p class="gmeaning">{TERM_ACTIONS[g.action].meaning}.</p>
          <table>
            <thead><tr><th>Search term</th><th>Advertiser</th><th class="r">Clicks</th><th class="r">Spend</th><th class="r">CPA</th><th class="r">Target</th></tr></thead>
            <tbody>
              {#each g.examples as r (r.term.id)}
                {@const c = cpa(r.term)}
                <tr>
                  <td>{r.term.term}{#if r.term.language === 'fr-CA'} <span class="fr">fr-CA</span>{/if}</td>
                  <td class="muted">{r.campaign.client}</td>
                  <td class="r num">{r.term.clicks}</td>
                  <td class="r num">{dollars(r.term.spendEur)}</td>
                  <td class="r num">{c === null ? '—' : dollars(c)}</td>
                  <td class="r num muted">{dollars(r.campaign.targetCpaEur)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
          {#if g.count > g.examples.length}
            <p class="muted small">Top {g.examples.length} by spend. All {g.count} are on the record.</p>
          {/if}
        </details>
      {/each}
    </div>

    <section class="asked">
      <h2 class="section-head">What Jev is asked about every term</h2>
      <ol>
        <li><strong>Does it need a person?</strong> {TERM_QUESTIONS.gate.instructions}</li>
        <li>
          <strong>Which action?</strong> Which single action is right for this search term? It can only pick
          from this list, and cannot invent keywords or write anything:
          <span class="opts">
            {#each Object.values(TERM_ACTIONS) as a (a.label)}<span>{a.label}</span>{/each}
          </span>
        </li>
        <li><strong>How much is at stake?</strong> {TERM_QUESTIONS.severity.instructions}</li>
      </ol>
      <p class="muted small">
        Relevance is judged against each client's own category terms, competitor list and
        brand-safety list, the same way a campaign is judged against its CPA target. Suggesting new
        keywords is a job for a text model. Deciding which ones to keep stays with Jev and the
        campaign manager.
      </p>
    </section>
  {/if}
</div>

<style>
  .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 1.5rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
  .lede { max-width: 78ch; color: var(--text-secondary); font-size: 0.9rem; }
  .disclaimer { font-size: 0.72rem; color: var(--text-muted); margin: 0.3rem 0 0; }

  .hero {
    display: flex; justify-content: space-between; align-items: center; gap: 2rem; flex-wrap: wrap;
    padding: 1.1rem 1.25rem; background: var(--surface-1);
    border: 1px solid var(--border); border-radius: var(--radius);
  }
  .ratio { display: flex; align-items: center; gap: 1.1rem; }
  .big { display: flex; flex-direction: column; }
  .big strong { font-size: 2.4rem; line-height: 1; letter-spacing: -0.03em; color: var(--series-2); font-variant-numeric: tabular-nums; }
  .big.quiet strong { color: var(--good-text); }
  .big span { font-size: 0.76rem; color: var(--text-secondary); margin-top: 0.15rem; }
  .vs { font-size: 0.75rem; color: var(--text-muted); }
  .figures { display: flex; gap: 1.6rem; margin: 0; flex-wrap: wrap; }
  .figures dt { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); }
  .figures dd { margin: 0.1rem 0 0; font-size: 1.05rem; font-variant-numeric: tabular-nums; }
  .figures dd.good { color: var(--good-text); }

  .claim { font-size: 0.88rem; color: var(--text-secondary); max-width: 82ch; margin: 1rem 0 0.4rem; }
  .claim strong { color: var(--text-primary); font-variant-numeric: tabular-nums; }

  .section-head { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-muted); margin: 1.5rem 0 0.6rem; }
  .count { text-transform: none; letter-spacing: 0; font-weight: 500; margin-left: 0.4rem; color: var(--series-2); }

  .queue { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.6rem; }
  .card {
    padding: 0.85rem 1rem; background: var(--surface-1); border: 1px solid var(--border);
    border-left: 3px solid var(--serious); border-radius: var(--radius);
  }
  .card[data-ruled='approved'] { border-left-color: var(--good); opacity: 0.6; }
  .card[data-ruled='overruled'] { border-left-color: var(--text-muted); opacity: 0.6; }
  .card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; }
  .client { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); display: block; }
  .term { font-size: 1.05rem; letter-spacing: -0.01em; display: block; margin: 0.1rem 0; }
  .kw { font-size: 0.74rem; color: var(--text-muted); }
  .kw code { font-size: 0.7rem; background: var(--surface-3); padding: 0.02rem 0.28rem; border-radius: 3px; }
  .stake { font-size: 1.1rem; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .stake small { font-size: 0.66rem; color: var(--text-muted); display: block; text-align: right; }
  .why { font-size: 0.85rem; color: var(--text-secondary); margin: 0.5rem 0; max-width: 92ch; }
  .facts { display: flex; gap: 1rem; flex-wrap: wrap; font-size: 0.76rem; color: var(--text-muted); font-variant-numeric: tabular-nums; }
  .facts .bad { color: var(--serious); }

  .decide { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) auto; gap: 1rem; align-items: end; margin-top: 0.7rem; padding-top: 0.6rem; border-top: 1px solid var(--grid); }
  .proposed { font-size: 0.8rem; display: block; margin-bottom: 0.3rem; }
  .jevline { display: flex; flex-direction: column; gap: 0.2rem; }
  .bandchip { align-self: flex-start; font-size: 0.64rem; font-weight: 700; padding: 0.08rem 0.4rem; border-radius: 20px; cursor: help; }
  .bandchip[data-b='clear'] { background: color-mix(in srgb, var(--good) 16%, transparent); color: var(--good-text); }
  .bandchip[data-b='judgment'] { background: color-mix(in srgb, var(--warning) 24%, transparent); color: var(--text-primary); }
  .bandchip[data-b='unsure'] { background: color-mix(in srgb, var(--serious) 18%, transparent); color: var(--text-primary); }
  .src { font-style: italic; }
  .jl { font-size: 0.73rem; color: var(--text-muted); display: inline-flex; align-items: baseline; gap: 0.3rem; }
  .btns { display: flex; gap: 0.4rem; align-items: center; }
  .ruled { font-size: 0.78rem; font-weight: 600; }
  .link { background: none; border: none; color: var(--series-1); font-size: 0.75rem; padding: 0; cursor: pointer; }

  .fr { font-size: 0.6rem; font-weight: 700; padding: 0.02rem 0.28rem; border-radius: 3px; margin-left: 0.25rem; background: color-mix(in srgb, var(--series-1) 16%, transparent); color: var(--series-1); }

  .groups { display: flex; flex-direction: column; gap: 0.4rem; }
  .group { background: var(--surface-1); border: 1px solid var(--border); border-radius: var(--radius); padding: 0.55rem 0.9rem; }
  .group summary { display: grid; grid-template-columns: 1fr auto auto; gap: 1.2rem; align-items: baseline; cursor: pointer; font-size: 0.86rem; }
  .gname { display: inline-flex; align-items: center; gap: 0.45rem; font-weight: 600; }
  .gcount, .gspend { font-variant-numeric: tabular-nums; color: var(--text-secondary); font-size: 0.8rem; }
  .gmeaning { font-size: 0.78rem; color: var(--text-muted); margin: 0.5rem 0; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--series-1); }
  .dot[data-action='add_negative'] { background: var(--serious); }
  .dot[data-action='promote_to_exact'] { background: var(--good); }
  .dot[data-action='lower_bid'] { background: var(--warning); }
  .dot[data-action='no_action'] { background: var(--text-muted); }
  table { width: 100%; border-collapse: collapse; font-size: 0.78rem; }
  th { text-align: left; font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); font-weight: 600; padding: 0.3rem 0.4rem; border-bottom: 1px solid var(--border); }
  td { padding: 0.3rem 0.4rem; border-bottom: 1px solid var(--grid); }
  .r { text-align: right; }
  .num { font-variant-numeric: tabular-nums; }

  .asked ol { margin: 0; padding-left: 1.2rem; display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.84rem; color: var(--text-secondary); max-width: 90ch; }
  .opts { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-top: 0.35rem; }
  .opts span { font-size: 0.72rem; padding: 0.1rem 0.4rem; border: 1px solid var(--border); border-radius: 5px; }

  .muted { color: var(--text-muted); }
  .small { font-size: 0.76rem; max-width: 80ch; }
  .badge { font-size: 0.64rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; padding: 0.14rem 0.4rem; border-radius: 5px; margin-left: 0.3rem; border: 1px solid var(--border); }
  .badge.sim { background: color-mix(in srgb, var(--warning) 22%, transparent); color: var(--text-primary); }

  @media (max-width: 760px) {
    .hero { flex-direction: column; align-items: flex-start; }
    .decide { grid-template-columns: 1fr; }
    .group summary { grid-template-columns: 1fr auto; }
    .gspend { display: none; }
    table th:nth-child(2), table td:nth-child(2), table th:nth-child(6), table td:nth-child(6) { display: none; }
  }
</style>

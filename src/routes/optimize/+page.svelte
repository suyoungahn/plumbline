<script lang="ts">
  import { base } from '$app/paths';
  import StatTile from '$lib/components/StatTile.svelte';
  import DistributionBars from '$lib/components/DistributionBars.svelte';
  import Meter from '$lib/components/Meter.svelte';
  import { LEVERS, SEVERITY_MAX, severityLabel, type LeverId } from '$lib/domain';
  import { POLICY, TICKS } from '$lib/scenario/nuvola';
  import {
    run, advance, nextTick, reset, rule,
    currentTick, proposalForDay, ruledFor, effectiveAgreement, wouldAutoExecute
  } from '$lib/state.svelte';

  const tick = $derived(currentTick());
  const proposal = $derived(tick ? proposalForDay(tick.day) : undefined);
  const ruled = $derived(tick ? ruledFor(tick.day) : undefined);
  const target = $derived(
    proposal?.targetLineItemId ? tick.lineItems.find((l) => l.id === proposal.targetLineItemId) : undefined
  );

  const cpaStatus = $derived(
    !tick ? 'neutral'
    : tick.cpaEur <= POLICY.targetCpaEur ? 'good'
    : tick.cpaEur > POLICY.targetCpaEur * 1.3 ? 'critical'
    : 'serious'
  );

  const pacingStatus = $derived(
    !tick ? 'neutral'
    : tick.pacingIndex <= POLICY.pacingTolerance[1] ? 'good'
    : tick.pacingIndex > 1.25 ? 'critical' : 'serious'
  );

  const totalCost = $derived(run.proposals.reduce((s, p) => s + p.costUsd, 0));
  const isSim = $derived(run.proposals.length > 0 && run.proposals.every((p) => p.source === 'sim'));
  const levers = Object.keys(LEVERS) as LeverId[];
  const isLast = $derived(run.tickIndex >= TICKS.length - 1);

</script>

<div class="page">
  <div class="topline">
    <div>
      <nav class="crumbs"><a href={`${base}/campaign/agropur-natrel-protein`}>← Agropur Natrel protein milk launch</a></nav>
      <span class="eyebrow">Flight replay · six observations across a 30 day flight</span>
      <h1>Optimize, tick by tick</h1>
      <p class="lede">
        The portfolio view shows one moment across 24 campaigns. This shows one campaign across its
        whole flight, which is where the loop and the threshold ratchet become visible.
        <span class="caveat">Recorded before the scenario was relabelled for Canada, so Jev saw earlier
        brand and retailer names. The figures and decisions are real Jev output; a re-record refreshes the labels.</span>
      </p>
    </div>

    <div class="controls">
      {#if proposal}
        <span class="badge" data-kind={proposal.source}>
          {proposal.source === 'sim' ? 'Simulated' : proposal.source === 'replay' ? 'Replay' : 'Live Jev'}
        </span>
      {/if}
      <button onclick={() => advance()} disabled={run.busy || !!proposal}>
        {run.busy ? 'Evaluating…' : proposal ? 'Evaluated' : `Evaluate day ${tick?.day}`}
      </button>
      <button onclick={nextTick} disabled={!proposal || isLast}>Next tick</button>
      <button onclick={reset}>Reset</button>
    </div>
  </div>

  {#if run.errorMessage}
    <p class="error">{run.errorMessage}</p>
  {/if}

  {#if tick}
    <section class="tiles">
      <StatTile label="Day" value={`${tick.day} / ${POLICY.flightDays}`} detail="of flight" />
      <StatTile label="Spend" value={`CA$${(tick.spendToDateEur / 1000).toFixed(1)}k`} detail={`of CA$${tick.budgetEur / 1000}k budget`} />
      <StatTile label="Pacing" value={tick.pacingIndex.toFixed(2)} status={pacingStatus}
        detail={`tolerance ${POLICY.pacingTolerance[0]} to ${POLICY.pacingTolerance[1]}`} />
      <StatTile label="CPA" value={`CA$${tick.cpaEur.toFixed(2)}`} status={cpaStatus}
        detail={`target CA$${POLICY.targetCpaEur.toFixed(2)}`} />
      <StatTile label="Conversions" value={tick.conversions.toLocaleString()} detail="to date" />
      <StatTile label="Decision spend" value={isSim ? 'not measured' : `${totalCost.toFixed(6)}`}
        detail={isSim ? 'simulated run, no real cost' : `${run.proposals.length} evaluations`} />
    </section>

    <p class="headline">{tick.headline}</p>

    <div class="grid">
      <div class="col">
        <section class="card panel">
          <header class="panel-head">
            <h2>What the decision model was asked</h2>
            <span class="muted">Three typed questions, one call, closed answer space</span>
          </header>

          {#if !proposal}
            <p class="empty">Evaluate day {tick.day} to see the decision.</p>
          {:else}
            <div class="q">
              <div class="q-head">
                <code>noul</code>
                <span>Does this campaign require operator intervention right now?</span>
              </div>
              <Meter
                value={proposal.gateProbability}
                label="Probability true"
                tone={proposal.gateProbability > 0.6 ? 'critical' : 'good'}
                caption="Noul returns no separate confidence field. The probability is the certainty."
              />
            </div>

            <div class="q">
              <div class="q-head">
                <code>choice</code>
                <span>Which single lever best corrects this campaign?</span>
              </div>
              <DistributionBars
                selected={proposal.lever}
                items={Object.entries(proposal.leverDistribution).map(([key, value]) => ({
                  key,
                  label: LEVERS[key as LeverId]?.label ?? key,
                  value
                }))}
              />
              <p class="note">
                Confidence {(proposal.leverConfidence * 100).toFixed(0)} percent. The answer space is
                declared up front, so there is no option here the agency did not authorise.
              </p>
            </div>

            <div class="q">
              <div class="q-head">
                <code>score</code>
                <span>How severe is the gap against the objective?</span>
              </div>
              <Meter value={proposal.severity} max={SEVERITY_MAX} label="Severity" tone={proposal.severity >= 2.5 ? 'critical' : proposal.severity >= 1.5 ? 'serious' : 'good'}
                caption={severityLabel(proposal.severity)} />
            </div>
          {/if}
        </section>

        {#if proposal}
          <section class="card proposal" data-ruled={ruled?.ruling ?? 'pending'} class:shut={!proposal.gateOpen}>
            <header class="panel-head">
              <h2>{proposal.gateOpen ? 'Proposal' : 'No intervention raised'}</h2>
              {#if !proposal.gateOpen}
                <span class="badge">Gate shut</span>
              {:else if ruled}
                <span class="badge" data-kind={ruled.ruling}>
                  {ruled.ruling === 'auto_executed' ? 'Auto executed' : ruled.ruling === 'approved' ? 'Approved' : 'Rejected'}
                </span>
              {:else if wouldAutoExecute(proposal)}
                <span class="badge" data-kind="auto">Above threshold</span>
              {/if}
            </header>

            {#if !proposal.gateOpen}
              <p class="shutline">
                The gate scored {(proposal.gateProbability * 100).toFixed(0)} percent, below the
                50 percent bar, so nothing enters the operator's queue. The lever below is what the
                model <em>would</em> reach for if it had to act, shown for transparency only.
              </p>
            {/if}

            <p class="lever">{LEVERS[proposal.lever].label}</p>
            {#if target}
              <p class="target">{target.platform} · {target.audience} · {target.placement}</p>
            {/if}
            <p class="meaning">{LEVERS[proposal.lever].meaning}</p>

            {#if proposal.rationale}
              <p class="rationale">{proposal.rationale}</p>
              <p class="note">Rationale written by a generative model. The decision above it was not.</p>
            {:else}
              <p class="note">
                No generated rationale in this mode. The decision stands without it, which is the point:
                prose is never load bearing.
              </p>
            {/if}

            {#if !LEVERS[proposal.lever].agencyAuthority}
              <p class="escalation">
                This lever is outside the agency mandate. The agent is declining to act and handing the
                decision back to the client.
              </p>
            {/if}

            {#if !ruled && proposal.gateOpen}
              <div class="actions">
                <button class="approve" onclick={() => rule(proposal, 'approved')}>Approve</button>
                <button onclick={() => rule(proposal, 'rejected')}>Reject</button>
              </div>
            {/if}
          </section>
        {/if}
      </div>

      <div class="col">
        <section class="card panel">
          <header class="panel-head">
            <h2>Auto-execute thresholds</h2>
            <span class="muted">The adoption dial</span>
          </header>
          <p class="note">
            Every lever starts at 100 percent, meaning a human rules on everything. A threshold only
            comes down when the measured agreement rate justifies it.
          </p>
          <ul class="thresholds">
            {#each levers as id (id)}
              {@const ag = effectiveAgreement(id)}
              <li>
                <div class="t-head">
                  <span class="t-label">{LEVERS[id].label}</span>
                  <span class="t-value tabular">
                    {run.thresholds[id] >= 1 ? 'Review all' : `auto ≥ ${(run.thresholds[id] * 100).toFixed(0)}%`}
                  </span>
                </div>
                <div class="t-bar">
                  <div class="t-fill" style:width={`${(ag?.rate ?? 0) * 100}%`} data-armed={run.thresholds[id] < 1}></div>
                  <div class="t-cut" style:left={`${run.thresholds[id] * 100}%`}></div>
                </div>
                <span class="t-meta">
                  {#if ag}{(ag.rate * 100).toFixed(0)} percent agreement over {ag.n} rulings{:else}no rulings yet{/if}
                </span>
              </li>
            {/each}
          </ul>
        </section>

        <section class="card panel">
          <header class="panel-head">
            <h2>Decision ledger</h2>
            <span class="muted">{run.ledger.length} entries</span>
          </header>
          {#if run.ledger.length === 0}
            <p class="empty">Nothing ruled yet.</p>
          {:else}
            <ul class="ledger">
              {#each [...run.ledger].reverse() as e (e.proposal.id)}
                <li>
                  <span class="l-day tabular">Day {e.proposal.day}</span>
                  <span class="l-lever">{LEVERS[e.proposal.lever].label}</span>
                  <span class="badge" data-kind={e.ruling}>
                    {e.ruling === 'auto_executed' ? 'auto' : e.ruling}
                  </span>
                </li>
              {/each}
            </ul>
            <p class="note">
              This ledger is what Report narrates. Nobody builds a deck, because the record already exists.
            </p>
          {/if}
        </section>
      </div>
    </div>
  {/if}
</div>

<style>
  .crumbs { font-size: 0.78rem; margin-bottom: 0.4rem; }
  .crumbs a { color: var(--text-secondary); text-decoration: none; }
  .crumbs a:hover { text-decoration: underline; }
  .caveat { display: block; margin-top: 0.4rem; font-size: 0.76rem; color: var(--text-muted); }
  .topline { display: flex; justify-content: space-between; align-items: flex-start; gap: 1.5rem; flex-wrap: wrap; margin-bottom: 1.25rem; }
  .lede { color: var(--text-secondary); max-width: 54ch; margin: 0.35rem 0 0; }
  .controls { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }

  .tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.6rem; }
  .headline { color: var(--text-secondary); margin: 1rem 0 1.25rem; font-size: 0.95rem; max-width: 90ch; }

  .grid { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(0, 1fr); gap: 1rem; align-items: start; }
  .col { display: flex; flex-direction: column; gap: 1rem; min-width: 0; }

  .panel, .proposal { padding: 1rem 1.1rem; }
  .panel-head { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; margin-bottom: 0.85rem; }
  .muted { font-size: 0.78rem; color: var(--text-muted); }

  .q { padding: 0.9rem 0; border-top: 1px solid var(--grid); }
  .q:first-of-type { border-top: 0; padding-top: 0; }
  .q-head { display: flex; gap: 0.6rem; align-items: baseline; margin-bottom: 0.6rem; }
  .q-head code {
    font-size: 0.7rem; font-weight: 700; letter-spacing: 0.04em;
    background: var(--surface-3); color: var(--text-secondary);
    padding: 0.1rem 0.4rem; border-radius: 4px;
  }
  .q-head span { font-size: 0.85rem; color: var(--text-primary); }

  .note { font-size: 0.76rem; color: var(--text-muted); margin: 0.5rem 0 0; max-width: 68ch; }
  .empty { color: var(--text-muted); font-size: 0.85rem; margin: 0; }
  .error { color: var(--critical); font-size: 0.85rem; }

  .proposal.shut { opacity: 0.72; }
  .shutline {
    margin: 0 0 0.75rem; padding: 0.55rem 0.7rem; font-size: 0.83rem;
    background: var(--surface-2); border-left: 3px solid var(--axis);
    border-radius: 0 6px 6px 0; color: var(--text-secondary);
  }
  .lever { font-size: 1.3rem; font-weight: 650; letter-spacing: -0.02em; margin: 0; }
  .target { font-size: 0.85rem; color: var(--series-1); margin: 0.15rem 0 0; font-weight: 550; }
  .meaning { font-size: 0.82rem; color: var(--text-muted); margin: 0.3rem 0 0; }
  .rationale { margin: 0.75rem 0 0; font-size: 0.92rem; color: var(--text-primary); }
  .escalation {
    margin: 0.75rem 0 0; padding: 0.6rem 0.75rem;
    background: color-mix(in srgb, var(--warning) 12%, transparent);
    border-left: 3px solid var(--warning);
    border-radius: 0 6px 6px 0;
    font-size: 0.85rem;
  }
  .actions { display: flex; gap: 0.5rem; margin-top: 1rem; }
  .approve { background: var(--series-1); border-color: var(--series-1); color: #fff; font-weight: 600; }
  .approve:hover:not(:disabled) { filter: brightness(1.08); background: var(--series-1); }

  .badge {
    font-size: 0.68rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;
    padding: 0.18rem 0.45rem; border-radius: 5px;
    background: var(--surface-3); color: var(--text-secondary);
    border: 1px solid var(--border);
  }
  .badge[data-kind='sim'] { background: color-mix(in srgb, var(--warning) 20%, transparent); color: var(--text-primary); }
  .badge[data-kind='live'] { background: color-mix(in srgb, var(--good) 18%, transparent); color: var(--good-text); }
  .badge[data-kind='approved'], .badge[data-kind='auto_executed'], .badge[data-kind='auto'] {
    background: color-mix(in srgb, var(--good) 16%, transparent); color: var(--good-text);
  }
  .badge[data-kind='rejected'] { background: color-mix(in srgb, var(--critical) 16%, transparent); color: var(--critical); }

  .thresholds { list-style: none; margin: 0.75rem 0 0; padding: 0; display: flex; flex-direction: column; gap: 0.7rem; }
  .t-head { display: flex; justify-content: space-between; align-items: baseline; gap: 0.5rem; }
  .t-label { font-size: 0.82rem; }
  .t-value { font-size: 0.72rem; color: var(--text-muted); }
  .t-bar { position: relative; height: 7px; background: var(--surface-3); border-radius: 4px; margin-top: 0.25rem; }
  .t-fill { height: 100%; border-radius: 4px; background: var(--seq-250); }
  .t-fill[data-armed='true'] { background: var(--good); }
  .t-cut { position: absolute; top: -3px; bottom: -3px; width: 2px; background: var(--text-primary); border-radius: 1px; }
  .t-meta { font-size: 0.7rem; color: var(--text-muted); }

  .ledger { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.35rem; }
  .ledger li { display: flex; align-items: center; gap: 0.6rem; font-size: 0.82rem; }
  .l-day { color: var(--text-muted); min-width: 4rem; }
  .l-lever { flex: 1; }

  @media (max-width: 960px) { .grid { grid-template-columns: 1fr; } }
</style>

<script lang="ts">
  import { base } from '$app/paths';
  import { onMount } from 'svelte';
  import JevPanel from '$lib/components/JevPanel.svelte';
  import StatRail from '$lib/components/StatRail.svelte';
  import type { RailStat } from '$lib/components/stat-rail';
  import type { JevDelta, JevOutcome, JevStep } from '$lib/components/jev-panel';
  import { SURFACES, type SurfaceId } from '$lib/placements';
  import { SUPPLY } from '$lib/supply';
  import { CLIENTS, MANAGER, MARKET_LABEL, REQUIRED_LANGUAGES, type ClientId, type Market } from '$lib/portfolio';
  import {
    OBJECTIVES, STATUS_LABEL, allocationTotal, approvalsRequired, creativeCoverage,
    FORMAT_SURFACES,
    type CampaignStatus, type CreativeAsset, type CreativeFormat, type ObjectiveType, type PlanDraft
  } from '$lib/plan';
  import { DRAFT } from '$lib/scenario/draft-plan';
  import { money } from '$lib/money';
  import { GATE_THRESHOLD } from '$lib/domain';
  import { PLAN_LEVERS, planQuestions, stateFor as planStateFor } from '$lib/plan-eval';
  import { simulate } from '$lib/heuristic';

  let plan = $state<PlanDraft>(structuredClone(DRAFT));
  let check = $state<any>(null);
  let prev = $state<any>(null);
  let planState = $state<any>(null);
  let checking = $state(false);
  let status = $state<CampaignStatus>('draft');
  let trail = $state<{ stage: string; by: string; note: string }[]>([]);
  let thumbs = $state<Record<string, string>>({});
  let fileInput: HTMLInputElement | undefined = $state();

  const eur = money;

  const coverage = $derived(creativeCoverage(plan));
  const allocated = $derived(allocationTotal(plan));
  const approvals = $derived(approvalsRequired(plan.budgetEur));
  const submittable = $derived(!!check?.deliverable && coverage.ready && status === 'draft');

  const RETAILERS = [...new Set(SUPPLY.map((s) => s.retailer))];
  const FORMATS = Object.keys(FORMAT_SURFACES) as CreativeFormat[];

  function evaluateLocally() {
    const s = planStateFor(plan);
    const sim = simulate(s, planQuestions());
    const gate = sim.answers.gate as Record<string, number>;
    const lever = sim.answers.lever as Record<string, unknown>;
    const sev = sim.answers.severity as Record<string, number>;
    const dist = lever.probabilities as Record<string, number>;
    const selected = lever.choice as string;
    return {
      state: s,
      check: {
        deliverableProbability: 1 - gate.noul,
        deliverable: 1 - gate.noul >= GATE_THRESHOLD,
        recommendation: selected,
        recommendationLabel: PLAN_LEVERS[selected] ?? selected,
        distribution: dist,
        confidence: lever.confidence as number,
        riskScore: sev.score,
        riskConfidence: sev.confidence,
        costUsd: 0,
        latencyMs: 0,
        source: 'sim'
      }
    };
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  let pristine = true;

  function reevaluate(immediate = false) {
    if (!immediate) pristine = false;
    clearTimeout(timer);
    timer = setTimeout(async () => {
      checking = true;
      try {
        const url = pristine ? `${base}/api/plan-baseline` : `${base}/api/plan-check`;
        const res = pristine
          ? await fetch(url)
          : await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ plan })
            });
        if (!res.ok) throw new Error(String(res.status));
        const j = await res.json();
        if (check) prev = check;
        check = j.check;
        planState = j.state;
      } catch {
        const local = evaluateLocally();
        if (check) prev = check;
        check = local.check;
        planState = local.state;
      } finally {
        checking = false;
      }
    }, immediate ? 0 : 550);
  }

  onMount(() => reevaluate(true));

  function setPlacement(i: number, v: number) {
    plan.placements[i].requestedEur = Math.max(0, Math.round(v));
    reevaluate();
  }
  function removePlacement(i: number) {
    plan.placements.splice(i, 1);
    reevaluate();
  }
  function addPlacement() {
    const used = new Set(plan.placements.map((p) => `${p.retailer}|${p.surface}`));
    const free = SUPPLY.find((s) => !used.has(`${s.retailer}|${s.surface}`));
    if (!free) return;
    plan.placements.push({ retailer: free.retailer, surface: free.surface, requestedEur: 10_000 });
    reevaluate();
  }
  function autoBalance() {
    if (!planState) return;
    let spill = 0;
    plan.placements.forEach((p, i) => {
      const s = planState.placements[i];
      if (s?.inventory_bounded && p.requestedEur > s.available_eur) {
        spill += p.requestedEur - s.available_eur;
        p.requestedEur = s.available_eur;
      }
    });
    const off = plan.placements.find((p) => p.surface === 'offsite');
    if (off) off.requestedEur += spill;
    else plan.placements.push({ retailer: 'Open web (DV360, TTD)', surface: 'offsite', requestedEur: spill });
    trail = [...trail, { stage: 'Plan corrected', by: `${MANAGER.name}`, note: `Capped onsite at available inventory, ${eur(spill)} moved to offsite` }];
    reevaluate();
  }

  async function onFiles(e: Event) {
    const files = Array.from((e.target as HTMLInputElement).files ?? []);
    for (const f of files) {
      const id = `cr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      let format: CreativeFormat = 'app_native';
      if (f.type.startsWith('image/')) {
        const url = URL.createObjectURL(f);
        thumbs[id] = url;
        const dims = await new Promise<{ w: number; h: number }>((res) => {
          const img = new Image();
          img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight });
          img.onerror = () => res({ w: 0, h: 0 });
          img.src = url;
        });
        const key = `${dims.w}x${dims.h}` as CreativeFormat;
        format = (FORMATS as string[]).includes(key) ? key : '300x250';
      } else if (f.type.startsWith('video/')) format = 'video_15s';

      const asset: CreativeAsset = {
        id,
        filename: f.name,
        format,
        sizeKb: Math.round(f.size / 1024),
        eligibleSurfaces: FORMAT_SURFACES[format],

        language: /_fr[-_]?ca|_fr\b|_fr\./i.test(f.name) ? 'fr-CA' : /_es\b|_es\./i.test(f.name) ? 'es' : 'en'
      };
      plan.creatives.push(asset);
    }
    if (fileInput) fileInput.value = '';
    reevaluate();
  }

  function setFormat(c: CreativeAsset, f: CreativeFormat) {
    c.format = f;
    c.eligibleSurfaces = FORMAT_SURFACES[f];
    reevaluate();
  }
  function removeCreative(i: number) {
    plan.creatives.splice(i, 1);
    reevaluate();
  }

  const STEPS_UI: { key: CampaignStatus; label: string }[] = [
    { key: 'draft', label: 'Plan' },
    { key: 'pending_internal', label: 'Internal review' },
    { key: 'pending_client', label: 'Client approval' },
    { key: 'approved', label: 'Approved' },
    { key: 'live', label: 'Live' }
  ];
  const stepIndex = $derived(STEPS_UI.findIndex((s) => s.key === status));

  function advance(to: CampaignStatus, stage: string, by: string, note: string) {
    status = to;
    trail = [...trail, { stage, by, note }];
  }

  const rail = $derived<RailStat[]>(
    !check || !planState
      ? []
      : [
          {
            label: 'Deliverable',
            value: `${(check.deliverableProbability * 100).toFixed(0)}%`,
            tone: check.deliverable ? 'good' : 'bad',
            bar: check.deliverableProbability,
            threshold: 0.5,
            note: check.deliverable ? 'clears the 50% bar' : 'below the 50% bar'
          },
          {
            label: 'Undeliverable',
            value: eur(planState.undeliverable_eur),
            tone: planState.undeliverable_eur > 0 ? 'bad' : 'good',
            note: `${(planState.undeliverable_pct * 100).toFixed(1)}% of budget`
          },
          {
            label: 'Expected CPA',
            value: `${planState.expected_blended_cpa_eur}`,
            tone: planState.expected_cpa_vs_target_pct > 0 ? 'bad' : 'good',
            note: `${planState.expected_cpa_vs_target_pct > 0 ? '+' : ''}${planState.expected_cpa_vs_target_pct}% vs ${plan.targetCpaEur.toFixed(2)} target`
          },
          {
            label: 'Delivery risk',
            value: `${check.riskScore.toFixed(1)} / 4`,
            tone: check.riskScore > 2 ? 'bad' : check.riskScore > 1 ? 'warn' : 'good',
            bar: check.riskScore / 4
          },
          {
            label: 'Allocated',
            value: eur(allocated),
            tone: allocated === plan.budgetEur ? 'good' : 'warn',
            note: allocated === plan.budgetEur ? 'matches budget' : `of ${eur(plan.budgetEur)} budget`
          },
          {
            label: 'Creative',
            value: coverage.ready ? 'Ready' : 'Blocked',
            tone: coverage.ready ? 'good' : 'bad',
            note: coverage.ready ? `${coverage.required.join(', ')} covered` : `${coverage.gaps.length} language gap(s)`
          }
        ]
  );

  const jevSteps = $derived<JevStep[]>(
    !check || !planState
      ? []
      : [
          { label: 'What it read', primitive: `${Object.keys(planState).length} state fields`, value: `${plan.placements.length} placements`, sub: `${plan.creatives.length} creatives, ${eur(plan.budgetEur)} over ${plan.flightDays} days`, lit: true },
          { label: 'Is this deliverable?', primitive: 'noul · bar at 50%', value: `${(check.deliverableProbability * 100).toFixed(0)}%`, bar: { value: check.deliverableProbability, threshold: 0.5, tone: check.deliverable ? 'good' : 'bad' }, sub: check.deliverable ? 'clears the bar' : `${eur(planState.undeliverable_eur)} has nowhere to go`, lit: true },
          { label: 'What would fix it?', primitive: `choice · over ${Object.keys(check.distribution).length} options`, value: check.recommendation.replace(/_/g, ' '), sub: `${(check.confidence * 100).toFixed(0)}% confidence`, lit: true },
          { label: 'How much risk?', primitive: 'score · 0 to 4', value: check.riskScore.toFixed(1), bar: { value: check.riskScore / 4, tone: check.riskScore > 2 ? 'bad' : 'good' }, lit: true }
        ]
  );
  const jevOutcome = $derived(
    !check
      ? { label: '—', why: '', tone: 'neutral' as const }
      : check.deliverable && coverage.ready
        ? { label: 'Ready to submit', why: 'Deliverable against real inventory, and every surface has eligible creative.', tone: 'good' as const }
        : !check.deliverable
          ? { label: 'Blocked: not deliverable', why: 'Submission is disabled until the allocation fits the inventory that exists.', tone: 'bad' as const }
          : {
              label: 'Blocked: creative gap',
              why: coverage.gaps
                .map((g) => `no ${g.language} asset for ${g.surfaces.map((s: SurfaceId) => SURFACES[s].label).join(', ')}`)
                .join('; '),
              tone: 'warn' as const
            }
  );
  const delta = $derived(
    prev && check
      ? [
          { label: 'Deliverable', from: `${(prev.deliverableProbability * 100).toFixed(0)}%`, to: `${(check.deliverableProbability * 100).toFixed(0)}%`, better: check.deliverableProbability > prev.deliverableProbability },
          { label: 'Recommended change', from: prev.recommendation.replace(/_/g, ' '), to: check.recommendation.replace(/_/g, ' '), better: check.recommendation === 'approve_as_is' },
          { label: 'Delivery risk', from: prev.riskScore.toFixed(1), to: check.riskScore.toFixed(1), better: check.riskScore < prev.riskScore }
        ].filter((d) => d.from !== d.to)
      : []
  );
</script>

<div class="page shell">
  <header class="top">
    <div>
      <span class="eyebrow">New campaign · {MANAGER.agency}</span>
      <h1>Plan a campaign</h1>
      <p class="lede">
        Every field here is editable, and Jev re-evaluates the whole plan each time you change one.
        Change a number and watch the deliverability move.
      </p>
    </div>
    <span class="live" class:on={checking}>{checking ? 'Jev re-evaluating…' : 'Up to date'}</span>
  </header>

  <div class="main">
  <ol class="stepper">
    {#each STEPS_UI as s, i (s.key)}
      <li class:done={i < stepIndex} class:on={i === stepIndex}><span class="sn">{i < stepIndex ? '✓' : i + 1}</span>{s.label}</li>
    {/each}
    <li class="st">{STATUS_LABEL[status]}</li>
  </ol>

  {#if check}
    <JevPanel
      steps={jevSteps}
      outcome={jevOutcome}
      {delta}
      meta={{ costUsd: check.costUsd, latencyMs: check.latencyMs, source: check.source }}
      raw={{ state: planState, questions: [
        { key: 'gate', type: 'noul', instructions: 'Is this media plan deliverable as specified?' },
        { key: 'lever', type: 'choice', instructions: 'Which single change would best fix this plan before it goes to approval?', optionCount: Object.keys(check.distribution).length },
        { key: 'severity', type: 'score', instructions: 'How much delivery risk does this plan carry as written?' }
      ], answers: { deliverable: check.deliverableProbability, recommendation: check.recommendation, distribution: check.distribution, confidence: check.confidence, risk: check.riskScore } }}
    />
  {/if}

  <section class="card">
    <h2>1 · Objective and budget</h2>
    <div class="grid">
      <label>Advertiser
        <select bind:value={plan.clientId} onchange={() => reevaluate()}>
          {#each Object.entries(CLIENTS) as [id, c] (id)}<option value={id}>{c.name}</option>{/each}
        </select>
      </label>
      <label>Campaign name
        <input bind:value={plan.name} oninput={() => reevaluate()} />
      </label>
      <label>Market
        <select bind:value={plan.market} onchange={() => reevaluate()}>
          <option value="US">United States</option>
          <option value="CA">Canada</option>
        </select>
      </label>
      <label>Objective type
        <select bind:value={plan.objectiveType} onchange={() => reevaluate()}>
          {#each Object.entries(OBJECTIVES) as [k, o] (k)}<option value={k}>{o.label}</option>{/each}
        </select>
      </label>
      <label class="wide">Objective
        <input bind:value={plan.objective} oninput={() => reevaluate()} />
      </label>
      <label>Budget (EUR)
        <input type="number" step="5000" min="0" bind:value={plan.budgetEur} oninput={() => reevaluate()} />
      </label>
      <label>Flight (days)
        <input type="number" step="1" min="1" max="180" bind:value={plan.flightDays} oninput={() => reevaluate()} />
      </label>
      <label>Target CPA (EUR)
        <input type="number" step="0.5" min="0" bind:value={plan.targetCpaEur} oninput={() => reevaluate()} />
      </label>
    </div>
    <p class="note">
      {OBJECTIVES[plan.objectiveType as ObjectiveType].note}. {approvals.reason}.
      {MARKET_LABEL[plan.market as Market]} requires creative in {REQUIRED_LANGUAGES[plan.market as Market].join(' and ')}.
    </p>
  </section>

  <section class="card">
    <h2>2 · Placements</h2>
    <p class="note">
      Drag a slider and the deliverability re-evaluates. Onsite inventory is finite, so the bar
      behind each slider is what actually exists over this flight.
    </p>
    <ul class="places">
      {#each plan.placements as p, i (p.retailer + p.surface)}
        {@const s = planState?.placements?.[i]}
        {@const avail = s?.available_eur ?? 0}
        {@const cap = Math.max(avail * 1.6, p.requestedEur * 1.2, 20000)}
        <li>
          <div class="ph">
            <span class="surf" data-s={p.surface}>{SURFACES[p.surface].short}</span>
            <strong>{p.retailer}</strong>
            {#if s && !s.inventory_bounded}<span class="unb">unbounded supply</span>{/if}
            <button class="rm" onclick={() => removePlacement(i)} aria-label="Remove">remove</button>
          </div>
          <div class="slider">
            <input type="range" min="0" max={Math.round(cap)} step="1000"
              value={p.requestedEur} oninput={(e) => setPlacement(i, +e.currentTarget.value)} />
            <input class="numin" type="number" step="1000" min="0"
              value={p.requestedEur} oninput={(e) => setPlacement(i, +e.currentTarget.value)} />
          </div>
          {#if s}
            <div class="track">
              <div class="avail" style:width={`${Math.min(100, (avail / cap) * 100)}%`}></div>
              <div class="ask" style:width={`${Math.min(100, (p.requestedEur / cap) * 100)}%`} data-over={p.requestedEur > avail && s.inventory_bounded}></div>
            </div>
            <p class="pm">
              {#if s.inventory_bounded}
                available {eur(avail)} · asking {s.requested_over_available}×
                {#if s.shortfall_eur > 0}<span class="bad">· {eur(s.shortfall_eur)} undeliverable</span>{/if}
              {:else}
                offsite, always available at about ${s.typical_cpa_eur} per acquisition
              {/if}
            </p>
          {/if}
        </li>
      {/each}
    </ul>
    {#if planState}

      <div class="tradeoff">
        <div class="to" data-bad={planState.undeliverable_eur > 0}>
          <span>Undeliverable</span>
          <strong>{eur(planState.undeliverable_eur)}</strong>
          <small>{(planState.undeliverable_pct * 100).toFixed(1)}% of budget with nowhere to go</small>
        </div>
        <div class="to" data-bad={planState.expected_cpa_vs_target_pct > 0}>
          <span>Expected CPA</span>
          <strong>${planState.expected_blended_cpa_eur}</strong>
          <small>{planState.expected_cpa_vs_target_pct > 0 ? '+' : ''}{planState.expected_cpa_vs_target_pct}% vs the ${plan.targetCpaEur.toFixed(2)} target</small>
        </div>
        <p class="tonote">
          These move against each other. Capping onsite fixes delivery and pushes budget onto more
          expensive offsite inventory, so CPA rises. Jev's confidence falls when the two conflict,
          which is the model declining to be sure about a judgment call.
        </p>
      </div>
    {/if}

    <div class="prow">
      <button onclick={addPlacement}>Add placement</button>
      {#if planState?.undeliverable_eur > 0}
        <button class="primary" onclick={autoBalance}>Apply Jev's fix: cap onsite, spill {eur(planState.undeliverable_eur)} to offsite</button>
      {/if}
      <span class="tot" class:bad={allocated !== plan.budgetEur}>
        allocated {eur(allocated)} of {eur(plan.budgetEur)}
        {#if allocated !== plan.budgetEur}({allocated > plan.budgetEur ? 'over' : 'under'} by {eur(Math.abs(allocated - plan.budgetEur))}){/if}
      </span>
    </div>
  </section>

  <section class="card" data-tone={coverage.ready ? 'ok' : 'alert'}>
    <h2>3 · Creative</h2>
    <p class="note">
      Every campaign needs an eligible asset for each surface it runs on, in the market language.
      This is a gate, not a warning: the plan cannot be submitted without it.
    </p>

    <div class="drop">
      <input bind:this={fileInput} type="file" multiple accept="image/*,video/*,.json" onchange={onFiles} />
      <span>Drop or choose creative. Format is read from the image dimensions and stays editable.</span>
    </div>

    {#if plan.creatives.length === 0}
      <p class="empty">No creative attached. Every surface below is blocked.</p>
    {:else}
      <ul class="creatives">
        {#each plan.creatives as c, i (c.id)}
          {@const wrong = !coverage.required.includes(c.language)}
          <li class:flag={wrong}>
            {#if thumbs[c.id]}<img src={thumbs[c.id]} alt="" />{:else}<span class="ph2">{c.format}</span>{/if}
            <span class="fn">{c.filename}<small>{c.sizeKb}kb</small></span>
            <label class="inline">format
              <select value={c.format} onchange={(e) => setFormat(c, e.currentTarget.value as CreativeFormat)}>
                {#each FORMATS as f (f)}<option value={f}>{f}</option>{/each}
              </select>
            </label>
            <label class="inline">language
              <select bind:value={c.language} onchange={() => reevaluate()}>
                <option value="en">en</option><option value="fr-CA">fr-CA</option><option value="es">es</option>
              </select>
            </label>
            <span class="el">{c.eligibleSurfaces.map((s) => SURFACES[s].short).join(', ')}</span>
            <span class="fl">{wrong ? 'wrong market' : 'eligible'}</span>
            <button class="rm" onclick={() => removeCreative(i)}>remove</button>
          </li>
        {/each}
      </ul>
    {/if}

    <p class="cov" data-ok={coverage.ready}>
      {#if coverage.ready}
        Every requested surface is covered in {coverage.required.join(' and ')}.
      {:else}
        {#each coverage.gaps as g (g.language)}
          <span class="gap">
            Missing <strong>{g.language}</strong> creative for
            {g.surfaces.map((s: SurfaceId) => SURFACES[s].label).join(', ')}.
          </span>
        {/each}
        {#if plan.market === 'CA' && coverage.missingLanguages.includes('fr-CA')}
          <span class="legal">
            This is a Canadian flight. French creative is a legal requirement for reaching Quebec
            under the Charter of the French Language, so this plan cannot run as written.
          </span>
        {/if}
      {/if}
      {#if coverage.unusable.length}
        · {coverage.unusable.length} asset(s) are not in a required language for this market.
      {/if}
    </p>
  </section>

  <section class="card">
    <h2>4 · Approval</h2>
    {#if trail.length}
      <ol class="trail">
        {#each trail as t, i (i)}<li><strong>{t.stage}</strong><span class="by">{t.by}</span><span class="tn">{t.note}</span></li>{/each}
      </ol>
    {/if}
    <div class="actions">
      {#if status === 'draft'}
        <button class="primary" disabled={!submittable}
          onclick={() => advance(approvals.internal ? 'pending_internal' : 'approved', 'Submitted', MANAGER.name, approvals.reason)}>
          Submit for approval
        </button>
        {#if !submittable}
          <span class="hint">
            {!check?.deliverable ? 'Blocked: the plan is not deliverable as written.' : 'Blocked: creative gap.'}
            Fix it above and this unlocks.
          </span>
        {/if}
      {:else if status === 'pending_internal'}
        <button class="primary" onclick={() => advance(approvals.client ? 'pending_client' : 'approved', 'Internal approval', 'Trading Director', 'Deliverability verified against supply')}>Approve as Trading Director</button>
      {:else if status === 'pending_client'}
        <button class="primary" onclick={() => advance('approved', 'Client approval', `${CLIENTS[plan.clientId as ClientId].name} marketing`, 'Policy and lever authority accepted')}>Record client approval</button>
      {:else if status === 'approved'}
        <button class="primary" onclick={() => advance('live', 'Activated', 'Plumbline', 'Policy pushed to every surface. Nothing was re-keyed')}>Activate</button>
      {:else}
        <p class="golive">Live. <a href={`${base}/today`}>Go to today’s queue</a></p>
      {/if}
    </div>
  </section>
  </div>

  {#if rail.length}
    <StatRail stats={rail} title="Plan health" />
  {/if}
</div>

<style>
  .shell { display: grid; grid-template-columns: minmax(0, 1fr) 232px; gap: 1.1rem; align-items: start; }
  .shell > .top { grid-column: 1 / -1; }
  .shell > .main { min-width: 0; }
  @media (max-width: 900px) { .shell { grid-template-columns: 1fr; } }
  .top { display: flex; justify-content: space-between; align-items: flex-start; gap: 2rem; flex-wrap: wrap; }
  .lede { color: var(--text-secondary); max-width: 80ch; margin: 0.4rem 0 1rem; font-size: 0.92rem; }
  .live { font-size: 0.72rem; color: var(--text-muted); padding: 0.2rem 0.5rem; border-radius: 20px; background: var(--surface-2); white-space: nowrap; }
  .live.on { background: color-mix(in srgb, var(--series-1) 18%, transparent); color: var(--series-1); font-weight: 600; }

  .stepper { list-style: none; display: flex; gap: 0.3rem; padding: 0; margin: 0 0 1rem; flex-wrap: wrap; align-items: center; }
  .stepper li { display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.75rem; padding: 0.22rem 0.55rem; border-radius: 20px; background: var(--surface-2); color: var(--text-muted); border: 1px solid var(--border); }
  .stepper li.done { background: color-mix(in srgb, var(--good) 15%, transparent); color: var(--good-text); }
  .stepper li.on { background: var(--series-1); color: #fff; border-color: var(--series-1); font-weight: 600; }
  .sn { font-size: 0.64rem; font-weight: 700; }
  .stepper li.st { margin-left: auto; background: none; border: none; }

  .card { padding: 1rem 1.15rem; margin-bottom: 0.9rem; background: var(--surface-1); border: 1px solid var(--border); border-radius: var(--radius); }
  .card[data-tone='alert'] { border-left: 3px solid var(--warning); }
  .card[data-tone='ok'] { border-left: 3px solid var(--good); }
  .card h2 { font-size: 0.9rem; margin-bottom: 0.6rem; }
  .note { font-size: 0.78rem; color: var(--text-secondary); margin: 0 0 0.8rem; max-width: 88ch; }

  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 0.6rem; }
  .grid .wide { grid-column: 1 / -1; }
  label { display: flex; flex-direction: column; gap: 0.2rem; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); }
  input, select { font: inherit; font-size: 0.85rem; text-transform: none; letter-spacing: normal; color: var(--text-primary); background: var(--surface-2); border: 1px solid var(--border); border-radius: 7px; padding: 0.35rem 0.5rem; }
  input:focus, select:focus { outline: 2px solid var(--series-1); outline-offset: -1px; }
  label.inline { flex-direction: row; align-items: center; gap: 0.3rem; font-size: 0.64rem; }
  label.inline select { padding: 0.15rem 0.3rem; font-size: 0.75rem; }

  .places { list-style: none; margin: 0 0 0.8rem; padding: 0; display: flex; flex-direction: column; gap: 0.8rem; }
  .places li { padding: 0.6rem 0.7rem; background: var(--surface-2); border-radius: 8px; }
  .ph { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.4rem; }
  .ph strong { font-size: 0.86rem; }
  .unb { font-size: 0.7rem; color: var(--series-7); }
  .rm { margin-left: auto; font-size: 0.68rem; padding: 0.12rem 0.4rem; color: var(--text-muted); }
  .surf { font-size: 0.64rem; font-weight: 700; padding: 0.1rem 0.32rem; border-radius: 4px; text-transform: uppercase; }
  .surf[data-s='sponsored_display'] { background: color-mix(in srgb, var(--series-1) 16%, transparent); color: var(--series-1); }
  .surf[data-s='in_app'] { background: color-mix(in srgb, var(--series-3) 18%, transparent); color: var(--series-3); }
  .surf[data-s='offsite'] { background: color-mix(in srgb, var(--series-7) 16%, transparent); color: var(--series-7); }

  .slider { display: flex; gap: 0.6rem; align-items: center; }
  .slider input[type='range'] { flex: 1; accent-color: var(--series-1); background: none; border: none; padding: 0; }
  .numin { width: 7.5rem; font-variant-numeric: tabular-nums; }
  .track { position: relative; height: 7px; background: var(--surface-3); border-radius: 4px; margin-top: 0.4rem; }
  .avail { position: absolute; inset: 0 auto 0 0; background: color-mix(in srgb, var(--good) 40%, transparent); border-radius: 4px; }
  .ask { position: absolute; top: 1px; bottom: 1px; left: 0; background: var(--series-1); border-radius: 3px; }
  .ask[data-over='true'] { background: var(--critical); }
  .pm { font-size: 0.73rem; color: var(--text-muted); margin: 0.3rem 0 0; font-variant-numeric: tabular-nums; }
  .pm .bad { color: var(--critical); font-weight: 600; }

  .tradeoff { display: flex; gap: 0.8rem; flex-wrap: wrap; align-items: flex-start; margin: 0.9rem 0; padding: 0.7rem 0.85rem; background: var(--surface-2); border-radius: 8px; }
  .to { min-width: 150px; }
  .to span { display: block; font-size: 0.66rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); }
  .to strong { font-size: 1.45rem; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; color: var(--good-text); }
  .to[data-bad='true'] strong { color: var(--critical); }
  .to small { display: block; font-size: 0.71rem; color: var(--text-secondary); }
  .tonote { flex: 1 1 260px; font-size: 0.74rem; color: var(--text-muted); margin: 0; }
  .prow { display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; }
  .tot { font-size: 0.78rem; color: var(--text-muted); font-variant-numeric: tabular-nums; margin-left: auto; }
  .tot.bad { color: var(--serious); }
  .primary { background: var(--series-1); border-color: var(--series-1); color: #fff; font-weight: 600; }
  .primary:hover:not(:disabled) { filter: brightness(1.08); background: var(--series-1); }

  .drop { display: flex; align-items: center; gap: 0.8rem; padding: 0.7rem 0.85rem; border: 1px dashed var(--axis); border-radius: 8px; margin-bottom: 0.8rem; }
  .drop span { font-size: 0.76rem; color: var(--text-muted); }
  .empty { font-size: 0.8rem; color: var(--critical); }

  .creatives { list-style: none; margin: 0 0 0.7rem; padding: 0; display: flex; flex-direction: column; gap: 3px; }
  .creatives li { display: grid; grid-template-columns: 44px 1fr auto auto auto auto auto; gap: 0.6rem; align-items: center; padding: 0.35rem 0.5rem; background: var(--surface-2); border-radius: 6px; font-size: 0.78rem; }
  .creatives li.flag { background: color-mix(in srgb, var(--warning) 16%, transparent); }
  .creatives img { width: 44px; height: 30px; object-fit: cover; border-radius: 3px; }
  .ph2 { font-size: 0.58rem; color: var(--text-muted); text-align: center; }
  .fn { font-family: ui-monospace, monospace; font-size: 0.74rem; display: flex; flex-direction: column; }
  .fn small { color: var(--text-muted); font-size: 0.66rem; }
  .el, .fl { font-size: 0.7rem; color: var(--text-muted); }
  .creatives li.flag .fl { color: var(--text-primary); font-weight: 600; }
  .cov { font-size: 0.8rem; margin: 0; color: var(--critical); }
  .gap { display: block; }
  .legal { display: block; margin-top: 0.3rem; color: var(--critical); font-weight: 600; }
  .cov[data-ok='true'] { color: var(--good-text); }

  .trail { list-style: none; margin: 0 0 0.8rem; padding: 0; display: flex; flex-direction: column; gap: 0.3rem; }
  .trail li { display: grid; grid-template-columns: 13rem 14rem 1fr; gap: 0.6rem; font-size: 0.78rem; padding: 0.3rem 0.5rem; background: var(--surface-2); border-radius: 5px; }
  .by { color: var(--text-secondary); }
  .tn { color: var(--text-muted); }
  .actions { display: flex; align-items: center; gap: 0.7rem; flex-wrap: wrap; }
  .hint { font-size: 0.75rem; color: var(--serious); }
  .golive { font-size: 0.85rem; color: var(--good-text); margin: 0; }
</style>

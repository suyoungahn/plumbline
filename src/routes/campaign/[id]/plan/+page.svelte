<script lang="ts">
  import { base } from '$app/paths';
  import JevPanel from '$lib/components/JevPanel.svelte';
  import type { JevDelta, JevStep } from '$lib/components/jev-panel';
  import { SURFACES, type SurfaceId } from '$lib/placements';
  import { SUPPLY } from '$lib/supply';
  import { MANAGER } from '$lib/portfolio';
  import { STATUS_LABEL, approvalsRequired, creativeCoverage, FORMAT_SURFACES, type CampaignStatus, type CreativeAsset, type CreativeFormat } from '$lib/plan';
  import { GATE_THRESHOLD } from '$lib/domain';
  import { planLeverLabel, planQuestions, stateFor as planStateFor } from '$lib/plan-eval';
  import { simulate } from '$lib/heuristic';
  import { page } from '$app/state';
  import { records, newLineId, resetCampaign } from '$lib/mediaplan/store.svelte';
  const doc = $derived(records[page.params.id!]);
  import { CHANNELS, type BuyType, type ChannelId, type PlanLine } from '$lib/mediaplan/types';
  import { cad, estimates, fitWeeks, flightDays, pct, planTotals, weekCount } from '$lib/mediaplan/calc';
  import { retailLines, toPlanDraft } from '$lib/mediaplan/deliverability';
  import { downloadWorkbook } from '$lib/mediaplan/xlsx';

  const plan = $derived(doc.plan);
  const totals = $derived(planTotals(plan));
  const approvals = $derived(approvalsRequired(plan.totalBudget));
  const draft = $derived(toPlanDraft(plan));
  const coverage = $derived(creativeCoverage(draft));
  const retail = $derived(retailLines(plan));

  let check = $state<any>(null);
  let prev = $state<any>(null);
  let planState = $state<any>(null);
  let checking = $state(false);
  let exporting = $state(false);
  let status = $state<CampaignStatus>('draft');
  let trail = $state<{ stage: string; by: string; note: string }[]>([]);
  let fileInput: HTMLInputElement | undefined = $state();

  const FORMATS = Object.keys(FORMAT_SURFACES) as CreativeFormat[];
  const BUY_TYPES: BuyType[] = ['CPM', 'CPC', 'Flat', 'TBD'];
  const sellers = (surface: SurfaceId) => [...new Set(SUPPLY.filter((s) => s.surface === surface).map((s) => s.retailer))];

  function evaluateLocally() {
    const s = planStateFor(draft);
    const sim = simulate(s, planQuestions());
    const gate = sim.answers.gate as Record<string, number>;
    const lever = sim.answers.lever as Record<string, unknown>;
    const sev = sim.answers.severity as Record<string, number>;
    return {
      state: s,
      check: {
        deliverableProbability: gate.noul,
        deliverable: gate.noul >= GATE_THRESHOLD,
        recommendation: lever.choice as string,
        distribution: lever.probabilities as Record<string, number>,
        confidence: lever.confidence as number,
        riskScore: sev.score,
        costUsd: 0,
        latencyMs: 0,
        source: 'sim'
      }
    };
  }

  // Re-check deliverability whenever a retail line, the flight or the creative changes.
  let timer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    const body = JSON.stringify({ plan: draft });
    clearTimeout(timer);
    timer = setTimeout(async () => {
      checking = true;
      try {
        const res = await fetch(`${base}/api/plan-check`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
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
    }, 500);
  });

  function onFlightChange() {
    fitWeeks(doc.plan);
  }

  function setChannel(l: PlanLine, ch: ChannelId) {
    l.channel = ch;
    l.role = CHANNELS[ch].role;
    const surface = CHANNELS[ch].surface;
    if (surface && !sellers(surface).includes(l.partner)) l.partner = sellers(surface)[0];
  }

  function addLine() {
    doc.plan.lines.push({
      id: newLineId(), channel: 'paid_social', partner: '', tactic: '', targeting: '', kpi: 'Sign-ups (CPA)',
      buyType: 'CPM', rate: 10, budget: 0, role: 'performance'
    });
  }

  function removeLine(i: number) {
    const [gone] = doc.plan.lines.splice(i, 1);
    doc.plan.heldLineIds = doc.plan.heldLineIds.filter((id) => id !== gone.id);
    delete doc.pacing.actuals[gone.id];
  }

  // Jev's fix: cap every inventory-bounded line at what exists and move the rest to
  // programmatic, which is always available at a higher cost per outcome.
  function applyFix() {
    if (!planState) return;
    let spill = 0;
    retail.forEach((l, i) => {
      const s = planState.placements[i];
      if (s?.inventory_bounded && l.budget > s.available_eur) {
        spill += l.budget - s.available_eur;
        l.budget = s.available_eur;
      }
    });
    const prog = doc.plan.lines.find((l) => l.channel === 'programmatic');
    if (prog) prog.budget += spill;
    else doc.plan.lines.push({ id: newLineId(), channel: 'programmatic', partner: 'The Trade Desk', tactic: 'Display + native', targeting: 'Retailer audience extension', kpi: 'Sign-ups / CPA', buyType: 'CPM', rate: 6, budget: spill, role: 'performance' });
    trail = [...trail, { stage: 'Plan corrected', by: MANAGER.name, note: `Capped finite retail and publisher lines at available inventory; ${cad(spill)} moved to programmatic` }];
  }

  async function onFiles(e: Event) {
    const files = Array.from((e.target as HTMLInputElement).files ?? []);
    for (const f of files) {
      let format: CreativeFormat = /native/i.test(f.name) ? 'web_native' : 'app_native';
      if (f.type.startsWith('image/')) {
        const url = URL.createObjectURL(f);
        const dims = await new Promise<{ w: number; h: number }>((res) => {
          const img = new Image();
          img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight });
          img.onerror = () => res({ w: 0, h: 0 });
          img.src = url;
        });
        URL.revokeObjectURL(url);
        const key = `${dims.w}x${dims.h}` as CreativeFormat;
        format = (FORMATS as string[]).includes(key) ? key : '300x250';
      } else if (f.type.startsWith('video/')) format = 'video_15s';
      const asset: CreativeAsset = {
        id: `cr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        filename: f.name,
        format,
        sizeKb: Math.round(f.size / 1024),
        eligibleSurfaces: FORMAT_SURFACES[format],
        language: /_fr[-_]?ca|_fr\b|_fr\./i.test(f.name) ? 'fr-CA' : 'en'
      };
      doc.plan.creatives.push(asset);
    }
    if (fileInput) fileInput.value = '';
  }

  async function exportXlsx() {
    exporting = true;
    try {
      await downloadWorkbook($state.snapshot(doc.plan), $state.snapshot(doc.pacing));
    } finally {
      exporting = false;
    }
  }

  const STEPS_UI: { key: CampaignStatus; label: string }[] = [
    { key: 'draft', label: 'Plan' },
    { key: 'pending_internal', label: 'Internal review' },
    { key: 'pending_client', label: 'Client approval' },
    { key: 'approved', label: 'Approved' },
    { key: 'live', label: 'Live' }
  ];
  const stepIndex = $derived(STEPS_UI.findIndex((s) => s.key === status));
  const budgetOk = $derived(totals.offBy === 0);
  const submittable = $derived(!!check?.deliverable && coverage.ready && budgetOk && status === 'draft');
  function advance(to: CampaignStatus, stage: string, by: string, note: string) {
    status = to;
    trail = [...trail, { stage, by, note }];
  }

  const jevSteps = $derived<JevStep[]>(
    !check || !planState
      ? []
      : [
          { label: 'What it read', primitive: `${Object.keys(planState).length} state fields`, value: `${retail.length} retail and publisher lines`, sub: `${cad(draft.budgetEur)} of the plan draws on finite or priced supply`, lit: true },
          { label: 'Is this deliverable?', primitive: 'noul · bar at 50%', value: pct(check.deliverableProbability), bar: { value: check.deliverableProbability, threshold: 0.5, tone: check.deliverable ? 'good' : 'bad' }, sub: check.deliverable ? 'clears the bar' : `${cad(planState.undeliverable_eur)} has nowhere to go`, lit: true },
          { label: 'What would fix it?', primitive: `choice · over ${Object.keys(check.distribution).length} options`, value: planLeverLabel(check.recommendation), sub: `${pct(check.confidence)} confidence`, lit: true },
          { label: 'How much risk?', primitive: 'score · 0 to 4', value: check.riskScore.toFixed(1), bar: { value: check.riskScore / 4, tone: check.riskScore > 2 ? 'bad' : 'good' }, lit: true }
        ]
  );
  const jevOutcome = $derived(
    !check
      ? { label: '—', why: '', tone: 'neutral' as const }
      : check.deliverable && coverage.ready
        ? { label: 'Deliverable', why: 'Every retail and publisher line fits the inventory that exists, and every surface has eligible creative.', tone: 'good' as const }
        : !check.deliverable
          ? { label: 'Blocked: not deliverable', why: 'Submission is disabled until the allocation fits the inventory that exists.', tone: 'bad' as const }
          : { label: 'Blocked: creative gap', why: coverage.gaps.map((g) => `no ${g.language} asset for ${g.surfaces.map((s) => SURFACES[s].label).join(', ')}`).join('; '), tone: 'warn' as const }
  );
  const delta = $derived<JevDelta[]>(
    prev && check
      ? [
          { label: 'Deliverable', from: pct(prev.deliverableProbability), to: pct(check.deliverableProbability), better: check.deliverableProbability > prev.deliverableProbability },
          { label: 'Recommended change', from: planLeverLabel(prev.recommendation), to: planLeverLabel(check.recommendation), better: check.recommendation === 'approve_as_is' }
        ].filter((d) => d.from !== d.to)
      : []
  );
</script>

<div class="page">
  <header class="mp-top">
    <div>
      <h2 class="tab-title">Media plan</h2>
      <p class="lede">
        Fill in the brief and the line items. Everything else, from estimated delivery to the weekly
        flowchart and the client workbook, is calculated from these fields. Jev checks whether the
        retail and publisher lines can actually be delivered while you type.
      </p>
    </div>
    <div class="mp-actions">
      <button onclick={() => confirm('Discard your edits to this campaign?') && resetCampaign(page.params.id!)}>Reset this campaign</button>
      <button class="mp-primary" onclick={exportXlsx} disabled={exporting}>{exporting ? 'Building…' : 'Download media plan (.xlsx)'}</button>
    </div>
  </header>

  <ol class="stepper">
    {#each STEPS_UI as s, i (s.key)}
      <li class:done={i < stepIndex} class:on={i === stepIndex}><span class="sn">{i < stepIndex ? '✓' : i + 1}</span>{s.label}</li>
    {/each}
    <li class="st">{STATUS_LABEL[status]}</li>
  </ol>

  <section class="mp-card">
    <h2>1 · Campaign brief</h2>
    <div class="mp-grid">
      <label class="mp-field">Client<input bind:value={doc.plan.client} /></label>
      <label class="mp-field">Campaign<input bind:value={doc.plan.campaign} /></label>
      <label class="mp-field">Prepared for<input bind:value={doc.plan.preparedFor} /></label>
      <label class="mp-field">Version / status<input bind:value={doc.plan.status} /></label>
      <label class="mp-field wide">Objective<input bind:value={doc.plan.objective} /></label>
      <label class="mp-field">Conversion counted<input bind:value={doc.plan.conversionName} placeholder="sign-up" /></label>
      <label class="mp-field">Target CPA (CAD)<input type="number" step="0.5" min="0" bind:value={doc.plan.targetCpa} /></label>
      <label class="mp-field">Flight start<input type="date" bind:value={doc.plan.flightStart} onchange={onFlightChange} /></label>
      <label class="mp-field">Flight end<input type="date" bind:value={doc.plan.flightEnd} onchange={onFlightChange} /></label>
      <label class="mp-field">Total budget (CAD)<input type="number" step="5000" min="0" bind:value={doc.plan.totalBudget} /></label>
    </div>
    <p class="mp-note" style="margin: 0.7rem 0 0">
      {flightDays(plan)} days, {weekCount(plan)} flowchart weeks. Primary KPI: cost per new {plan.conversionName}
      (target {cad(plan.targetCpa, 2)}). {approvals.reason}. Canada, including Quebec, requires creative in English and French.
    </p>
  </section>

  <section class="mp-card" data-tone={budgetOk ? undefined : 'alert'}>
    <h2>2 · Line items</h2>
    <p class="mp-note">
      One row per buy. Estimated impressions are budget ÷ CPM × 1,000 and estimated clicks are budget ÷
      CPC. Retail onsite, in-app, off-app and programmatic lines draw on the supply Jev checks below;
      pick the seller from the list.
    </p>
    <div class="mp-scroll">
      <table class="mp-table lines">
        <thead>
          <tr>
            <th>#</th><th>Channel</th><th>Partner / platform</th><th>Tactic & placement</th><th>Targeting</th><th>KPI</th>
            <th>Buy</th><th class="r">Rate</th><th class="r">Net budget</th><th class="r">% total</th><th class="r">Est. impr.</th><th class="r">Est. clicks</th><th></th>
          </tr>
        </thead>
        <tbody>
          {#each doc.plan.lines as l, i (l.id)}
            {@const e = estimates(l)}
            {@const surface = CHANNELS[l.channel].surface}
            <tr>
              <td class="muted">{i + 1}</td>
              <td>
                <select class="mp-in" value={l.channel} onchange={(ev) => setChannel(l, ev.currentTarget.value as ChannelId)} aria-label="Channel">
                  {#each Object.entries(CHANNELS) as [id, c] (id)}<option value={id}>{c.label}</option>{/each}
                </select>
              </td>
              <td>
                <input class="mp-in" bind:value={l.partner} list={surface ? `sellers-${surface}` : undefined} aria-label="Partner" />
              </td>
              <td><input class="mp-in wide-in" bind:value={l.tactic} aria-label="Tactic" /></td>
              <td><input class="mp-in wide-in" bind:value={l.targeting} aria-label="Targeting" /></td>
              <td><input class="mp-in" bind:value={l.kpi} aria-label="KPI" /></td>
              <td>
                <select class="mp-in" bind:value={l.buyType} aria-label="Buy type">
                  {#each BUY_TYPES as b (b)}<option value={b}>{b}</option>{/each}
                </select>
              </td>
              <td><input class="mp-in num rate" type="number" step="0.1" min="0" bind:value={l.rate} disabled={l.buyType === 'Flat' || l.buyType === 'TBD'} aria-label="Rate" /></td>
              <td><input class="mp-in num money" type="number" step="1000" min="0" bind:value={l.budget} aria-label="Net budget" /></td>
              <td class="r num">{totals.budget ? pct(l.budget / totals.budget, 1) : '—'}</td>
              <td class="r num">{e.impressions ? Math.round(e.impressions).toLocaleString('en-CA') : '—'}</td>
              <td class="r num">{e.clicks ? Math.round(e.clicks).toLocaleString('en-CA') : '—'}</td>
              <td><button class="mp-link" onclick={() => removeLine(i)} aria-label="Remove line">remove</button></td>
            </tr>
          {/each}
        </tbody>
        <tfoot>
          <tr>
            <td></td><td colspan="7">Total</td>
            <td class="r num">{cad(totals.budget)}</td>
            <td class="r num">100%</td>
            <td class="r num">{Math.round(totals.impressions).toLocaleString('en-CA')}</td>
            <td class="r num">{Math.round(totals.clicks).toLocaleString('en-CA')}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
    {#each ['sponsored_display', 'in_app', 'off_app', 'programmatic'] as s (s)}
      <datalist id={`sellers-${s}`}>{#each sellers(s as SurfaceId) as name (name)}<option value={name}></option>{/each}</datalist>
    {/each}
    <div class="row-end">
      <button onclick={addLine}>Add line</button>
      <span class={budgetOk ? 'mp-ok' : 'mp-bad'}>
        Check vs budget: {budgetOk ? 'OK' : `off by ${cad(totals.offBy)}`}
      </span>
    </div>
  </section>

  <section class="mp-card" data-tone={check && !check.deliverable ? 'bad' : undefined}>
    <h2>3 · Can the retail and publisher lines be delivered? <span class="live" class:on={checking}>{checking ? 'Jev re-evaluating…' : 'Up to date'}</span></h2>
    <p class="mp-note">
      Retail onsite, in-app and publisher deals are finite: the bar behind each line is what actually
      exists over this flight. Programmatic is not. CTV, social, search and audio are auctions, so they
      are not part of this check.
    </p>
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
    <ul class="places">
      {#each retail as l, i (l.id)}
        {@const s = planState?.placements?.[i]}
        {@const avail = s?.available_eur ?? 0}
        {@const cap = Math.max(avail * 1.6, l.budget * 1.2, 20000)}
        {@const surface = CHANNELS[l.channel].surface!}
        <li>
          <div class="ph">
            <span class="surf" data-s={surface}>{SURFACES[surface].short}</span>
            <strong>{l.partner || 'No seller chosen'}</strong>
            <span class="mp-muted">{l.tactic}</span>
            <span class="ask-amt">{cad(l.budget)}</span>
          </div>
          {#if s}
            <div class="track">
              <div class="avail" style:width={`${Math.min(100, (avail / cap) * 100)}%`}></div>
              <div class="ask" style:width={`${Math.min(100, (l.budget / cap) * 100)}%`} data-over={l.budget > avail && s.inventory_bounded}></div>
            </div>
            <p class="pm">
              {#if !s.inventory_bounded}
                programmatic, always available at about {cad(s.typical_cpa_eur ?? 0, 2)} per acquisition
              {:else if avail === 0}
                <span class="mp-bad">not a known seller for {SURFACES[surface].label.toLowerCase()}, so no inventory can be confirmed</span>
              {:else}
                available {cad(avail)} · asking {s.requested_over_available}×
                {#if s.shortfall_eur > 0}<span class="mp-bad">· {cad(s.shortfall_eur)} undeliverable</span>{/if}
              {/if}
            </p>
          {/if}
        </li>
      {/each}
    </ul>
    {#if planState?.undeliverable_eur > 0}
      <button class="mp-primary" onclick={applyFix}>Apply Jev's fix: cap finite lines, move {cad(planState.undeliverable_eur)} to programmatic</button>
    {/if}
  </section>

  <section class="mp-card" data-tone={coverage.ready ? 'ok' : 'alert'}>
    <h2>4 · Creative and language</h2>
    <p class="mp-note">
      Every retail and publisher surface needs an eligible asset in English and French. This is a gate,
      not a warning: the plan cannot be submitted without it.
    </p>
    <div class="drop">
      <input bind:this={fileInput} type="file" multiple accept="image/*,video/*,.json" onchange={onFiles} />
      <span>Add creative. Format is read from the image size; files ending in _fr are tagged French.</span>
    </div>
    <ul class="creatives">
      {#each doc.plan.creatives as c, i (c.id)}
        <li>
          <span class="fn">{c.filename}<small>{c.sizeKb}kb</small></span>
          <select class="mp-in" value={c.format} onchange={(e) => { c.format = e.currentTarget.value as CreativeFormat; c.eligibleSurfaces = FORMAT_SURFACES[c.format]; }} aria-label="Format">
            {#each FORMATS as f (f)}<option value={f}>{f}</option>{/each}
          </select>
          <select class="mp-in" bind:value={c.language} aria-label="Language">
            <option value="en">en</option><option value="fr-CA">fr-CA</option>
          </select>
          <span class="mp-muted el">{c.eligibleSurfaces.map((s) => SURFACES[s].short).join(', ')}</span>
          <button class="mp-link" onclick={() => doc.plan.creatives.splice(i, 1)}>remove</button>
        </li>
      {/each}
    </ul>
    <p class="cov" data-ok={coverage.ready}>
      {#if coverage.ready}
        Every requested surface is covered in {coverage.required.join(' and ')}.
      {:else}
        {#each coverage.gaps as g (g.language)}
          <span class="gap">Missing <strong>{g.language}</strong> creative for {g.surfaces.map((s) => SURFACES[s].label).join(', ')}.</span>
        {/each}
        {#if coverage.gaps.some((g) => g.language === 'fr-CA')}
          <span class="legal">French creative is a legal requirement for reaching Quebec under the Charter of the French Language, so these lines cannot run there as planned.</span>
        {/if}
      {/if}
    </p>
  </section>

  <section class="mp-card">
    <h2>5 · Notes and assumptions</h2>
    <ul class="mp-list">
      {#each doc.plan.notes as _, i (i)}
        <li>
          <textarea bind:value={doc.plan.notes[i]} rows="1" aria-label={`Note ${i + 1}`}></textarea>
          <button class="mp-link" onclick={() => doc.plan.notes.splice(i, 1)}>remove</button>
        </li>
      {/each}
    </ul>
    <button onclick={() => doc.plan.notes.push('')}>Add note</button>
  </section>

  <section class="mp-card">
    <h2>6 · Approval</h2>
    {#if trail.length}
      <ol class="trail">
        {#each trail as t, i (i)}<li><strong>{t.stage}</strong><span>{t.by}</span><span class="mp-muted">{t.note}</span></li>{/each}
      </ol>
    {/if}
    <div class="mp-actions">
      {#if status === 'draft'}
        <button class="mp-primary" disabled={!submittable}
          onclick={() => advance(approvals.internal ? 'pending_internal' : 'approved', 'Submitted', MANAGER.name, approvals.reason)}>
          Submit for approval
        </button>
        {#if !submittable}
          <span class="mp-warn small">
            {!budgetOk ? 'Blocked: line items do not add up to the budget.' : !check?.deliverable ? 'Blocked: the plan is not deliverable as written.' : 'Blocked: creative gap.'}
          </span>
        {/if}
      {:else if status === 'pending_internal'}
        <button class="mp-primary" onclick={() => advance(approvals.client ? 'pending_client' : 'approved', 'Internal approval', 'Trading Director', 'Deliverability verified against supply')}>Approve as Trading Director</button>
      {:else if status === 'pending_client'}
        <button class="mp-primary" onclick={() => advance('approved', 'Client approval', doc.plan.approval.name || plan.preparedFor, 'Plan and lever authority accepted')}>Record client approval</button>
      {:else if status === 'approved'}
        <button class="mp-primary" onclick={() => advance('live', 'Activated', 'Plumbline', 'Plan pushed to every platform. Nothing was re-keyed')}>Activate</button>
      {:else}
        <span class="mp-ok">Live.</span>
      {/if}
    </div>
    <div class="mp-grid" style="margin-top: 0.8rem">
      <label class="mp-field">Client approver name<input bind:value={doc.plan.approval.name} /></label>
      <label class="mp-field">Title<input bind:value={doc.plan.approval.title} /></label>
      <label class="mp-field">Date<input type="date" bind:value={doc.plan.approval.date} /></label>
    </div>
  </section>

  <div class="mp-next"><a class="next" href={`${base}/campaign/${page.params.id}/flowchart`}>Next: flight the budget by week →</a></div>
</div>

<style>
  .stepper { list-style: none; display: flex; gap: 0.3rem; padding: 0; margin: 0 0 1rem; flex-wrap: wrap; align-items: center; }
  .stepper li { display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.75rem; padding: 0.22rem 0.55rem; border-radius: 20px; background: var(--surface-2); color: var(--text-muted); border: 1px solid var(--border); }
  .stepper li.done { background: color-mix(in srgb, var(--good) 15%, transparent); color: var(--good-text); }
  .stepper li.on { background: var(--series-1); color: #fff; border-color: var(--series-1); font-weight: 600; }
  .sn { font-size: 0.64rem; font-weight: 700; }
  .stepper li.st { margin-left: auto; background: none; border: none; }

  .lines select { min-width: 9rem; }
  .lines .wide-in { min-width: 13rem; }
  .lines .rate { width: 5rem; }
  .lines .money { width: 7.5rem; }
  .lines input:not(.wide-in):not(.rate):not(.money) { min-width: 8rem; }
  .row-end { display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; margin-top: 0.7rem; font-size: 0.82rem; }

  .live { font-size: 0.68rem; font-weight: 500; color: var(--text-muted); padding: 0.15rem 0.5rem; border-radius: 20px; background: var(--surface-2); margin-left: 0.4rem; }
  .live.on { background: color-mix(in srgb, var(--series-1) 18%, transparent); color: var(--series-1); font-weight: 600; }

  .places { list-style: none; margin: 0.8rem 0; padding: 0; display: flex; flex-direction: column; gap: 0.6rem; }
  .places li { padding: 0.55rem 0.7rem; background: var(--surface-2); border-radius: 8px; }
  .ph { display: flex; align-items: baseline; gap: 0.5rem; flex-wrap: wrap; font-size: 0.8rem; }
  .ph strong { font-size: 0.86rem; }
  .ask-amt { margin-left: auto; font-variant-numeric: tabular-nums; font-weight: 600; }
  .surf { font-size: 0.62rem; font-weight: 700; padding: 0.1rem 0.32rem; border-radius: 4px; text-transform: uppercase; }
  .surf[data-s='sponsored_display'] { background: color-mix(in srgb, var(--series-1) 16%, transparent); color: var(--series-1); }
  .surf[data-s='in_app'] { background: color-mix(in srgb, var(--series-3) 18%, transparent); color: var(--series-3); }
  .surf[data-s='programmatic'] { background: color-mix(in srgb, var(--series-7) 16%, transparent); color: var(--series-7); }
  .surf[data-s='off_app'] { background: color-mix(in srgb, var(--series-4) 16%, transparent); color: var(--series-4); }
  .track { position: relative; height: 7px; background: var(--surface-3); border-radius: 4px; margin-top: 0.45rem; }
  .avail { position: absolute; inset: 0 auto 0 0; background: color-mix(in srgb, var(--good) 40%, transparent); border-radius: 4px; }
  .ask { position: absolute; top: 1px; bottom: 1px; left: 0; background: var(--series-1); border-radius: 3px; }
  .ask[data-over='true'] { background: var(--critical); }
  .pm { font-size: 0.73rem; color: var(--text-muted); margin: 0.3rem 0 0; font-variant-numeric: tabular-nums; }

  .drop { display: flex; align-items: center; gap: 0.8rem; flex-wrap: wrap; padding: 0.6rem 0.8rem; border: 1px dashed var(--axis); border-radius: 8px; margin-bottom: 0.7rem; }
  .drop span { font-size: 0.75rem; color: var(--text-muted); }
  .drop input { max-width: 100%; }
  .creatives { list-style: none; margin: 0 0 0.6rem; padding: 0; display: flex; flex-direction: column; gap: 3px; }
  .creatives li { display: grid; grid-template-columns: minmax(0, 1fr) 8.5rem 5.5rem minmax(0, 12rem) auto; gap: 0.5rem; align-items: center; padding: 0.3rem 0.5rem; background: var(--surface-2); border-radius: 6px; font-size: 0.78rem; }
  .fn { font-family: ui-monospace, monospace; font-size: 0.74rem; display: flex; flex-direction: column; overflow-wrap: anywhere; }
  .fn small { color: var(--text-muted); font-size: 0.66rem; }
  .el { font-size: 0.7rem; }
  .cov { font-size: 0.8rem; margin: 0; color: var(--critical); }
  .cov[data-ok='true'] { color: var(--good-text); }
  .gap { display: block; }
  .legal { display: block; margin-top: 0.3rem; font-weight: 600; }

  .trail { list-style: none; margin: 0 0 0.8rem; padding: 0; display: flex; flex-direction: column; gap: 0.3rem; }
  .trail li { display: grid; grid-template-columns: 11rem 12rem 1fr; gap: 0.6rem; font-size: 0.78rem; padding: 0.3rem 0.5rem; background: var(--surface-2); border-radius: 5px; }
  .small { font-size: 0.76rem; }
  .next { font-weight: 600; font-size: 0.9rem; }

  @media (max-width: 700px) {
    .creatives li { grid-template-columns: 1fr 1fr; }
    .trail li { grid-template-columns: 1fr; gap: 0.1rem; }
  }
</style>

<script lang="ts">
  // Cost per conversion by line, one bar each, against the target. A single series, so
  // there is no legend: bars at or under target are dark, bars over it are light.
  let { rows, target, unit }: { rows: { label: string; cpa: number }[]; target: number; unit: string } = $props();

  const sorted = $derived([...rows].sort((a, b) => a.cpa - b.cpa));
  const LABEL = 232;
  const W = 680;
  const ROW = 26;
  const plotW = W - LABEL - 70;
  const max = $derived(Math.max(target * 1.2, ...sorted.map((r) => r.cpa)));
  const niceMax = $derived(Math.ceil(max / 5) * 5);
  const x = (v: number) => LABEL + (v / niceMax) * plotW;
  const H = $derived(sorted.length * ROW + 40);
  const ticks = $derived(Array.from({ length: Math.floor(niceMax / 5) + 1 }, (_, i) => i * 5).filter((v, i, a) => a.length <= 11 || i % 2 === 0));
  const fmt = (v: number) => `CA$${v.toFixed(2)}`;
  const short = (s: string) => (s.length > 34 ? `${s.slice(0, 33)}…` : s);
</script>

<svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Cost per ${unit} by channel against a ${fmt(target)} target`}>
  {#each ticks as t (t)}
    <line x1={x(t)} x2={x(t)} y1="16" y2={H - 22} class="grid" />
    <text x={x(t)} y={H - 6} class="tick" text-anchor="middle">CA${t}</text>
  {/each}
  <line x1={x(target)} x2={x(target)} y1="8" y2={H - 22} class="target" />
  {#each sorted as r, i (r.label)}
    {@const y = 20 + i * ROW}
    <g class="row">
      <title>{r.label}: {fmt(r.cpa)} per {unit}, {r.cpa <= target ? 'at or under' : 'over'} the {fmt(target)} target</title>
      <rect x={LABEL} y={y - 2} width={plotW + 60} height={ROW} class="hit" />
      <text x={LABEL - 8} y={y + 12} class="label" text-anchor="end">{short(r.label)}</text>
      <path d={`M${LABEL},${y + 2} h${Math.max(0, x(r.cpa) - LABEL - 4)} a4,4 0 0 1 4,4 v10 a4,4 0 0 1 -4,4 h-${Math.max(0, x(r.cpa) - LABEL - 4)} z`}
        class:good={r.cpa <= target} class="bar" />
      <text x={x(r.cpa) + 5} y={y + 12} class="value">{fmt(r.cpa)}</text>
    </g>
  {/each}
  <text x={x(target) + 4} y="12" class="target-label">Target {fmt(target)}</text>
</svg>

<style>
  svg { width: 100%; height: auto; display: block; font-family: inherit; min-width: 100%; }
  .grid { stroke: #e3e5ea; stroke-width: 1; }
  .tick { font-size: 10px; fill: #6b7280; }
  .label { font-size: 11px; fill: #1f2937; }
  .value { font-size: 10.5px; fill: #1f2937; font-variant-numeric: tabular-nums; paint-order: stroke; stroke: #fff; stroke-width: 3px; stroke-linejoin: round; }
  .bar { fill: #9dbde6; }
  .bar.good { fill: #1c5cab; }
  .hit { fill: transparent; }
  .row:hover .bar { filter: brightness(0.92); }
  .row:hover .label { font-weight: 700; }
  .target { stroke: #d99a00; stroke-width: 2; stroke-dasharray: 4 3; }
  .target-label { font-size: 10.5px; font-weight: 700; fill: #0b2545; }
</style>

import { LEVERS, type LeverId } from '$lib/domain';
import { SURFACES, type SurfaceId } from '$lib/placements';
import { metrics, type Campaign } from '$lib/scenario/campaigns';
import { cadK, partnerName, type PacedLine } from './calc';

// A suggestion phrased as the thing that will happen, with the amount where there is
// one: "Move CA$76K to programmatic", not "spill_to_offsite on sponsored_display".
export function recommendation(c: Campaign, lever: LeverId, surface?: string): string {
  const m = metrics(c);
  const on = surface ? SURFACES[surface as SurfaceId]?.label.toLowerCase() : undefined;
  const line = surface ? c.lines.find((l) => l.surface === surface) : undefined;
  switch (lever) {
    case 'spill_to_offsite':
      return `Move ${cadK(m.underfillEur)} to programmatic`;
    case 'adjust_bid':
      return line && line.bidVsJustified > 1 ? `Lower the ${on} bid by ${Math.round((1 - 1 / line.bidVsJustified) * 100)}%` : `Adjust the ${on ?? 'line'} bid`;
    case 'swap_creative':
      return `Swap the ${on ?? ''} creative`.replace('  ', ' ');
    case 'shift_budget':
      return on ? `Move budget off ${on}` : 'Move budget to the cheaper lines';
    case 'expand_audience':
      return 'Widen the audience';
    case 'pause_placement':
      return on ? `Pause ${on}` : 'Pause the weakest placement';
    case 'escalate_to_client':
      return 'Ask the client about budget';
    default:
      return LEVERS[lever].label;
  }
}

// The same, for one line of a plan: "Widen the CTV audience", "Move budget off Meta".
export function lineRecommendation(r: PacedLine, lever: LeverId): string {
  const who = partnerName(r.line).replace(/^The /, '');
  switch (lever) {
    case 'expand_audience':
      return `Widen the ${who} audience`;
    case 'shift_budget':
      return r.status === 'Underpacing' ? `Move unspent ${who} budget to other lines` : `Move budget off ${who}`;
    case 'adjust_bid':
      return r.status === 'Underpacing' ? `Raise the ${who} bid` : `Lower the ${who} bid`;
    case 'swap_creative':
      return `Swap the ${who} creative`;
    case 'pause_placement':
      return `Pause ${who}`;
    case 'escalate_to_client':
      return 'Ask the client';
    default:
      return LEVERS[lever].label;
  }
}

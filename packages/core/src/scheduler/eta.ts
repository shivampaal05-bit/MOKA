import { MIN, type Quote } from '../types.ts';
/** ETA range. P80/P90 are starting multipliers until real percentiles exist (docs/ASSUMPTIONS.md). */
export function makeQuote(p50: number, now: number, from: number): Quote {
  const span = Math.max(0, p50 - now);
  const p80 = p50 + Math.max(1 * MIN, 0.2 * span);
  const p90 = p50 + Math.max(1.5 * MIN, 0.35 * span);
  const lo = Math.max(0, Math.ceil((p50 - from) / MIN));
  let hi = Math.ceil((p80 - from) / MIN); if (hi < lo + 2) hi = lo + 2; // never narrower than 2 minutes
  return { p50, p80, p90, lo, hi };
}
export const ceilToStep = (t: number, stepMin: number) => Math.ceil(t / (stepMin * MIN)) * stepMin * MIN;

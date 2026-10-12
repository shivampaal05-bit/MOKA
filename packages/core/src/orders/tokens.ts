import type { Mode } from '../types.ts';
const PREFIX: Record<Mode, string> = { PREORDER: 'P', DINE_IN: 'T', TAKEAWAY: 'W' };
/** Tokens are P-001 / T-001 / W-001, unique per business day, reset at day close. Offline devices use a device series (W-A07). */
export class TokenIssuer {
  private seq: Record<string, number> = {};
  constructor(snapshot?: Record<string, number>) { if (snapshot) this.seq = { ...snapshot }; }
  next(mode: Mode, deviceSeries?: string): string {
    const p = PREFIX[mode] + (deviceSeries ? '-' + deviceSeries : '');
    const n = (this.seq[p] = (this.seq[p] ?? 0) + 1);
    return `${PREFIX[mode]}-${deviceSeries ?? ''}${String(n).padStart(deviceSeries ? 2 : 3, '0')}`;
  }
  reset() { this.seq = {}; }
  snapshot() { return { ...this.seq }; }
}

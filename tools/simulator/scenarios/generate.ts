import type { SimOrder } from '../harness.ts';
import { MENU } from '@queuebite/core';
// Seeded generator so results are reproducible.
function rng(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }
const W: Record<string, number> = { burger: .25, fries: .25, chilli_potato: .1, chowmein: .1, chai: .15, chaat: .15 };
export function burst(n: number, spanMin: number, seed: number, preShare = 0.4): SimOrder[] {
  const r = rng(seed); const ids = Object.keys(W); const out: SimOrder[] = [];
  for (let i = 0; i < n; i++) {
    const items = new Map<string, number>(); const lines = [1, 2, 2, 3][Math.floor(r() * 4)];
    for (let k = 0; k < lines; k++) { let x = r(), id = ids[0]; for (const j of ids) { x -= W[j]; if (x <= 0) { id = j; break; } } items.set(id, (items.get(id) ?? 0) + [1, 1, 2][Math.floor(r() * 3)]); }
    const pre = r() < preShare; const atMin = +(r() * spanMin).toFixed(2); const mode = pre ? 'PREORDER' : r() < 0.5 ? 'DINE_IN' : 'TAKEAWAY';
    out.push({ atMin, label: `O${i + 1}`, input: { channel: pre ? 'APP' : 'COUNTER', mode, table: mode === 'DINE_IN' ? String(1 + Math.floor(r() * 8)) : undefined, distanceKm: pre ? +(0.5 + r() * 1.5).toFixed(1) : undefined,
      slotInMin: pre ? 16 + Math.floor(r() * 7) : undefined, customer: { name: 'C' + i, phone: '98765' + String(10000 + i) }, items: [...items].map(([menuItemId, qty]) => ({ menuItemId, qty })) } });
  }
  void MENU; return out.sort((a, b) => a.atMin - b.atMin);
}

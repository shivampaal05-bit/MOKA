import { replay, type SimResult } from './harness.ts'; import { fourCustomers } from './scenarios/four-customers.ts'; import { burst } from './scenarios/generate.ts';
import { STATIONS } from '@queuebite/core';
const policies = ['fifo', 'deadline', 'smart'] as const;
const arg = process.argv[2] ?? 'all';
function table(title: string, res: SimResult[]) {
  console.log(`\n=== ${title} ===`);
  console.log('policy     admitted rejected  presentMean  P50   P90   preIdleAvg preLate holdViol lastReady(min)');
  for (const r of res) { const m = r.metrics; console.log(`${r.policy.padEnd(10)} ${String(r.admitted).padStart(8)} ${String(r.rejected).padStart(8)}  ${String(m.presentMean).padStart(10)} ${String(m.presentP50.toFixed(1)).padStart(5)} ${String(m.presentP90.toFixed(1)).padStart(5)} ${String(m.preorderIdleAvg).padStart(10)} ${String(m.preorderLate).padStart(7)} ${String(m.holdViolations).padStart(8)} ${m.lastReadyMin.toFixed(1).padStart(14)}`); }
}
if (arg === 'all' || arg === 'four') {
  const rs = policies.map(p => replay(fourCustomers, p)); table('Four customers (1 km main course, 500 m 5 burgers, seated, standing)', rs);
  for (const r of rs) { console.log(`\n${r.policy}:`); for (const x of r.rows) console.log(`  ${x.label.padEnd(20)} ${x.token.padEnd(6)} ready +${x.readyMin?.toFixed(1)} min  (waited ${x.waitMin?.toFixed(1)}; slot/deadline +${x.deadlineMin.toFixed(1)}${x.idleMin != null ? '; food idle ' + x.idleMin.toFixed(1) : ''})`); }
}
if (arg === 'all' || arg === 'burst') for (const seed of [7, 8, 9]) table(`20 orders in 5 minutes (seed ${seed})`, policies.map(p => replay(burst(20, 5, seed), p)));
if (arg === 'all' || arg === 'surge') { table('100 orders in 1 minute (admission control on)', policies.map(p => replay(burst(100, 1, 3), p, { maxMin: 240 }))); }
void STATIONS;

import type { SimOrder } from '../harness.ts';
const c = (n: string) => ({ name: n, phone: '9876543210' });
/** The user's problem: 1 km main course + 500 m 5 burgers + seated 2 burgers/cold drink/coffee + standing burger & fries */
export const fourCustomers: SimOrder[] = [
  { atMin: 0, label: 'A 1km main course', arriveAtMin: undefined, input: { channel: 'WHATSAPP', mode: 'PREORDER', customer: c('A'), distanceKm: 1, slotInMin: 15, items: [{ menuItemId: 'chowmein', qty: 1 }] } },
  { atMin: 1, label: 'B 500m 5 burgers', input: { channel: 'APP', mode: 'PREORDER', customer: c('B'), distanceKm: 0.5, slotInMin: 15, items: [{ menuItemId: 'burger', qty: 5 }] } },
  { atMin: 2, label: 'C seated', input: { channel: 'QR', mode: 'DINE_IN', table: '4', customer: c('C'), items: [{ menuItemId: 'burger', qty: 2 }, { menuItemId: 'cold_drink', qty: 1 }, { menuItemId: 'coffee', qty: 1 }] } },
  { atMin: 3, label: 'D standing', input: { channel: 'COUNTER', mode: 'TAKEAWAY', customer: c('D'), items: [{ menuItemId: 'burger', qty: 1 }, { menuItemId: 'fries', qty: 1 }] } },
];

import type { CreateOrderInput } from '@queuebite/core';
const c = (n: string) => ({ name: n, phone: '9876543210' });
/** Demo scenarios the owner screen can load into the live kitchen. */
export const SCENARIOS: Record<string, { title: string; orders: { atMin: number; input: CreateOrderInput; pay?: boolean }[] }> = {
  four: { title: 'Four customers: 1 km main course · 500 m 5 burgers · seated · standing', orders: [
    { atMin: 0, input: { channel: 'WHATSAPP', mode: 'PREORDER', customer: c('A (1 km)'), distanceKm: 1, slotInMin: 15, items: [{ menuItemId: 'chowmein', qty: 1 }] } },
    { atMin: 1, input: { channel: 'APP', mode: 'PREORDER', customer: c('B (500 m)'), distanceKm: 0.5, slotInMin: 15, items: [{ menuItemId: 'burger', qty: 5 }] } },
    { atMin: 2, input: { channel: 'QR', mode: 'DINE_IN', table: '4', customer: c('C (seated)'), items: [{ menuItemId: 'burger', qty: 2 }, { menuItemId: 'cold_drink', qty: 1 }, { menuItemId: 'coffee', qty: 1 }] } },
    { atMin: 3, input: { channel: 'COUNTER', mode: 'TAKEAWAY', customer: c('D (standing)'), items: [{ menuItemId: 'burger', qty: 1 }, { menuItemId: 'fries', qty: 1 }] } }] },
};

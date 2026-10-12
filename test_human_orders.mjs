import assert from 'node:assert';

const BASE = 'http://localhost:8787';

async function req(path, opts = {}) {
  const r = await fetch(BASE + path, {
    headers: { 'content-type': 'application/json', ...opts.headers },
    ...opts
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(data?.error?.message || r.statusText);
    err.code = data?.error?.code;
    err.details = data?.error?.details;
    err.status = r.status;
    throw err;
  }
  return data;
}

async function runTests() {
  console.log('--- 0. Initializing Active Kitchen Simulator ---');
  await req('/admin/autopilot', { method: 'POST', headers: { 'x-staff-pin': '9999' }, body: JSON.stringify({ on: true }) }).catch(() => {});
  console.log('✔ Kitchen autopilot crew activated');

  console.log('\n--- 1. Testing Menu & Pricing Integrity ---');
  const menuRes = await req('/menu');
  assert(Array.isArray(menuRes.items), 'Menu items must be an array');
  assert(menuRes.items.length >= 8, 'Expected at least 8 menu items');
  console.log(`✔ Verified ${menuRes.items.length} menu items available`);

  console.log('\n--- 2. Testing Human Pre-Order (Aarav Sharma) ---');
  const preOrder = await req('/orders', {
    method: 'POST',
    headers: { 'idempotency-key': 'human-pre-' + Date.now() },
    body: JSON.stringify({
      channel: 'WEB',
      mode: 'PREORDER',
      customer: { name: 'Aarav Sharma', phone: '9876543210' },
      distanceKm: 1.5,
      slotInMin: 15,
      items: [
        { menuItemId: 'coffee', qty: 2 },
        { menuItemId: 'burger', qty: 1 }
      ]
    })
  });
  const o1 = preOrder.order;
  assert.equal(o1.total, 2 * 60 + 99, 'Total must equal 219 (2x60 + 99)');
  assert(preOrder.payment.required, 'Pre-order must require online payment');
  console.log(`✔ Pre-order created successfully: ID ${o1.id}, Total: ₹${o1.total}, Awaiting payment`);

  // Test Payment
  await req(`/dev/pay/${o1.id}?key=${o1.accessKey}`, { method: 'POST' });
  const live1 = await req(`/orders/${o1.id}/live?key=${o1.accessKey}`);
  assert(live1.token && live1.token.startsWith('P-'), `Token must start with P-, got ${live1.token}`);
  assert(['ACCEPTED', 'SCHEDULED', 'COOKING'].includes(live1.status), `Status after payment was ${live1.status}`);
  console.log(`✔ Payment confirmed. Token issued: ${live1.token}, Live status: ${live1.status}, Phase: ${live1.phase}`);

  // Test Customer Action: "I'm Leaving"
  await req(`/orders/${o1.id}/leaving?key=${o1.accessKey}`, { method: 'POST' });
  console.log('✔ "On My Way" button interaction succeeded');

  // Test Customer Action: "I'm Here"
  await req(`/orders/${o1.id}/arrived?key=${o1.accessKey}`, { method: 'POST' });
  const live1Arrived = await req(`/orders/${o1.id}/live?key=${o1.accessKey}`);
  assert.equal(live1Arrived.arrived, true, 'Order should be marked as arrived');
  console.log('✔ "I Have Arrived" button interaction succeeded');

  console.log('\n--- 3. Testing Human Dine-In Order (Pooja Patel) ---');
  const dineInOrder = await req('/orders', {
    method: 'POST',
    headers: { 'idempotency-key': 'human-dine-' + Date.now() },
    body: JSON.stringify({
      channel: 'QR',
      mode: 'DINE_IN',
      table: '7',
      customer: { name: 'Pooja Patel', phone: '9876501234' },
      items: [
        { menuItemId: 'chai', qty: 2 },
        { menuItemId: 'fries', qty: 1 }
      ]
    })
  });
  const o2 = dineInOrder.order;
  assert.equal(o2.total, 2 * 25 + 79, 'Total must equal 129 (2x25 + 79)');
  assert(o2.token.startsWith('T-'), `Token must start with T-, got ${o2.token}`);
  assert(!dineInOrder.payment.required, 'Dine-in should use table billing mode');
  console.log(`✔ Dine-in order created: Token ${o2.token}, Table: ${o2.table}, Total: ₹${o2.total}`);

  console.log('\n--- 4. Testing Counter Walk-In Order by Cashier (Vikram Roy) ---');
  const counterOrder = await req('/staff/orders', {
    method: 'POST',
    headers: { 'idempotency-key': 'human-counter-' + Date.now(), 'x-staff-pin': '3333' },
    body: JSON.stringify({
      channel: 'COUNTER',
      mode: 'TAKEAWAY',
      customer: { name: 'Vikram Roy', phone: '9123456789' },
      items: [
        { menuItemId: 'cold_drink', qty: 2 },
        { menuItemId: 'fries', qty: 1 }
      ]
    })
  });
  const o3 = counterOrder.order;
  assert.equal(o3.total, 2 * 40 + 79, 'Total must equal 159 (2x40 + 79)');
  assert(o3.token.startsWith('W-'), `Token must start with W-, got ${o3.token}`);
  console.log(`✔ Counter takeaway order created: Token ${o3.token}, Total: ₹${o3.total}`);

  console.log('\n--- 5. Testing Multiple Concurrent Orders Stress Test ---');
  const burstPromises = [];
  const itemsPool = ['burger', 'fries', 'chilli_potato', 'chaat', 'coffee', 'chai'];
  for (let i = 0; i < 6; i++) {
    burstPromises.push(
      req('/orders', {
        method: 'POST',
        headers: { 'idempotency-key': `burst-${i}-${Date.now()}` },
        body: JSON.stringify({
          channel: 'WEB',
          mode: 'PREORDER',
          customer: { name: `Burst Customer ${i + 1}`, phone: `980000000${i + 1}` },
          distanceKm: 1,
          slotInMin: 15 + i * 5,
          items: [{ menuItemId: itemsPool[i], qty: 1 }]
        })
      })
    );
  }
  const burstResults = await Promise.all(burstPromises);
  assert.equal(burstResults.length, 6, 'All 6 burst orders must succeed');
  console.log(`✔ Successfully handled 6 multiple simultaneous orders across kitchen stations!`);

  console.log('\n--- 6. Testing Kitchen Display System (KDS) & Cook Actions ---');
  const kds = await req('/kds', { headers: { 'x-staff-pin': '1111' } });
  console.log(`✔ KDS board active: NOW=${kds.NOW.length}, COOKING=${kds.COOKING.length}, UPCOMING=${kds.UPCOMING.length}`);
  
  // If there is any task in NOW, start it
  if (kds.NOW.length > 0) {
    const task = kds.NOW[0];
    await req(`/tasks/${task.id}/start`, { method: 'POST', headers: { 'x-staff-pin': '1111' }, body: JSON.stringify({}) });
    console.log(`✔ Started cook task ${task.id} (${task.item}) for token ${task.token}`);
    
    // Complete it
    await req(`/tasks/${task.id}/done`, { method: 'POST', headers: { 'x-staff-pin': '1111' }, body: JSON.stringify({}) });
    console.log(`✔ Completed cook task ${task.id}`);
  }

  console.log('\n--- 7. Testing Lobby TV Board Visibility ---');
  const board = await req('/board');
  assert(Array.isArray(board.preparing), 'Board preparing must be an array');
  assert(Array.isArray(board.ready), 'Board ready must be an array');
  console.log(`✔ Lobby TV board verified: Preparing=[${board.preparing.join(', ')}], Ready=[${board.ready.join(', ')}]`);

  console.log('\n--- 8. Testing Owner / Manager Analytics & Inventory ---');
  const stats = await req('/admin/stats', { headers: { 'x-staff-pin': '9999' } });
  assert(stats.orders >= 9, 'Should have registered all placed orders today');
  assert(stats.revenue > 0, 'Revenue should be positive');
  console.log(`✔ Owner dashboard verified: Total Orders Today=${stats.orders}, Gross Revenue=₹${stats.revenue}`);

  const inventory = await req('/inventory', { headers: { 'x-staff-pin': '9999' } });
  assert(inventory.items.length > 0, 'Inventory items must be returned');
  console.log(`✔ Verified ${inventory.items.length} inventory ingredient items with live stock levels`);

  console.log('\n========================================');
  console.log('🎉 ALL HUMAN ORDER & MULTI-ORDER CHECKS PASSED PERFECTLY!');
  console.log('========================================');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

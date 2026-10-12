export const PIN_KEY = 'qb_pin';
export const getPin = () => sessionStorage.getItem(PIN_KEY) || '';
export const setPin = p => sessionStorage.setItem(PIN_KEY, p);
export const idem = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());

export async function api(path, { method = 'GET', body, pin, key, headers = {} } = {}) {
  const h = { 'content-type': 'application/json', ...headers };
  if (pin) h['x-staff-pin'] = pin;
  if (key) h['x-order-key'] = key;
  const r = await fetch(path, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(data?.error?.message || r.statusText);
    e.code = data?.error?.code;
    e.details = data?.error?.details;
    e.status = r.status;
    throw e;
  }
  return data;
}

export const rs = n => '₹' + n;
export const hhmm = ms => new Date(ms).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });
export const mmss = ms => {
  const s = Math.max(0, Math.round(ms / 1000));
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
};
export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function nav(active) {
  const links = [
    ['index.html', 'Order'],
    ['kds.html', 'Kitchen'],
    ['counter.html', 'Counter'],
    ['owner.html', 'Owner'],
    ['tv.html', 'Lobby Board']
  ];

  return `
  <header class="top">
    <a href="index.html" class="brand-wrap" style="text-decoration:none">
      <div style="height:42px;display:flex;align-items:center">
        <svg height="38" viewBox="0 0 365 60" fill="none" style="display:block">
          <!-- M -->
          <path d="M 8 46 L 8 14 L 12 14 L 27 38 L 41 14 L 45 14 L 45 46 L 39 46 L 39 21 L 28 41 L 25 41 L 14 21 L 14 46 Z" fill="#F5EFE8"/>
          <!-- O (Coffee Bean) -->
          <g transform="translate(72, 30)">
            <ellipse cx="0" cy="0" rx="19" ry="17" fill="#F5EFE8"/>
            <ellipse cx="0" cy="0" rx="11" ry="13" fill="#654765" transform="rotate(-15)"/>
            <path d="M -3 -11 C -1 -5, 2 -1, 1 3 C 0 7, -2 10, 0 12" stroke="#F5EFE8" stroke-width="2.2" stroke-linecap="round" fill="none" transform="rotate(-15)"/>
          </g>
          <!-- K -->
          <g transform="translate(106, 14)">
            <rect x="0" y="0" width="6.5" height="32" fill="#F5EFE8"/>
            <path d="M 6 18 L 22 0 L 30 0 L 10 20 Z" fill="#F5EFE8"/>
            <path d="M 7 17 L 23 32 L 31 32 C 27 29, 19 22, 14 17 Z" fill="#F5EFE8"/>
          </g>
          <!-- A -->
          <g transform="translate(152, 14)">
            <path d="M 16 0 L 0 32 L 6.5 32 L 13 15 L 25 15 L 29 25 C 31 29, 35 31, 40 32 L 41 32 C 36 31, 33 28, 30 24 L 19 0 Z" fill="#F5EFE8"/>
            <rect x="10" y="21" width="17" height="2.5" fill="#F5EFE8"/>
          </g>
          <!-- Separator Line -->
          <line x1="206" y1="14" x2="206" y2="46" stroke="#C6A77E" stroke-width="1" stroke-opacity="0.5"/>
          <!-- Taglines -->
          <text x="218" y="28" font-family="'Playfair Display', Georgia, serif" font-size="15" font-style="italic" font-weight="600" fill="#C6A77E">Your Daily Fix</text>
          <text x="219" y="44" font-family="'Plus Jakarta Sans', sans-serif" font-size="7.5" font-weight="700" letter-spacing="1.1" fill="#BFA9C7">CRAFTED COFFEE • FRESH BAKES</text>
        </svg>
      </div>
    </a>
    <nav>
      ${links.map(([h, t]) => `<a href="${h}" class="${h === active ? 'on' : ''}">${t}</a>`).join('')}
    </nav>
  </header>`;
}

export function footer() {
  return `
  <footer class="brand-footer">
    <div class="moka-sub">MOKA · Your Daily Fix</div>
    <div class="moka-desc">Crafted Coffee • Fresh Bakes • All Day, All Night</div>
  </footer>`;
}

export function pinGate(role, onReady) {
  const pin = getPin();
  if (pin) return onReady(pin);
  document.body.insertAdjacentHTML('beforeend', `
    <div class="wrap narrow" style="margin-top:30px">
      <div class="card elevated" style="text-align:center;padding:32px 24px">
        <div style="width:52px;height:52px;border-radius:50%;background:var(--color-secondary-tint);border:1px solid var(--color-accent);margin:0 auto 14px;display:flex;align-items:center;justify-content:center">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#654765" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
        </div>
        <h2 style="margin-bottom:6px">${role} Staff Sign-In</h2>
        <p class="mute" style="font-size:13px;max-width:400px;margin:0 auto 16px">Enter your staff PIN to access this terminal. For testing, choose from the quick demo presets below.</p>
        
        <div style="background:var(--color-surface-warm);padding:10px;border-radius:var(--radius-sm);border:1px solid var(--color-line);margin-bottom:16px;font-size:12px;color:var(--color-ink-muted)">
          <div style="font-weight:700;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.05em;color:var(--color-primary)">Demo PIN Directory</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center">
            <span class="pill" style="cursor:pointer" onclick="document.getElementById('pin').value='1111'">Cook: 1111</span>
            <span class="pill" style="cursor:pointer" onclick="document.getElementById('pin').value='2222'">Expo: 2222</span>
            <span class="pill" style="cursor:pointer" onclick="document.getElementById('pin').value='3333'">Cashier: 3333</span>
            <span class="pill" style="cursor:pointer" onclick="document.getElementById('pin').value='4444'">Waiter: 4444</span>
            <span class="pill" style="cursor:pointer" onclick="document.getElementById('pin').value='9999'">Manager: 9999</span>
          </div>
        </div>

        <div style="max-width:280px;margin:0 auto">
          <input id="pin" type="password" inputmode="numeric" placeholder="Enter PIN (e.g. 1111)" style="text-align:center;font-size:18px;letter-spacing:4px">
          <div class="row" style="margin-top:14px">
            <button id="go" style="width:100%">Sign In</button>
          </div>
        </div>
      </div>
    </div>`);
  document.getElementById('go').onclick = () => {
    const v = document.getElementById('pin').value.trim();
    if (v) {
      setPin(v);
      location.reload();
    }
  };
  document.getElementById('pin').focus();
  document.getElementById('pin').onkeydown = e => {
    if (e.key === 'Enter') document.getElementById('go').click();
  };
}

export function liveStream(url, onTick) {
  try {
    const es = new EventSource(url);
    es.addEventListener('event', onTick);
    es.addEventListener('snapshot', onTick);
    es.onerror = () => {};
    return es;
  } catch {
    return null;
  }
}

/** Staff API call: sends the PIN; a 401 clears it and shows the sign-in again. */
export async function sapi(path, opts = {}) {
  try {
    return await api(path, { ...opts, pin: getPin() });
  } catch (e) {
    if (e.status === 401) {
      sessionStorage.removeItem(PIN_KEY);
      location.reload();
    }
    throw e;
  }
}

export const signOut = () => {
  sessionStorage.removeItem(PIN_KEY);
  location.reload();
};

export const toast = (msg, kind = 'ok') => {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:999;max-width:92vw';
    document.body.appendChild(t);
  }
  t.innerHTML = `<div class="${kind === 'ok' ? 'ok' : 'err'}" style="box-shadow:0 6px 24px rgba(74,50,74,.25);border-radius:12px">${esc(msg)}</div>`;
  clearTimeout(t._h);
  t._h = setTimeout(() => (t.innerHTML = ''), 3500);
};

export const poll = (fn, ms) => {
  let busy = false;
  const run = async () => {
    if (busy) return;
    busy = true;
    try {
      await fn();
    } catch (e) {
      if (e.status !== 401) console.warn(e.message);
    }
    busy = false;
  };
  run();
  return setInterval(run, ms);
};

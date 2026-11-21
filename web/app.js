// CloudDraw client: plain ES modules, no build step.
const $ = (s) => document.querySelector(s);
const WS_URL = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
const COLORS = ['#23224d', '#7d7d96', '#ff4f8b', '#ff8a3d', '#ffd43b', '#2fd6a0', '#27b5e8', '#3f6fe0', '#6b5bff', '#a8672f'];
const SIZES = [4, 10, 22]; // in canvas units (canvas is 800 x 600)
const AVATAR_BG = ['#ffd43b', '#2fd6a0', '#ff9dbd', '#9ad7ff', '#c9bcff', '#ffb98a'];
const AVATAR_ACC = ['leaf', 'beret', 'headband', 'glasses', 'pencil'];
const AVATAR_MOUTH = ['smile', 'grin', 'o', 'tongue', 'flat'];
// TeayRub character: a leaf-shaped body with a face. Accessories are our own shapes.
const INK = '#23224d';
function avatarSvg(bg, acc = 'leaf', mouth = 'smile') {
  const accessory = {
    leaf: `<path d="M24 9 C25 3 31 1 35 3 C34 8 29 10 24 9 Z" fill="#2fd6a0" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`,
    beret: `<ellipse cx="25" cy="10" rx="11" ry="4.5" fill="#6b5bff" stroke="${INK}" stroke-width="2.5"/><circle cx="25" cy="5.5" r="1.6" fill="${INK}"/>`,
    headband: `<path d="M11 15 Q24 9 37 15" fill="none" stroke="#ff4f8b" stroke-width="4" stroke-linecap="round"/>`,
    glasses: `<circle cx="18" cy="25" r="4.6" fill="#fff" stroke="${INK}" stroke-width="2.5"/><circle cx="30" cy="25" r="4.6" fill="#fff" stroke="${INK}" stroke-width="2.5"/><line x1="22.6" y1="25" x2="25.4" y2="25" stroke="${INK}" stroke-width="2.5"/>`,
    pencil: `<rect x="35" y="8" width="4.5" height="15" rx="1" fill="#ffd43b" stroke="${INK}" stroke-width="2.2" transform="rotate(22 37 15)"/>`,
  }[acc] ?? '';
  const eyes = acc === 'glasses'
    ? `<circle cx="18" cy="25" r="1.7" fill="${INK}"/><circle cx="30" cy="25" r="1.7" fill="${INK}"/>`
    : `<circle cx="18" cy="25" r="2.6" fill="${INK}"/><circle cx="30" cy="25" r="2.6" fill="${INK}"/><circle cx="18.9" cy="24.1" r=".9" fill="#fff"/><circle cx="30.9" cy="24.1" r=".9" fill="#fff"/>`;
  const mouths = {
    smile: `<path d="M19 33 Q24 38 29 33" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>`,
    grin: `<path d="M18 32 Q24 42 30 32 Z" fill="#fff" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`,
    o: `<circle cx="24" cy="34" r="2.8" fill="${INK}"/>`,
    tongue: `<path d="M19 33 Q24 38 29 33" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/><path d="M21.5 35 Q24 40 26.5 35 Z" fill="#ff4f8b" stroke="${INK}" stroke-width="1.8"/>`,
    flat: `<line x1="20" y1="34" x2="28" y2="34" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>`,
  };
  const cheeks = `<ellipse cx="14" cy="32" rx="2.4" ry="1.6" fill="#ff4f8b" opacity=".55"/><ellipse cx="34" cy="32" rx="2.4" ry="1.6" fill="#ff4f8b" opacity=".55"/>`;
  return `<svg viewBox="0 0 48 48" width="100%" height="100%" aria-hidden="true"><path d="M24 4 C38 12 40 30 36 40 C33 45 29 46 24 46 C19 46 15 45 12 40 C8 30 10 12 24 4 Z" fill="${bg}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>${accessory}${eyes}${cheeks}${mouths[mouth] ?? mouths.smile}</svg>`;
}

// ------------------------------------------------------------------ identity
const ls = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};
const ss = {
  get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* */ } },
  del: (k) => { try { sessionStorage.removeItem(k); } catch { /* */ } },
};
// getRandomValues works on plain-http LAN addresses too (randomUUID does not).
const randomId = () => [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
let playerId = ss.get('cd_id');
if (!playerId) { playerId = randomId(); ss.set('cd_id', playerId); }

// ------------------------------------------------------------------ state
const S = {
  ws: null, code: null, name: '', joined: false, leaving: false, retries: 0, retryTimer: null,
  phase: 'LOBBY', turn: 0, totalTurns: 0, round: 1, rounds: 1, drawerId: null,
  hint: '', word: null, endsAt: 0, drawMs: 0, offset: 0, players: [], guessed: false,
  color: COLORS[0], size: SIZES[1], eraser: false,
  avatar: ls.get('tr_avatar') || `${AVATAR_BG[0]}|leaf|smile`,
};
const nowMs = () => Date.now() + S.offset;
const canDraw = () => S.phase === 'DRAWING' && S.drawerId === playerId;
const nameOf = (id) => S.players.find((p) => p.id === id)?.name || 'Someone';

async function api(path, body) {
  const res = await fetch(path, body === undefined ? undefined : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 3200);
}

// ------------------------------------------------------------------ home screen
function readName() {
  const name = $('#name').value.trim();
  if (!name) { toast('Pick a name first.'); $('#name').focus(); return null; }
  ls.set('cd_name', name);
  return name;
}
$('#name').value = ls.get('cd_name') || '';
function renderAvatarPicker() {
  const [curBg, curAcc, curMouth] = S.avatar.split('|');
  const prev = $('#avatar-preview');
  prev.style.background = 'transparent';
  prev.style.border = 'none';
  prev.innerHTML = avatarSvg(curBg || AVATAR_BG[0], curAcc || 'leaf', curMouth || 'smile');
}
const step = (arr, cur, d) => arr[(arr.indexOf(cur) + d + arr.length) % arr.length];
const setAv = (bg, acc, m) => { S.avatar = `${bg}|${acc}|${m}`; ls.set('tr_avatar', S.avatar); renderAvatarPicker(); };
$('#av-acc-prev').onclick = () => { const [b, a, m] = S.avatar.split('|'); setAv(b, step(AVATAR_ACC, a, -1), m); };
$('#av-acc-next').onclick = () => { const [b, a, m] = S.avatar.split('|'); setAv(b, step(AVATAR_ACC, a, 1), m); };
$('#av-mouth-prev').onclick = () => { const [b, a, m] = S.avatar.split('|'); setAv(b, a, step(AVATAR_MOUTH, m, -1)); };
$('#av-mouth-next').onclick = () => { const [b, a, m] = S.avatar.split('|'); setAv(b, a, step(AVATAR_MOUTH, m, 1)); };
$('#av-color-prev').onclick = () => { const [b, a, m] = S.avatar.split('|'); setAv(step(AVATAR_BG, b, -1), a, m); };
$('#av-color-next').onclick = () => { const [b, a, m] = S.avatar.split('|'); setAv(step(AVATAR_BG, b, 1), a, m); };
$('#name').addEventListener('input', renderAvatarPicker);
renderAvatarPicker();
if (/^#[A-Za-z0-9]{5}$/.test(location.hash)) $('#code').value = location.hash.slice(1).toUpperCase();

$('#btn-create').onclick = async () => {
  const name = readName();
  if (!name) return;
  try { joinRoom((await api('/api/rooms', {})).code, name); } catch (e) { toast(e.message); }
};
$('#btn-join').onclick = () => {
  const name = readName();
  if (!name) return;
  const code = $('#code').value.trim().toUpperCase();
  if (code.length !== 5) return toast('Room codes have 5 characters.');
  joinRoom(code, name);
};
$('#code').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#btn-join').click(); });

// ------------------------------------------------------------------ play alone
// Players without a room wait in a queue; the server groups them with other waiting players.
const SOLO_IDLE = 'Play alone with random players';
const soloBtn = $('#btn-solo');
let soloName = null;   // set while searching; also means "searching"
let soloTimer = null;
function endSolo() {
  soloName = null;
  clearTimeout(soloTimer);
  soloTimer = null;
  soloBtn.textContent = SOLO_IDLE;
}
async function pollSolo() {
  if (!soloName) return;
  try {
    const res = await api('/api/solo', { playerId });
    if (!soloName) return; // cancelled while the request was in flight
    if (res.code) {
      const name = soloName;
      endSolo();
      joinRoom(res.code, name);
      return;
    }
    soloTimer = setTimeout(pollSolo, 2000);
  } catch (e) {
    endSolo();
    toast(e.message);
  }
}
soloBtn.onclick = () => {
  if (soloName) {
    endSolo();
    api('/api/solo/cancel', { playerId }).catch(() => {});
    return;
  }
  const name = readName();
  if (!name) return;
  soloName = name;
  soloBtn.textContent = 'Looking for players… tap to cancel';
  toast('Looking for other players who want to play alone.');
  pollSolo();
};

// ------------------------------------------------------------------ connection
function joinRoom(code, name) {
  Object.assign(S, { code, name, joined: false, leaving: false, retries: 0, phase: 'LOBBY', players: [], drawerId: null, word: null, hint: '' });
  ss.set('cd_room', code);
  location.hash = code;
  $('#home').hidden = true;
  $('#game').hidden = false;
  $('#room-code').textContent = code;
  $('#log').replaceChildren();
  clearCanvas();
  renderAll();
  connect();
}

function leave() {
  S.leaving = true;
  clearTimeout(S.retryTimer);
  S.ws?.close();
  ss.del('cd_room');
  history.replaceState(null, '', location.pathname);
  $('#banner').hidden = true;
  $('#game').hidden = true;
  $('#home').hidden = false;
}
$('#btn-leave').onclick = leave;

function connect() {
  clearTimeout(S.retryTimer);
  const ws = new WebSocket(WS_URL);
  S.ws = ws;
  ws.onopen = () => {
    S.retries = 0;
    $('#banner').hidden = true;
    ws.send(JSON.stringify({ t: 'join', code: S.code, playerId, name: S.name, avatar: S.avatar }));
  };
  ws.onmessage = (e) => handle(JSON.parse(e.data));
  ws.onclose = (ev) => {
    if (S.ws !== ws || S.leaving) return;
    if (ev.code === 4001) { toast('This game was opened in another tab.'); leave(); return; }
    // Reconnect with exponential backoff + jitter (survives deploys, scale-in and AZ failover).
    $('#banner').hidden = false;
    const delay = Math.min(8000, 500 * 2 ** S.retries++) * (0.5 + Math.random() / 2);
    S.retryTimer = setTimeout(connect, delay);
  };
}
const send = (msg) => { if (S.ws?.readyState === 1) S.ws.send(JSON.stringify(msg)); };

// ------------------------------------------------------------------ message handling
function handle(m) {
  switch (m.t) {
    case 'state':
      S.joined = true;
      S.offset = m.serverTime - Date.now();
      Object.assign(S, {
        phase: m.phase, turn: m.turn, totalTurns: m.totalTurns, round: m.round, rounds: m.rounds,
        drawerId: m.drawerId, endsAt: m.phaseEndsAt, drawMs: m.drawMs, hint: m.hint,
        word: m.word || null, players: m.players,
      });
      S.guessed = !!m.players.find((p) => p.id === playerId)?.guessed;
      $('#foot').textContent = `Connected to ${m.task} in ${m.az}`;
      clearCanvas();
      m.strokes.forEach(renderSeg); // replay: rebuilds the canvas for late joiners and reconnects
      renderAll();
      break;
    case 'players':
      S.players = m.players;
      renderPlayers();
      if (S.phase === 'LOBBY') renderOverlay();
      break;
    case 'turn':
      S.offset = m.serverTime - Date.now();
      Object.assign(S, {
        phase: 'DRAWING', turn: m.turn, totalTurns: m.totalTurns, round: m.round, rounds: m.rounds,
        drawerId: m.drawerId, endsAt: m.phaseEndsAt, drawMs: m.drawMs, hint: m.hint, word: null, guessed: false,
      });
      clearCanvas();
      sys(m.drawerId === playerId ? 'Your turn to draw!' : `${nameOf(m.drawerId)} is drawing.`);
      renderAll();
      break;
    case 'word': S.word = m.word; renderTop(); break;
    case 'hint': S.hint = m.hint; renderTop(); break;
    case 'correct':
      sys(`${m.name} guessed it! +${m.points}`, 'ok');
      if (m.playerId === playerId) { S.guessed = true; renderTop(); }
      break;
    case 'turn_end':
      S.offset = m.serverTime - Date.now();
      Object.assign(S, { phase: 'ROUND_END', word: m.word, endsAt: m.phaseEndsAt });
      sys(`The word was “${m.word}”.`);
      if (m.drawerId === playerId && m.guessedCount > 0) uploadArtwork();
      renderAll();
      break;
    case 'match_end':
      S.offset = m.serverTime - Date.now();
      Object.assign(S, { phase: 'MATCH_END', players: m.players, endsAt: m.phaseEndsAt, drawerId: null });
      renderAll();
      break;
    case 'lobby':
      Object.assign(S, { phase: 'LOBBY', drawerId: null, word: null });
      clearCanvas();
      renderAll();
      break;
    case 'chat': chat(m.name, m.text, m.playerId === playerId); break;
    case 'stroke': renderSeg(m); break;
    case 'clear': clearCanvas(); break;
    case 'error':
      toast(m.message);
      if (m.fatal) { S.leaving = true; S.ws?.close(); leave(); }
      break;
    default:
  }
}

async function uploadArtwork() {
  try {
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
    const p = await api('/api/artwork/presign', { code: S.code, playerId });
    const res = await fetch(p.uploadUrl, { method: 'PUT', headers: p.headers, body: blob }); // straight to S3
    if (!res.ok) throw new Error('upload failed');
    await api('/api/artwork/confirm', { key: p.key });
    sys('Your drawing was saved to the Hall of Fame.', 'ok');
  } catch (e) { console.warn('artwork upload skipped:', e.message); }
}

// ------------------------------------------------------------------ canvas
const canvas = $('#canvas');
const ctx = canvas.getContext('2d');
let lastPt = {}; // strokeId -> last point, so batched segments connect

function clearCanvas() {
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  lastPt = {};
}

function renderSeg(seg) {
  ctx.strokeStyle = seg.c;
  ctx.fillStyle = seg.c;
  ctx.lineWidth = seg.w;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  let prev = lastPt[seg.id];
  for (const [nx, ny] of seg.p) {
    const x = nx * canvas.width, y = ny * canvas.height;
    if (!prev) {
      ctx.beginPath(); ctx.arc(x, y, seg.w / 2, 0, Math.PI * 2); ctx.fill(); // a single tap draws a dot
    } else {
      ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(x, y); ctx.stroke();
    }
    prev = [x, y];
  }
  lastPt[seg.id] = prev;
}

let drawing = false, strokeId = '', strokeN = 0, pending = [];
const toNorm = (e) => {
  const r = canvas.getBoundingClientRect();
  const c = (v) => Math.min(1, Math.max(0, +v.toFixed(4)));
  return [c((e.clientX - r.left) / r.width), c((e.clientY - r.top) / r.height)];
};
const style = () => ({ c: S.eraser ? '#ffffff' : S.color, w: S.eraser ? S.size * 1.8 : S.size });

canvas.addEventListener('pointerdown', (e) => {
  if (!canDraw()) return;
  canvas.setPointerCapture(e.pointerId);
  drawing = true;
  strokeId = `${playerId.slice(0, 6)}${++strokeN}`;
  const p = toNorm(e);
  pending = [p];
  renderSeg({ id: strokeId, ...style(), p: [p] }); // draw locally right away, no waiting for the server
});
canvas.addEventListener('pointermove', (e) => {
  if (!drawing) return;
  const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
  const pts = (evs.length ? evs : [e]).map(toNorm);
  pending.push(...pts);
  renderSeg({ id: strokeId, ...style(), p: pts });
});
const endStroke = () => { if (drawing) { drawing = false; flush(); } };
canvas.addEventListener('pointerup', endStroke);
canvas.addEventListener('pointercancel', endStroke);

// Send points in batches (~every 40 ms) instead of one message per mouse event.
function flush() {
  if (!pending.length) return;
  send({ t: 'stroke', id: strokeId, ...style(), p: pending.slice(0, 100), ts: Date.now() });
  pending = pending.slice(100);
}
setInterval(() => { if (drawing || pending.length) flush(); }, 40);

// ------------------------------------------------------------------ tools
function buildTools() {
  const colors = $('#colors');
  COLORS.forEach((c) => {
    const b = document.createElement('button');
    b.className = 'swatch'; b.style.background = c; b.setAttribute('aria-label', `Colour ${c}`);
    b.setAttribute('aria-pressed', c === S.color);
    b.onclick = () => { S.color = c; S.eraser = false; syncTools(); };
    colors.append(b);
  });
  const sizes = $('#sizes');
  SIZES.forEach((s) => {
    const b = document.createElement('button');
    b.className = 'size'; b.setAttribute('aria-label', `Brush size ${s}`);
    const dot = document.createElement('i');
    const d = 4 + s * 0.7;
    dot.style.width = dot.style.height = `${d}px`;
    b.append(dot);
    b.onclick = () => { S.size = s; syncTools(); };
    b.dataset.size = s;
    sizes.append(b);
  });
  $('#btn-eraser').onclick = () => { S.eraser = !S.eraser; syncTools(); };
  $('#btn-clear').onclick = () => { clearCanvas(); send({ t: 'clear' }); };
}
function syncTools() {
  document.querySelectorAll('.swatch').forEach((b) => b.setAttribute('aria-pressed', !S.eraser && b.style.background && rgbToHex(b.style.background) === S.color));
  document.querySelectorAll('.size').forEach((b) => b.setAttribute('aria-pressed', Number(b.dataset.size) === S.size));
  $('#btn-eraser').setAttribute('aria-pressed', S.eraser);
}
function rgbToHex(rgb) {
  const m = rgb.match(/\d+/g);
  return m ? `#${m.slice(0, 3).map((n) => Number(n).toString(16).padStart(2, '0')).join('')}` : rgb;
}

// ------------------------------------------------------------------ chat
function addLog(node, cls) {
  const li = document.createElement('li');
  if (cls) li.className = cls;
  li.append(...(Array.isArray(node) ? node : [node]));
  const log = $('#log');
  const stick = log.scrollTop + log.clientHeight >= log.scrollHeight - 30;
  log.append(li);
  while (log.children.length > 200) log.firstChild.remove();
  if (stick) log.scrollTop = log.scrollHeight;
}
const sys = (text, cls = 'sys') => addLog(document.createTextNode(text), cls);
function chat(name, text, mine) {
  const b = document.createElement('b');
  b.textContent = mine ? 'You' : name;
  addLog([b, document.createTextNode(`: ${text}`)]);
}
$('#chat-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $('#chat-input');
  const text = input.value.trim();
  if (text) send({ t: 'chat', text });
  input.value = '';
});

// ------------------------------------------------------------------ rendering
function renderAll() { renderTop(); renderPlayers(); renderOverlay(); renderToolsVisibility(); }

function renderToolsVisibility() {
  $('#tools').hidden = !canDraw();
  $('#canvas').style.cursor = canDraw() ? 'crosshair' : 'default';
  const input = $('#chat-input');
  input.placeholder = canDraw() ? 'You are drawing. Chat, but don\u2019t reveal the word!' : S.guessed ? 'You got it. Chat with others…' : 'Type your guess';
}

function renderTop() {
  $('#round').textContent = S.phase === 'LOBBY' ? 'Lobby' : `Round ${S.round}/${S.rounds}`;
  const w = $('#word');
  w.replaceChildren();
  const label = (t) => { const s = document.createElement('span'); s.className = 'label'; s.textContent = t; return s; };
  const strong = (t) => { const s = document.createElement('span'); s.textContent = t; return s; };
  if (S.phase === 'DRAWING') {
    if (canDraw() || S.guessed) {
      w.append(label(canDraw() ? 'Draw this' : 'You got it'), strong(S.word || ''));
    } else {
      for (const ch of S.hint) {
        const s = document.createElement('span');
        if (ch === ' ') s.className = 'gap';
        else { s.className = `ch${ch === '_' ? ' blank' : ''}`; s.textContent = ch === '_' ? 'x' : ch; }
        w.append(s);
      }
      w.setAttribute('aria-label', `Hint, ${S.hint.replace(/_/g, 'blank ')}`);
    }
  } else if ((S.phase === 'ROUND_END' || S.phase === 'MATCH_END') && S.word) {
    w.append(label('The word was'), strong(S.word));
  } else {
    w.append(label('Waiting for the game to start'));
  }
  renderToolsVisibility();
}

function renderPlayers() {
  const list = [...S.players].sort((a, b) => b.score - a.score);
  $('#players').replaceChildren(...list.map((p) => {
    const li = document.createElement('li');
    if (!p.connected) li.className = 'off';
    const av = document.createElement('div');
    av.className = 'avatar';
    av.textContent = p.name[0]?.toUpperCase() || '?';
    const [bg, acc, mouth] = (p.avatar || '').split('|');
    const fill = bg || AVATAR_BG[parseInt(p.id.slice(0, 4), 16) % AVATAR_BG.length];
    av.style.background = 'transparent';
    av.style.border = 'none';
    av.innerHTML = avatarSvg(fill, acc || 'leaf', mouth || 'smile');
    const nm = document.createElement('span');
    nm.className = 'pname';
    nm.textContent = p.id === playerId ? `${p.name} (you)` : p.name;
    const sc = document.createElement('span');
    sc.className = 'pscore';
    sc.textContent = p.score;
    li.append(av, nm);
    if (S.phase === 'DRAWING' && p.id === S.drawerId) li.append(Object.assign(document.createElement('span'), { className: 'tag', textContent: 'drawing' }));
    else if (S.phase === 'DRAWING' && p.guessed) li.append(Object.assign(document.createElement('span'), { className: 'tag ok', textContent: 'got it' }));
    li.append(sc);
    return li;
  }));
}

function renderOverlay() {
  const ov = $('#overlay');
  ov.replaceChildren();
  ov.className = 'overlay';
  const el = (tag, text, cls) => { const e = document.createElement(tag); if (text !== undefined) e.textContent = text; if (cls) e.className = cls; return e; };

  if (S.phase === 'LOBBY') {
    const connected = S.players.filter((p) => p.connected).length;
    const start = el('button', 'Start game', 'btn primary big');
    start.disabled = connected < 2;
    start.onclick = () => send({ t: 'start' });
    const copy = el('button', 'Copy invite link', 'btn small');
    copy.onclick = copyInvite;
    ov.append(el('h3', 'Waiting for players'), el('div', S.code, 'big-code'),
      el('p', 'Share this code or link. You need at least 3 players.', 'muted'),
      copy, start, el('p', `${connected} in the room`, 'muted'));
    ov.hidden = false;
  } else if (S.phase === 'ROUND_END') {
    ov.className = 'overlay banner';
    const count = el('span', '');
    count.id = 'ov-count';
    const line = el('div', '');
    line.append(`Next turn in `, count, ' s');
    ov.append(el('h3', `It was “${S.word}”`), line);
    ov.hidden = false;
  } else if (S.phase === 'MATCH_END') {
    const sorted = [...S.players].sort((a, b) => b.score - a.score);
    const ol = el('ol', undefined, 'podium');
    sorted.forEach((p) => { const li = el('li', p.name); li.append(el('span', String(p.score))); ol.append(li); });
    const count = el('span', '');
    count.id = 'ov-count';
    const line = el('p', '', 'muted');
    line.append('Back to the lobby in ', count, ' s');
    ov.append(el('h3', sorted[0] ? `${sorted[0].name} wins!` : 'Game over'), ol, line);
    ov.hidden = false;
  } else {
    ov.hidden = true;
  }
}

async function copyInvite() {
  const link = `${location.origin}/#${S.code}`;
  try { await navigator.clipboard.writeText(link); toast('Invite link copied.'); } catch { toast(link); }
}
$('#room-code').onclick = copyInvite;

// 5 ticks/s: timer bar + countdowns, driven by the server's absolute phaseEndsAt.
setInterval(() => {
  const left = Math.max(0, S.endsAt - nowMs());
  const secs = Math.ceil(left / 1000);
  if (S.phase === 'DRAWING') {
    $('#time').textContent = `${secs}s`;
    $('#bar').style.width = `${S.drawMs ? (left / S.drawMs) * 100 : 0}%`;
  } else {
    $('#time').textContent = '';
    $('#bar').style.width = '0';
  }
  const oc = $('#ov-count');
  if (oc) oc.textContent = secs;
}, 200);

// ------------------------------------------------------------------ boot
buildTools();
syncTools();
clearCanvas();
const resume = ss.get('cd_room');
if (resume && ls.get('cd_name')) joinRoom(resume, ls.get('cd_name'));

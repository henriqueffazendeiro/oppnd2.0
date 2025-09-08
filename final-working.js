// Gmail Ticks — versão só com polling (sem SSE)
console.log('Gmail Ticks: content script (polling only)');

const API_BASE = 'https://oppnd.vercel.app/api';

let sentEmailMappings = {};       // mappingKey -> trackingId
let sentById = {};                // trackingId -> { subject, candidates:[...], createdAt }
let readByTrackingId = new Set(); // IDs lidos
let extensionActive = true;
let currentUserEmail = '';
let currentUserDisplayName = '';

try { sentEmailMappings = JSON.parse(localStorage.getItem('gmail_mappings') || '{}'); } catch {}
try { sentById = JSON.parse(localStorage.getItem('gmail_byid') || '{}'); } catch {}
try { readByTrackingId = new Set(JSON.parse(localStorage.getItem('gmail_read_ids') || '[]')); } catch {}

function saveMappings(){ localStorage.setItem('gmail_mappings', JSON.stringify(sentEmailMappings)); }
function saveById(){ localStorage.setItem('gmail_byid', JSON.stringify(sentById)); }
function saveRead(){ localStorage.setItem('gmail_read_ids', JSON.stringify([...readByTrackingId])); }

chrome.storage.local.get(['extensionActive'], (res) => {
  extensionActive = res.extensionActive !== false;
});

function normalizeSubject(t){ if(!t) return ''; t=t.trim().replace(/^(re|fw|fwd)\s*:\s*/i,''); return t.replace(/\s+/g,' ').trim(); }
function extractEmail(s){ if(!s) return ''; const m=String(s).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i); return m?m[0].toLowerCase():''; }
function normalizeNameOrEmail(s){ if(!s) return ''; s=s.replace(/^\s*(para|to)\s*:?\s*/i,''); s=s.replace(/\se\s*outros.*$/i,''); s=s.split(',')[0]; return s.trim(); }
function normalizeGmailLocalPart(email){ if(!email) return ''; const [l,d]=email.toLowerCase().split('@'); if(d!=='gmail.com' && d!=='googlemail.com') return email.toLowerCase(); return `${l.replace(/\./g,'').replace(/\+.*/,'')}@${d}`; }
function buildKey(subject, who){ return `${normalizeSubject(subject).substring(0,60)}_${(who||'').toLowerCase().trim().substring(0,60)}`; }
function getSubjectFromRow(row){ return normalizeSubject(row.querySelector('.bog')?.textContent?.trim()||''); }

function tryGetSelf() {
  const accEl = document.querySelector('a[aria-label*="@"]') || document.querySelector('img[aria-label*="@"]');
  const aria = accEl?.getAttribute('aria-label') || '';
  const em = extractEmail(aria); if (em) currentUserEmail = em;
  const m = aria.match(/-\s*(.+?)\s*\(/); if (m && m[1]) currentUserDisplayName = m[1].trim();
  if (!currentUserEmail) {
    const titleEl = document.querySelector('[title*="@"]');
    const t = titleEl?.getAttribute?.('title') || '';
    const e2 = extractEmail(t); if (e2) currentUserEmail = e2;
  }
  if (!currentUserEmail) {
    const fromChip = document.querySelector('[aria-label*="De"], [aria-label*="From"] [email]');
    const e = fromChip?.getAttribute?.('email') || '';
    if (e) currentUserEmail = e.toLowerCase();
  }
}
tryGetSelf(); setInterval(tryGetSelf, 3000);

function getWhoFromRow(row) {
  const span = row.querySelector('.yW span');
  if (!span) return '';
  const attrs = [span.getAttribute('email'), span.getAttribute('data-hovercard-id'), span.getAttribute('title')].filter(Boolean);
  for (const v of attrs) { const em = extractEmail(v); if (em) return em.toLowerCase(); }
  const any = row.querySelector('[data-hovercard-id],[email],[title]');
  if (any) { const em = extractEmail(any.getAttribute('data-hovercard-id') || any.getAttribute('email') || any.getAttribute('title') || ''); if (em) return em.toLowerCase(); }
  const txtRaw = (span.textContent || '').trim(); const emt = extractEmail(txtRaw); if (emt) return emt.toLowerCase();
  const txt = txtRaw.toLowerCase();
  if (['me','mim','eu','para mim'].some(a => txt===a || txt.startsWith(a))) return currentUserEmail || 'me';
  if (currentUserDisplayName && txt === currentUserDisplayName.toLowerCase()) return currentUserEmail || currentUserDisplayName.toLowerCase();
  return normalizeNameOrEmail(txt).toLowerCase();
}

async function checkServerRead(id) {
  try {
    const r = await fetch(`${API_BASE}/email-status/${id}`, { cache: 'no-store' });
    const data = await r.json().catch(() => ({}));
    return data?.status === 'read';
  } catch { return false; }
}

function ensureTickContainer(row) {
  let cell = row.querySelector('td.xW') || row.querySelector('td:last-child') || row.lastElementChild;
  let tick = row.querySelector('.gmail-ticks');
  if (!tick) {
    tick = document.createElement('span');
    tick.className = 'gmail-ticks';
    tick.style.cssText = 'margin-left:6px; font-size:12px; display:inline-flex; align-items:center; cursor:help;';
    cell?.appendChild(tick);
  }
  return tick;
}
function setTick(tickEl, state, tt) {
  if (!tickEl) return;
  let html = state==='read'
    ? '<span style="color:#1a73e8; margin-right:-2px;">✓</span><span style="color:#1a73e8;">✓</span>'
    : state==='sent'
    ? '<span style="color:#666; margin-right:-2px;">✓</span><span style="color:#666;">✓</span>'
    : '<span style="color:#666;">✓</span>';
  tickEl.innerHTML = html; tickEl.title = tt || '';
}
function markAsRead(id) {
  readByTrackingId.add(id); saveRead();
  // pinta linhas visíveis já
  document.querySelectorAll('tr.zA').forEach(row => {
    const key = buildKey(getSubjectFromRow(row), getWhoFromRow(row));
    if (sentEmailMappings[key] === id) {
      setTick(ensureTickContainer(row), 'read', 'Aberto');
    }
  });
}

function findIdBySubjectWho(subject, who) {
  const s = normalizeSubject(subject); const w = (normalizeNameOrEmail(who)||'').toLowerCase();
  for (const [id, meta] of Object.entries(sentById)) {
    if (normalizeSubject(meta.subject) !== s) continue;
    const cands = meta.candidates || [];
    if (cands.some(c => (normalizeNameOrEmail(c)||'').toLowerCase() === w)) return id;
  }
  return null;
}

async function addTicks() {
  if (!extensionActive) return;
  const rows = document.querySelectorAll('tr.zA'); if (!rows.length) return;

  rows.forEach(async (row) => {
    const subject = getSubjectFromRow(row);
    const who = getWhoFromRow(row);
    const mappingKey = buildKey(subject, who);

    let id = sentEmailMappings[mappingKey];
    if (!id) {
      const guess = findIdBySubjectWho(subject, who);
      if (guess) { id = guess; sentEmailMappings[mappingKey] = id; saveMappings(); }
    }
    const tick = ensureTickContainer(row);

    if (!id) { setTick(tick, 'old', 'Sem rastreio'); return; }
    setTick(tick, 'sent', 'Enviado (com rastreio)');

    if (readByTrackingId.has(id)) { setTick(tick, 'read', 'Aberto'); return; }

    // primeira verificação rápida
    const wasRead = await checkServerRead(id);
    if (wasRead) { setTick(tick, 'read', 'Aberto'); markAsRead(id); }
  });
}

let addTicksTimer;
function scheduleAddTicks(ms=300){ clearTimeout(addTicksTimer); addTicksTimer = setTimeout(addTicks, ms); }

// ===== envio =====
function handleSend(composeRoot) {
  if (!extensionActive) return;
  const editor = composeRoot?.querySelector('[contenteditable="true"]'); if (!editor) return;
  const subjectInput = composeRoot.querySelector('input[name="subjectbox"]') ||
    composeRoot.querySelector('input[aria-label*="Assunto"], input[placeholder*="Assunto"], input[aria-label*="Subject"], input[placeholder*="Subject"]');
  const subject = normalizeSubject((subjectInput?.value || '').trim());
  let recipient = '';
  const chips = composeRoot.querySelector('div[aria-label*="Para"], div[aria-label*="To"]') ||
    composeRoot.querySelector('input[aria-label*="Para"], input[aria-label*="To"]');
  if (chips) {
    const chipEmail = chips.querySelector('[email]');
    if (chipEmail?.getAttribute) recipient = chipEmail.getAttribute('email') || '';
    if (!recipient) recipient = (chips.textContent || chips.value || '').trim();
  }
  recipient = normalizeNameOrEmail(recipient);

  const id = `t_${crypto.randomUUID()}`;
  const img = document.createElement('img');
  img.src = `${API_BASE}/track/${id}`; // pixel simples (sem SSE)
  img.width = 1; img.height = 1; img.style.display = 'none';
  editor.appendChild(img);

  const myEmail = currentUserEmail;
  const rEmail = extractEmail(recipient) || recipient.toLowerCase();
  const rEmailG = normalizeGmailLocalPart(rEmail);
  const rName = normalizeNameOrEmail(recipient);

  const candidates = [rEmail, rEmailG, rName];
  if (!rEmail || (myEmail && rEmail === myEmail)) {
    candidates.push('me','mim','eu','para mim'); if (currentUserDisplayName) candidates.push(currentUserDisplayName);
  }
  sentById[id] = { subject, candidates: [...new Set(candidates.filter(Boolean))], createdAt: Date.now() };
  saveById();

  const keys = [ buildKey(subject, rEmail), buildKey(subject, rEmailG), buildKey(subject, rName) ];
  if (!rEmail || (myEmail && rEmail === myEmail)) {
    ['me','mim','eu','para mim', currentUserDisplayName||''].forEach(a => a && keys.push(buildKey(subject,a)));
  }
  keys.forEach(k => sentEmailMappings[k] = id);
  saveMappings();

  // opcional: registar meta
  fetch(`${API_BASE}/email`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailId: id, to: rEmail || recipient, subject })
  }).catch(()=>{});

  scheduleAddTicks(1500);
}

document.addEventListener('click', (e) => {
  const t = e.target; const txt = (t?.textContent || '').toLowerCase();
  if (txt==='enviar' || txt==='send' ||
      t?.getAttribute('aria-label')?.toLowerCase().includes('enviar') ||
      t?.getAttribute('aria-label')?.toLowerCase().includes('send') ||
      t?.closest('[data-tooltip*="Enviar"], [data-tooltip*="Send"]')) {
    const compose = t.closest('[role="dialog"]') || document.querySelector('[role="dialog"]');
    if (compose) handleSend(compose);
  }
}, true);

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey||e.metaKey) && e.key==='Enter') {
    const compose = document.querySelector('[role="dialog"]'); if (compose) handleSend(compose);
  }
}, true);

const mo = new MutationObserver(() => scheduleAddTicks(200));
mo.observe(document.documentElement, { childList:true, subtree:true });

scheduleAddTicks(800);
console.log('Gmail Ticks: ready (polling)');

// ===== Poll global: verifica TODOS os IDs pendentes a cada 5s =====
function allPendingIds() {
  const all = new Set(Object.values(sentEmailMappings));
  Object.keys(sentById).forEach(id => all.add(id));
  [...readByTrackingId].forEach(id => all.delete(id));
  return [...all];
}

setInterval(async () => {
  if (!extensionActive) return;
  const ids = allPendingIds().slice(0, 50); // limita por ciclo
  if (!ids.length) return;
  const checks = await Promise.all(ids.map(async id => ({ id, ok: await checkServerRead(id) })));
  checks.forEach(({id, ok}) => { if (ok) markAsRead(id); });
}, 5000);
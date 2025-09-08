// FINAL WORKING VERSION — Gmail ticks (1 cinzento, 2 cinzentos, 2 azuis)
console.log('Gmail Ticks: content script loaded');

const API_BASE = 'https://oppnd.vercel.app/api';

// ======= Estado persistido =======
let sentEmailMappings = {};        // mappingKey -> trackingId
let sentById = {};                 // trackingId -> { subject, candidates:[...], createdAt }
let readByTrackingId = new Set();  // cache de IDs lidos
let extensionActive = true;

let currentUserEmail = '';
let currentUserDisplayName = '';
let clientId = null;

// Carregar storage
try { sentEmailMappings = JSON.parse(localStorage.getItem('gmail_mappings') || '{}'); } catch {}
try { sentById = JSON.parse(localStorage.getItem('gmail_byid') || '{}'); } catch {}
try { readByTrackingId = new Set(JSON.parse(localStorage.getItem('gmail_read_ids') || '[]')); } catch {}

function saveMappings() { localStorage.setItem('gmail_mappings', JSON.stringify(sentEmailMappings)); }
function saveById()     { localStorage.setItem('gmail_byid', JSON.stringify(sentById)); }
function saveReadIds()  { localStorage.setItem('gmail_read_ids', JSON.stringify([...readByTrackingId])); }

// Estado ON/OFF
chrome.storage.local.get(['extensionActive', 'clientId'], (res) => {
  extensionActive = res.extensionActive !== false;
  clientId = res.clientId || null;
  if (!clientId) {
    clientId = `u_${crypto.randomUUID()}`;
    chrome.storage.local.set({ clientId });
  }
  setupSSEInPage(); // abre SSE no content script
});

// Recebe toggle
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.action === 'extensionToggled') {
    extensionActive = !!msg.active;
    if (extensionActive) scheduleAddTicks(200);
  }
  if (msg?.action === 'emailRead' && msg.id) {
    // se o background também empurrar, pintamos igual
    markAsRead(msg.id);
  }
});

// Listen for postMessage from tracking pixels
window.addEventListener('message', (event) => {
  if (event.data?.type === 'GMAIL_TICKS_EMAIL_READ' && event.data?.trackingId) {
    console.log('Gmail Ticks: Received email read notification via postMessage', event.data.trackingId);
    markAsRead(event.data.trackingId);
  }
});

// ======= Helpers =======
function normalizeSubject(text) {
  if (!text) return '';
  text = text.trim();
  text = text.replace(/^(re|fw|fwd)\s*:\s*/i, '');
  return text.replace(/\s+/g, ' ').trim();
}
function normalizeNameOrEmail(text) {
  if (!text) return '';
  text = text.replace(/^\s*(para|to)\s*:?\s*/i, '');
  text = text.replace(/\se\s*outros.*$/i, '');
  text = text.split(',')[0];
  return text.trim();
}
function extractEmail(text) {
  if (!text) return '';
  const m = String(text).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return m ? m[0].toLowerCase() : '';
}
function normalizeGmailLocalPart(email) {
  if (!email) return '';
  const [local, domain] = email.toLowerCase().split('@');
  if (domain !== 'gmail.com' && domain !== 'googlemail.com') return email.toLowerCase();
  const noDots = local.replace(/\./g, '');
  const noPlus = noDots.replace(/\+.*/, '');
  return `${noPlus}@${domain}`;
}
function buildMappingKey(subject, counterparty) {
  const s = normalizeSubject(subject).substring(0, 60);
  const c = (counterparty || '').toLowerCase().trim().substring(0, 60);
  return `${s}_${c}`;
}
function getSubjectFromRow(row) {
  return normalizeSubject(row.querySelector('.bog')?.textContent?.trim() || '');
}

function tryGetCurrentUserEmailAndName() {
  // tenta email + nome pela barra superior
  const accEl = document.querySelector('a[aria-label*="@"]') || document.querySelector('img[aria-label*="@"]');
  const aria = accEl?.getAttribute('aria-label') || '';
  const em = extractEmail(aria);
  if (em) currentUserEmail = em;
  // nome pode vir no aria-label antes do email
  if (aria) {
    const m = aria.match(/-\s*(.+?)\s*\(/); // "Conta do Google - Nome (email@)"
    if (m && m[1]) currentUserDisplayName = m[1].trim();
  }
  // fallback por elementos com title/email
  if (!currentUserEmail) {
    const titleEl = document.querySelector('[title*="@"]');
    const t = titleEl?.getAttribute?.('title') || '';
    const em2 = extractEmail(t);
    if (em2) currentUserEmail = em2;
  }
  // composer "From"
  if (!currentUserEmail) {
    const fromChip = document.querySelector('[aria-label*="De"], [aria-label*="From"] [email]');
    const e = fromChip?.getAttribute?.('email') || '';
    if (e) currentUserEmail = e.toLowerCase();
  }
}
tryGetCurrentUserEmailAndName();
setInterval(tryGetCurrentUserEmailAndName, 3000);

function getListCounterpartyFromRow(row) {
  const span = row.querySelector('.yW span');
  if (!span) return '';

  // tenta atributos com email
  const attrs = [
    span.getAttribute('email'),
    span.getAttribute('data-hovercard-id'),
    span.getAttribute('title'),
  ].filter(Boolean);
  for (const v of attrs) {
    const em = extractEmail(v);
    if (em) return em.toLowerCase();
  }
  // qualquer outro nó com email
  const any = row.querySelector('[data-hovercard-id], [email], [title]');
  if (any) {
    const em = extractEmail(
      any.getAttribute('data-hovercard-id') ||
      any.getAttribute('email') ||
      any.getAttribute('title') || ''
    );
    if (em) return em.toLowerCase();
  }
  // texto
  const raw = (span.textContent || '').trim();
  const emt = extractEmail(raw);
  if (emt) return emt.toLowerCase();

  const txt = raw.toLowerCase();
  // aliases típicos de self
  if (['me', 'mim', 'eu', 'para mim'].some(a => txt === a || txt.startsWith(a))) {
    return currentUserEmail || 'me';
  }
  // pode mostrar apenas o nome da conta
  if (currentUserDisplayName && txt === currentUserDisplayName.toLowerCase()) {
    return currentUserEmail || currentUserDisplayName.toLowerCase();
  }
  return normalizeNameOrEmail(txt).toLowerCase();
}

async function checkServerRead(trackingId) {
  if (!trackingId) return false;
  if (readByTrackingId.has(trackingId)) return true;
  try {
    const r = await fetch(`${API_BASE}/email-status/${trackingId}`);
    const data = await r.json();
    if (data?.status === 'read') {
      markAsRead(trackingId);
      return true;
    }
  } catch {}
  return false;
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
function setTickUI(tickEl, state, tooltip) {
  if (!tickEl) return;
  let html = '';
  if (state === 'read') {
    html = '<span style="color:#1a73e8; margin-right:-2px;">✓</span><span style="color:#1a73e8;">✓</span>';
  } else if (state === 'sent') {
    html = '<span style="color:#666; margin-right:-2px;">✓</span><span style="color:#666;">✓</span>';
  } else {
    html = '<span style="color:#666;">✓</span>';
  }
  tickEl.innerHTML = html;
  tickEl.title = tooltip || '';
}

function markAsRead(trackingId) {
  readByTrackingId.add(trackingId);
  saveReadIds();
  // pinta imediatamente nas linhas que casem com este id
  const rows = document.querySelectorAll('tr.zA');
  rows.forEach((row) => {
    const subject = getSubjectFromRow(row);
    const who = getListCounterpartyFromRow(row);
    const key = buildMappingKey(subject, who);
    const id = sentEmailMappings[key];
    if (id === trackingId) {
      const tick = ensureTickContainer(row);
      setTickUI(tick, 'read', 'Aberto');
    }
  });
}

function findTrackingIdBySubjectAndWho(subject, who) {
  const s = normalizeSubject(subject);
  const w = (normalizeNameOrEmail(who) || '').toLowerCase();
  for (const [id, meta] of Object.entries(sentById)) {
    if (normalizeSubject(meta.subject) !== s) continue;
    const cands = meta.candidates || [];
    if (cands.some(c => (normalizeNameOrEmail(c) || '').toLowerCase() === w)) return id;
  }
  return null;
}

// ======= Render dos ticks =======
async function addTicks() {
  if (!extensionActive) return;
  const rows = document.querySelectorAll('tr.zA');
  if (!rows.length) return;

  rows.forEach(async (row) => {
    const tick = ensureTickContainer(row);
    const subject = getSubjectFromRow(row);
    const who = getListCounterpartyFromRow(row);
    const mappingKey = buildMappingKey(subject, who);

    let trackingId = sentEmailMappings[mappingKey];

    // fallback por subject+candidates (para self, nomes, etc.)
    if (!trackingId) {
      const guess = findTrackingIdBySubjectAndWho(subject, who);
      if (guess) {
        trackingId = guess;
        sentEmailMappings[mappingKey] = trackingId; // memoize
        saveMappings();
      }
    }

    if (!trackingId) {
      setTickUI(tick, 'old', 'Sem rastreio');
      return;
    }

    setTickUI(tick, 'sent', 'Enviado (com rastreio)');

    if (readByTrackingId.has(trackingId)) {
      setTickUI(tick, 'read', 'Aberto');
      return;
    }

    // verificação rápida (primeiro paint)
    checkServerRead(trackingId).then((wasRead) => {
      if (wasRead) setTickUI(tick, 'read', 'Aberto');
    });
  });
}

let addTicksTimer;
function scheduleAddTicks(ms = 300) {
  clearTimeout(addTicksTimer);
  addTicksTimer = setTimeout(addTicks, ms);
}

// ======= Intercetar ENVIO =======
function handleSend(composeRoot) {
  if (!extensionActive) return;

  const editor = composeRoot?.querySelector('[contenteditable="true"]');
  if (!editor) return;

  const subjectInput =
    composeRoot.querySelector('input[name="subjectbox"]') ||
    composeRoot.querySelector('input[aria-label*="Assunto"], input[placeholder*="Assunto"], input[aria-label*="Subject"], input[placeholder*="Subject"]');
  const subject = normalizeSubject((subjectInput?.value || '').trim());

  let recipient = '';
  const chipsContainer =
    composeRoot.querySelector('div[aria-label*="Para"], div[aria-label*="To"]') ||
    composeRoot.querySelector('input[aria-label*="Para"], input[aria-label*="To"]');
  if (chipsContainer) {
    const chipWithEmail = chipsContainer.querySelector('[email]');
    if (chipWithEmail?.getAttribute) recipient = chipWithEmail.getAttribute('email') || '';
    if (!recipient) recipient = (chipsContainer.textContent || chipsContainer.value || '').trim();
  }
  recipient = normalizeNameOrEmail(recipient);

  const trackingId = `t_${crypto.randomUUID()}`;

  // pixel inclui clientId (se existir)
  const img = document.createElement('img');
  img.src = `${API_BASE}/track/${trackingId}${clientId ? `?u=${encodeURIComponent(clientId)}` : ''}`;
  img.width = 1; img.height = 1; img.style.display = 'none';
  editor.appendChild(img);

  const myEmail = currentUserEmail;
  const recipientEmail = extractEmail(recipient) || recipient.toLowerCase();
  const recipientEmailG = normalizeGmailLocalPart(recipientEmail);
  const recipientNameOnly = normalizeNameOrEmail(recipient);

  // candidates para fallback
  const candidates = [recipientEmail, recipientEmailG, recipientNameOnly];
  if (!recipientEmail || (myEmail && recipientEmail === myEmail)) {
    candidates.push('me', 'mim', 'eu', 'para mim');
    if (currentUserDisplayName) candidates.push(currentUserDisplayName);
  }

  sentById[trackingId] = { subject, candidates: [...new Set(candidates.filter(Boolean))], createdAt: Date.now() };
  saveById();

  // Mapping direto por várias chaves equivalentes
  const keys = [
    buildMappingKey(subject, recipientEmail),
    buildMappingKey(subject, recipientEmailG),
    buildMappingKey(subject, recipientNameOnly),
  ];
  if (!recipientEmail || (myEmail && recipientEmail === myEmail)) {
    ['me','mim','eu','para mim', currentUserDisplayName || ''].forEach(alias => {
      if (alias) keys.push(buildMappingKey(subject, alias));
    });
  }
  keys.forEach(k => { if (k) sentEmailMappings[k] = trackingId; });
  saveMappings();

  // notifica servidor (associa trackingId -> clientId)
  fetch(`${API_BASE}/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailId: trackingId, to: recipientEmail || recipient, subject, clientId })
  }).catch(() => {});

  scheduleAddTicks(1500);
}

// Botão "Enviar"
document.addEventListener('click', (e) => {
  const t = e.target;
  const txt = (t?.textContent || '').toLowerCase();
  if (
    txt === 'enviar' || txt === 'send' ||
    t?.getAttribute('aria-label')?.toLowerCase().includes('enviar') ||
    t?.getAttribute('aria-label')?.toLowerCase().includes('send') ||
    t?.closest('[data-tooltip*="Enviar"], [data-tooltip*="Send"]')
  ) {
    const compose = t.closest('[role="dialog"]') || document.querySelector('[role="dialog"]');
    if (compose) handleSend(compose);
  }
}, true);

// Atalho Ctrl/Cmd+Enter
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    const compose = document.querySelector('[role="dialog"]');
    if (compose) handleSend(compose);
  }
}, true);

// Observer
const mo = new MutationObserver(() => scheduleAddTicks(200));
mo.observe(document.documentElement, { childList: true, subtree: true });

// Arranque
scheduleAddTicks(800);
console.log('Gmail Ticks: ready');

// ======= SSE no CONTENT SCRIPT + Polling de segurança =======
let es = null;
let esBackoff = 1000;

function setupSSEInPage() {
  if (!clientId) return;
  try {
    if (es) { try { es.close(); } catch {} es = null; }
    const url = `${API_BASE}/events?u=${encodeURIComponent(clientId)}`;
    es = new EventSource(url);
    es.addEventListener('open', () => { esBackoff = 1000; console.log('Gmail Ticks: SSE (content) open'); });
    es.addEventListener('error', () => {
      console.log('Gmail Ticks: SSE (content) error — retry');
      try { es.close(); } catch {}
      es = null;
      setTimeout(setupSSEInPage, Math.min(esBackoff, 15000));
      esBackoff *= 2;
    });
    // evento nomeado
    es.addEventListener('emailRead', (ev) => {
      try {
        const data = JSON.parse(ev.data || '{}');
        if (data?.trackingId) markAsRead(data.trackingId);
      } catch {}
    });
    // fallback onmessage
    es.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data || '{}');
        if (msg?.type === 'emailRead' && msg?.trackingId) markAsRead(msg.trackingId);
      } catch {}
    };
  } catch (e) {
    console.warn('Gmail Ticks: cannot open SSE in content script', e);
  }
}

// Polling de segurança (caso SSE falhe): verifica ids visíveis a cada 8s
const lastCheckedAt = new Map();
setInterval(() => {
  if (!extensionActive) return;
  const now = Date.now();
  const rows = document.querySelectorAll('tr.zA');
  rows.forEach((row) => {
    const subject = getSubjectFromRow(row);
    const who = getListCounterpartyFromRow(row);
    const key = buildMappingKey(subject, who);
    const id = sentEmailMappings[key] || findTrackingIdBySubjectAndWho(subject, who);
    if (!id || readByTrackingId.has(id)) return;
    const last = lastCheckedAt.get(id) || 0;
    if (now - last < 15000) return; // não spammar
    lastCheckedAt.set(id, now);
    checkServerRead(id).then((ok) => {
      if (ok) markAsRead(id);
    });
  });
}, 8000);
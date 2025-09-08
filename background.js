// Background script for SSE connection
let clientId;

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.storage.local.set({ extensionActive: true });
  }
});

// Create stable user ID and start SSE
chrome.storage.local.get(['clientId'], (result) => {
  clientId = result.clientId || `u_${crypto.randomUUID()}`;
  chrome.storage.local.set({ clientId }, startSSE);
});

function dispatchEmailRead(trackingId) {
  if (!trackingId) return;
  chrome.tabs.query({ url: '*://mail.google.com/*' }, (tabs) => {
    tabs.forEach((tab) => {
      try {
        chrome.tabs.sendMessage(
          tab.id,
          { action: 'emailRead', id: trackingId },
          () => { void chrome.runtime.lastError; } // ignora se não houver recetor
        );
      } catch (e) {
        // ignore
      }
    });
  });
}

function startSSE() {
  if (!clientId) return;

  const url = `https://oppnd.vercel.app/api/events?u=${encodeURIComponent(clientId)}`;
  let eventSource = new EventSource(url);

  console.log('Gmail Ticks: SSE connection started for user:', clientId);

  // 1) eventos nomeados: "event: emailRead"
  eventSource.addEventListener('emailRead', (ev) => {
    try {
      const data = JSON.parse(ev.data || '{}');
      if (data?.trackingId) {
        console.log('Gmail Ticks: [named] emailRead:', data.trackingId);
        dispatchEmailRead(data.trackingId);
      }
    } catch (err) {
      console.error('Gmail Ticks: error in named event handler', err);
    }
  });

  // 2) fallback para mensagens "message" sem nome
  eventSource.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data || '{}');
      if (message.type === 'emailRead' && message.trackingId) {
        console.log('Gmail Ticks: [message] emailRead:', message.trackingId);
        dispatchEmailRead(message.trackingId);
      }
    } catch (error) {
      console.error('Gmail Ticks: Error parsing SSE message:', error);
    }
  };

  eventSource.onerror = () => {
    console.log('Gmail Ticks: SSE connection error, reconnecting...');
    try { eventSource.close(); } catch {}
    setTimeout(startSSE, 2000);
  };

  eventSource.onopen = () => {
    console.log('Gmail Ticks: SSE connection established');
  };
}

// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'toggleExtension') {
    chrome.storage.local.set({ extensionActive: request.active });
    sendResponse({ success: true });
  }

  if (request.action === 'getExtensionState') {
    chrome.storage.local.get(['extensionActive'], (result) => {
      sendResponse({ active: result.extensionActive !== false });
    });
    return true;
  }

  if (request?.action === 'getClientId') {
    sendResponse({ clientId });
    return true;
  }
});

console.log('Gmail Ticks: Background script loaded');
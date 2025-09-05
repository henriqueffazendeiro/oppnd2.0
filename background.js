chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    // Set extension as active by default
    chrome.storage.local.set({ extensionActive: true });
  }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'toggleExtension') {
    chrome.storage.local.set({ extensionActive: request.active });
    sendResponse({ success: true });
  }
  
  if (request.action === 'getExtensionState') {
    chrome.storage.local.get(['extensionActive'], (result) => {
      sendResponse({ active: result.extensionActive !== false });
    });
    return true; // Keep message channel open for async response
  }
});
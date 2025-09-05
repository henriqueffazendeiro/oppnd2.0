document.addEventListener('DOMContentLoaded', async () => {
  const toggleSwitch = document.getElementById('toggleExtension');
  const statusDiv = document.getElementById('status');

  // Load current state
  const result = await chrome.storage.local.get(['extensionActive']);
  const isActive = result.extensionActive !== false;
  
  toggleSwitch.checked = isActive;
  updateStatus(isActive);

  // Handle toggle
  toggleSwitch.addEventListener('change', async (e) => {
    const newState = e.target.checked;
    
    try {
      await chrome.storage.local.set({ extensionActive: newState });
      updateStatus(newState);
      
      // Notify content script of the change
      const tabs = await chrome.tabs.query({ url: 'https://mail.google.com/*' });
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, { 
          action: 'extensionToggled', 
          active: newState 
        }).catch(() => {
          // Ignore errors (tab might not have content script loaded)
        });
      });
      
    } catch (error) {
      console.error('Error updating extension state:', error);
      toggleSwitch.checked = !newState; // Revert toggle
    }
  });

  function updateStatus(isActive) {
    statusDiv.textContent = isActive ? 
      'Extensão ativa - Emails enviados serão rastreados' : 
      'Extensão desativada - Nenhum rastreamento';
    statusDiv.style.color = isActive ? '#25D366' : '#666';
  }
});
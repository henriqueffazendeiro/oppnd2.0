// Debug script - paste this in Gmail console to test selectors
console.log('=== Gmail Debug Script ===');

// Test all possible email selectors
const selectors = [
  '.zA.yO',
  '.zA.zE', 
  'tr.zA',
  '.zA',
  '[role="main"] tr',
  '.Cp tbody tr',
  '.ae4.UI tbody tr',
  '.F tbody tr'
];

selectors.forEach(selector => {
  const elements = document.querySelectorAll(selector);
  console.log(`Selector "${selector}": found ${elements.length} elements`);
  if (elements.length > 0) {
    console.log('First element:', elements[0]);
  }
});

// Test sent folder specific selectors
console.log('\n=== Sent Folder Selectors ===');
const sentSelectors = [
  '.TN.bzz.aHS-bnu',
  '[data-action-data*="sent"]',
  '.ar9.T-I-J3.J-J5-Ji',
  '[aria-label*="Sent"]',
  '[title*="Sent"]'
];

sentSelectors.forEach(selector => {
  const elements = document.querySelectorAll(selector);
  console.log(`Sent selector "${selector}": found ${elements.length} elements`);
});

// Check current URL and folder
console.log('\n=== Current Location ===');
console.log('URL:', window.location.href);
console.log('Hash:', window.location.hash);

// Look for any containers that might hold emails
console.log('\n=== Possible Email Containers ===');
const containers = document.querySelectorAll('tbody, [role="main"], .ae4, .UI');
containers.forEach((container, index) => {
  const rows = container.querySelectorAll('tr');
  if (rows.length > 0) {
    console.log(`Container ${index} (${container.className}): ${rows.length} rows`);
  }
});
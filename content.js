class GmailReadReceipts {
  constructor() {
    this.API_BASE = 'https://your-vercel-domain.vercel.app/api';
    this.isExtensionActive = false;
    this.processedEmails = new Set();
    console.log('Gmail Read Receipts Extension: Initializing...');
    this.init();
  }

  init() {
    this.loadExtensionState();
    this.observeGmailChanges();
    this.injectTrackingInCompose();
  }

  async loadExtensionState() {
    const result = await chrome.storage.local.get(['extensionActive']);
    this.isExtensionActive = result.extensionActive !== false;
  }

  observeGmailChanges() {
    console.log('Gmail Read Receipts Extension: Setting up observers...');
    
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          this.processSentEmails();
          this.processInboxEmails();
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Initial processing with multiple attempts
    const initialProcess = () => {
      console.log('Gmail Read Receipts Extension: Processing emails...');
      this.processSentEmails();
      this.processInboxEmails();
    };

    setTimeout(initialProcess, 1000);
    setTimeout(initialProcess, 3000);
    setTimeout(initialProcess, 5000);
  }

  processSentEmails() {
    console.log('Gmail Read Receipts Extension: Looking for sent emails...');
    
    // Try multiple selectors for Gmail's sent emails
    const sentSelectors = [
      '.TN.bzz.aHS-bnu', // Original selector
      '[data-action-data*="sent"]', // Alternative
      '.ar9.T-I-J3.J-J5-Ji', // Sent folder
    ];

    let sentContainer = null;
    for (const selector of sentSelectors) {
      sentContainer = document.querySelector(selector);
      if (sentContainer) {
        console.log(`Gmail Read Receipts Extension: Found sent container with selector: ${selector}`);
        break;
      }
    }

    if (!sentContainer) {
      // Try finding emails anywhere if we're in sent folder
      const emails = document.querySelectorAll('.zA.yO, .zA.zE, tr.zA');
      if (emails.length > 0) {
        console.log(`Gmail Read Receipts Extension: Found ${emails.length} emails (fallback method)`);
        emails.forEach(email => this.processEmail(email, 'sent'));
      }
      return;
    }

    const emails = sentContainer.querySelectorAll('.zA.yO, .zA.zE, tr.zA');
    console.log(`Gmail Read Receipts Extension: Found ${emails.length} sent emails`);
    emails.forEach(email => this.processEmail(email, 'sent'));
  }

  processInboxEmails() {
    // Process emails in inbox
    const emails = document.querySelectorAll('.zA.yO, .zA.zE');
    emails.forEach(email => {
      if (!email.closest('.TN.bzz.aHS-bnu')) {
        this.processEmail(email, 'inbox');
      }
    });
  }

  processEmail(emailElement, type) {
    const emailId = this.getEmailId(emailElement);
    if (!emailId || this.processedEmails.has(emailId)) return;

    this.processedEmails.add(emailId);

    if (type === 'sent') {
      this.addTicksToSentEmail(emailElement, emailId);
    }
  }

  getEmailId(emailElement) {
    // Try to extract email ID from various attributes
    let emailId = emailElement.getAttribute('data-legacy-thread-id') ||
                  emailElement.getAttribute('data-thread-id') ||
                  emailElement.id;
    
    if (!emailId) {
      // Generate a unique ID based on email content
      const subject = emailElement.querySelector('.bog')?.textContent || '';
      const timestamp = emailElement.querySelector('.xY span')?.getAttribute('title') || '';
      emailId = btoa(subject + timestamp + Date.now()).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
    }

    return emailId;
  }

  addTicksToSentEmail(emailElement, emailId) {
    console.log(`Gmail Read Receipts Extension: Processing email ${emailId}`);
    
    // Try multiple insertion points
    const insertionTargets = [
      { target: '.apU.xY', next: '.oZ-x3.xY' },
      { target: '.xY', next: '.y2' },
      { target: 'td.xY', next: 'td.y2' },
      { target: '.yf', next: '.y2' }
    ];

    let targetElement = null;
    let nextElement = null;

    for (const targets of insertionTargets) {
      targetElement = emailElement.querySelector(targets.target);
      nextElement = emailElement.querySelector(targets.next);
      
      if (targetElement && nextElement) {
        console.log(`Gmail Read Receipts Extension: Found insertion point: ${targets.target} -> ${targets.next}`);
        break;
      }
    }

    if (!targetElement) {
      console.log('Gmail Read Receipts Extension: No suitable insertion point found, trying fallback');
      // Fallback: insert at end of email row
      targetElement = emailElement.querySelector('td:last-child') || emailElement;
      if (targetElement) {
        nextElement = null; // Will append
      }
    }

    if (!targetElement) {
      console.log('Gmail Read Receipts Extension: Could not find insertion point for email');
      return;
    }

    // Check if ticks already exist
    if (emailElement.querySelector('.read-receipt-ticks')) {
      console.log('Gmail Read Receipts Extension: Ticks already exist for this email');
      return;
    }

    const ticksContainer = document.createElement('div');
    ticksContainer.className = 'read-receipt-ticks';
    ticksContainer.setAttribute('data-email-id', emailId);
    ticksContainer.style.display = 'inline-flex';
    ticksContainer.style.marginLeft = '8px';

    // Determine tick status based on email age and extension state
    const tickStatus = this.determineTickStatus(emailElement, emailId);
    ticksContainer.innerHTML = this.createTicksHTML(tickStatus);

    console.log(`Gmail Read Receipts Extension: Adding ticks with status: ${tickStatus}`);

    try {
      if (nextElement) {
        targetElement.parentNode.insertBefore(ticksContainer, nextElement);
      } else {
        targetElement.appendChild(ticksContainer);
      }
      console.log('Gmail Read Receipts Extension: Ticks added successfully');
    } catch (error) {
      console.error('Gmail Read Receipts Extension: Error adding ticks:', error);
    }

    // Update tick status from server
    this.updateTickStatusFromServer(emailId, ticksContainer);
  }

  determineTickStatus(emailElement, emailId) {
    // Check if email was sent before extension was active
    const emailTimestamp = this.getEmailTimestamp(emailElement);
    const extensionInstallTime = localStorage.getItem('extensionInstallTime') || Date.now();
    
    if (emailTimestamp < extensionInstallTime) {
      return 'legacy'; // 1 grey tick
    }

    return 'sent'; // 2 grey ticks (will be updated from server)
  }

  getEmailTimestamp(emailElement) {
    const timeElement = emailElement.querySelector('.xY span[title]');
    if (timeElement) {
      const timeTitle = timeElement.getAttribute('title');
      return new Date(timeTitle).getTime();
    }
    return Date.now();
  }

  createTicksHTML(status) {
    const singleTick = `
      <svg class="tick single-tick ${status}" viewBox="0 0 16 15">
        <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.88a.32.32 0 0 1-.484.032l-.358-.325a.32.32 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.032l6.272-8.048a.366.366 0 0 0-.063-.511z"/>
      </svg>
    `;

    if (status === 'legacy') {
      return `<div class="tick-container">${singleTick}</div>`;
    }

    const doubleTick = `
      <svg class="tick double-tick ${status}" viewBox="0 0 16 15">
        <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.88a.32.32 0 0 1-.484.032l-.358-.325a.32.32 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.032l6.272-8.048a.366.366 0 0 0-.063-.511z"/>
      </svg>
    `;

    return `
      <div class="tick-container">
        ${singleTick}
        ${doubleTick}
      </div>
    `;
  }

  async updateTickStatusFromServer(emailId, ticksContainer) {
    try {
      const response = await fetch(`${this.API_BASE}/email-status/${emailId}`);
      const data = await response.json();
      
      if (data.status) {
        this.updateTicksAppearance(ticksContainer, data.status);
      }
    } catch (error) {
      console.log('Could not fetch email status:', error);
    }
  }

  updateTicksAppearance(ticksContainer, status) {
    const ticks = ticksContainer.querySelectorAll('.tick');
    
    ticks.forEach(tick => {
      tick.classList.remove('sent', 'delivered', 'read');
      tick.classList.add(status);
    });
  }

  injectTrackingInCompose() {
    const observer = new MutationObserver(() => {
      const composeElements = document.querySelectorAll('[role="textbox"][contenteditable="true"]');
      composeElements.forEach(element => {
        if (!element.hasAttribute('data-tracking-injected')) {
          element.setAttribute('data-tracking-injected', 'true');
          this.setupComposeTracking(element);
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  setupComposeTracking(composeElement) {
    // Find the send button
    const composeBox = composeElement.closest('[role="dialog"]') || composeElement.closest('.M9');
    if (!composeBox) return;

    const sendButton = composeBox.querySelector('[data-tooltip="Send ‪(Ctrl+Enter)‬"], .T-I.J-J5-Ji.aoO.v7.T-I-atl.L3');
    if (!sendButton) return;

    sendButton.addEventListener('click', () => {
      if (this.isExtensionActive) {
        this.injectTrackingPixel(composeElement);
      }
    });
  }

  injectTrackingPixel(composeElement) {
    const emailId = this.generateEmailId();
    const trackingPixel = `<img src="${this.API_BASE}/track/${emailId}" style="display:none;" width="1" height="1">`;
    
    // Inject tracking pixel into email content
    const currentContent = composeElement.innerHTML;
    composeElement.innerHTML = currentContent + trackingPixel;

    // Store email info
    this.storeEmailInfo(emailId);
  }

  generateEmailId() {
    return btoa(Date.now() + Math.random().toString()).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
  }

  async storeEmailInfo(emailId) {
    try {
      await fetch(`${this.API_BASE}/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          emailId,
          timestamp: Date.now(),
          status: 'sent'
        })
      });
    } catch (error) {
      console.log('Could not store email info:', error);
    }
  }
}

// Initialize the extension
if (window.location.hostname === 'mail.google.com') {
  // Set extension install time if not set
  if (!localStorage.getItem('extensionInstallTime')) {
    localStorage.setItem('extensionInstallTime', Date.now().toString());
  }

  new GmailReadReceipts();
}
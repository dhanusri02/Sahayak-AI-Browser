/**
 * Sahayak Browser Agent - Background Service Worker (background.js)
 * Manages side panel behavior, screenshot captures, and tab coordination.
 */

// Configure side panel behavior on installation
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[Sahayak SW] Installed. Reason:', details.reason);
  try {
    if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
      await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    }
  } catch (err) {
    console.warn('[Sahayak SW] setPanelBehavior error:', err);
  }

  // Initialize default profile and settings in storage if not present
  const existing = await chrome.storage.local.get(['userProfile', 'settings', 'savedSkills']);
  if (!existing.userProfile) {
    await chrome.storage.local.set({
      userProfile: {
        fullName: 'Dhanusri',
        email: 'dhanusri@example.com',
        phone: '+91 98765 43210',
        location: 'Bengaluru, India',
        role: 'Software Engineer',
        preferredLanguage: 'English' // 'English' | 'Hinglish'
      }
    });
  }

  if (!existing.settings) {
    await chrome.storage.local.set({
      settings: {
        geminiApiKey: '',
        geminiModel: 'gemini-1.5-flash',
        strictSafetyMode: true,
        autoBadgePage: false
      }
    });
  }

  if (!existing.savedSkills || existing.savedSkills.length === 0) {
    await chrome.storage.local.set({
      savedSkills: [
        {
          id: 'skill-1',
          name: 'Summarize Key Takeaways',
          prompt: 'Provide a structured bullet-point summary of the core insights, key metrics, and conclusions of this page.'
        },
        {
          id: 'skill-2',
          name: 'Hinglish Breakdown',
          prompt: 'Explain the main concept of this page in simple, conversational Hinglish (Hindi + English blend) as if explaining to a smart friend.'
        },
        {
          id: 'skill-3',
          name: 'Autofill Form with Profile',
          prompt: 'Scan all form inputs on this page and prepare approved fill actions using my local profile details.'
        },
        {
          id: 'skill-4',
          name: 'Draft Professional Reply',
          prompt: 'Draft a polite, professional reply or response based on the selected content or contact form on this page.'
        }
      ]
    });
  }
});

// Fallback listener for action click if setPanelBehavior is not supported
chrome.action.onClicked.addListener(async (tab) => {
  try {
    if (chrome.sidePanel && chrome.sidePanel.open) {
      await chrome.sidePanel.open({ windowId: tab.windowId });
    }
  } catch (err) {
    console.error('[Sahayak SW] Failed to open side panel on click:', err);
  }
});

// Tab change listeners to notify active side panel
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab && tab.url) {
      chrome.runtime.sendMessage({
        type: 'ACTIVE_TAB_CHANGED',
        tab: {
          id: tab.id,
          url: tab.url,
          title: tab.title,
          favIconUrl: tab.favIconUrl
        }
      }).catch(() => {
        // Suppress errors when side panel is closed
      });
    }
  } catch (err) {
    // Ignore tab get errors
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    chrome.runtime.sendMessage({
      type: 'ACTIVE_TAB_UPDATED',
      tab: {
        id: tab.id,
        url: tab.url,
        title: tab.title,
        favIconUrl: tab.favIconUrl
      }
    }).catch(() => {
      // Suppress errors when side panel is closed
    });
  }
});

// Lock flag to prevent double-capture errors (Chrome Extension Rule #16)
let isCapturingScreenshot = false;

// Handle runtime messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CAPTURE_SCREENSHOT') {
    (async () => {
      if (isCapturingScreenshot) {
        sendResponse({ success: false, error: 'Screenshot capture already in progress.' });
        return;
      }
      isCapturingScreenshot = true;
      try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!activeTab || !activeTab.id) {
          throw new Error('No active tab found.');
        }

        // captureVisibleTab captures the visible area of the currently active window
        const dataUrl = await chrome.tabs.captureVisibleTab(activeTab.windowId, { format: 'png' });
        sendResponse({ success: true, dataUrl });
      } catch (err) {
        console.error('[Sahayak SW] Screenshot capture failed:', err);
        sendResponse({ success: false, error: err.message || 'Failed to capture screenshot.' });
      } finally {
        isCapturingScreenshot = false;
      }
    })();
    return true; // Keep message channel open for async response
  }

  if (message.type === 'ENSURE_CONTENT_SCRIPT') {
    (async () => {
      try {
        const tabId = message.tabId;
        if (!tabId) {
          throw new Error('Tab ID is required.');
        }
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['safety.js', 'content.js']
        });
        sendResponse({ success: true });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (message.type === 'GET_CURRENT_ACTIVE_TAB') {
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        sendResponse({ success: true, tab });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }
});

/**
 * Sahayak Browser Agent - Content Script (content.js)
 * Injected into web pages to extract content, generate numbered action maps,
 * badge interactive elements, and execute user-approved actions.
 */

(function () {
  'use strict';

  // Prevent multiple injections
  if (window.__SAHAYAK_CONTENT_SCRIPT_INITIALIZED__) {
    return;
  }
  window.__SAHAYAK_CONTENT_SCRIPT_INITIALIZED__ = true;

  // Cache of indexed interactive elements for direct execution by id
  let indexedElements = [];
  let overlayHost = null;
  let overlayShadow = null;
  let isBadgesVisible = false;

  /**
   * Cleans and extracts visible readable text from DOM
   */
  function extractPageText() {
    // Clone body or target main container
    const mainEl = document.querySelector('main, article, [role="main"]') || document.body;
    if (!mainEl) {
      return { text: '', wordCount: 0, excerpts: [] };
    }

    const clone = mainEl.cloneNode(true);

    // Remove noise
    const noiseSelectors = [
      'script', 'style', 'noscript', 'svg', 'iframe', 'canvas',
      'nav', 'footer', 'header', '.ad', '.advertisement', '#cookie-banner',
      '#sahayak-action-overlay-root'
    ];
    noiseSelectors.forEach((sel) => {
      clone.querySelectorAll(sel).forEach((el) => el.remove());
    });

    const rawText = clone.innerText || clone.textContent || '';
    const cleanText = rawText
      .replace(/\s+/g, ' ')
      .replace(/[\r\n]+/g, '\n')
      .trim();

    const wordCount = cleanText ? cleanText.split(/\s+/).length : 0;

    // Collect first few headers/paragraphs for structured quick view
    const headings = [];
    document.querySelectorAll('h1, h2, h3').forEach((h) => {
      const text = h.textContent.trim();
      if (text && text.length < 120 && headings.length < 8) {
        headings.push({ level: h.tagName.toLowerCase(), text });
      }
    });

    return {
      text: cleanText.slice(0, 30000), // Cap for token / context management
      wordCount,
      headings
    };
  }

  /**
   * Extracts YouTube-specific metadata if on a YouTube video page
   */
  function extractYouTubeData() {
    const isYouTube =
      window.location.hostname.includes('youtube.com') &&
      window.location.pathname.includes('/watch');

    if (!isYouTube) {
      return null;
    }

    const titleEl =
      document.querySelector('#title h1 yt-formatted-string') ||
      document.querySelector('h1.ytd-watch-metadata') ||
      document.querySelector('h1 yt-formatted-string');
    const channelEl =
      document.querySelector('#channel-name a') ||
      document.querySelector('#owner #channel-name yt-formatted-string a');
    const descriptionEl =
      document.querySelector('#description-inline-expander') ||
      document.querySelector('#description yt-formatted-string');

    // Attempt to extract chapters or timeline markers if present in description
    const descText = descriptionEl ? descriptionEl.innerText : '';
    const chapterMatches = descText.match(/(?:\d{1,2}:)?\d{1,2}:\d{2}\s+[-–—]?\s*[^\n]+/g) || [];

    return {
      isVideo: true,
      title: titleEl ? titleEl.innerText.trim() : document.title.replace(' - YouTube', ''),
      channel: channelEl ? channelEl.innerText.trim() : 'YouTube Creator',
      description: descText.slice(0, 4000),
      chapters: chapterMatches.slice(0, 15),
      url: window.location.href
    };
  }

  /**
   * Helper to determine element visibility and non-trivial dimensions
   */
  function isElementVisible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) < 0.05) {
      return false;
    }
    const rect = el.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return false;

    // Must be in active viewport or within document layout
    return (
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < (window.innerHeight || document.documentElement.clientHeight) + 4000 &&
      rect.left < (window.innerWidth || document.documentElement.clientWidth) + 4000
    );
  }

  /**
   * Computes a friendly label for an element
   */
  function getElementLabel(el) {
    const tag = el.tagName.toUpperCase();

    // Check placeholder for inputs
    if (el.placeholder) return el.placeholder.trim();

    // Check value for submit/buttons
    if (tag === 'INPUT' && (el.type === 'submit' || el.type === 'button') && el.value) {
      return el.value.trim();
    }

    // Check aria-label
    if (el.getAttribute('aria-label')) {
      return el.getAttribute('aria-label').trim();
    }

    // Check title
    if (el.getAttribute('title')) {
      return el.getAttribute('title').trim();
    }

    // Check associated label
    if (el.labels && el.labels.length > 0) {
      const lbl = el.labels[0].textContent.trim();
      if (lbl) return lbl;
    }

    // Inner text for buttons/links
    const inner = (el.innerText || el.textContent || '').trim();
    if (inner && inner.length < 80) {
      return inner.replace(/\s+/g, ' ');
    }

    // Fallback: name or id
    if (el.name) return `Name: ${el.name}`;
    if (el.id) return `#${el.id}`;

    return `${tag} element`;
  }

  /**
   * Scans page and creates a numbered Action Map
   */
  function scanInteractiveElements() {
    indexedElements = [];

    const selectors = [
      'button',
      'a[href]',
      'input:not([type="hidden"])',
      'select',
      'textarea',
      '[role="button"]',
      '[role="link"]',
      '[role="checkbox"]',
      '[role="tab"]',
      '[role="combobox"]',
      '[contenteditable="true"]'
    ];

    const candidates = Array.from(document.querySelectorAll(selectors.join(',')));
    let counter = 1;

    for (const el of candidates) {
      // Skip Sahayak's own overlay
      if (el.closest('#sahayak-action-overlay-root')) continue;

      if (!isElementVisible(el)) continue;

      const tag = el.tagName.toUpperCase();
      const type = (el.type || '').toLowerCase();
      const label = getElementLabel(el);
      const rect = el.getBoundingClientRect();

      // Check safety using safety.js
      const safetyResult = window.SahayakSafety
        ? window.SahayakSafety.isElementSensitive(el)
        : { sensitive: false, reason: 'Safe' };

      const item = {
        id: counter,
        tag,
        type: tag === 'INPUT' ? type || 'text' : undefined,
        label: label.slice(0, 60),
        isSensitive: safetyResult.sensitive,
        safetyReason: safetyResult.reason,
        rect: {
          top: Math.round(rect.top + window.scrollY),
          left: Math.round(rect.left + window.scrollX),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        },
        element: el
      };

      indexedElements.push(item);
      counter++;

      // Cap at 80 interactive elements for optimal side panel rendering
      if (counter > 80) break;
    }

    // If overlay is already active, re-render badges
    if (isBadgesVisible) {
      renderBadgesOnPage();
    }

    // Return serializable list (omit DOM element references)
    return indexedElements.map(({ id, tag, type, label, isSensitive, safetyReason, rect }) => ({
      id,
      tag,
      type,
      label,
      isSensitive,
      safetyReason,
      rect
    }));
  }

  /**
   * Injects or updates numbered floating badges directly on the webpage
   */
  function renderBadgesOnPage() {
    if (!overlayHost) {
      overlayHost = document.createElement('div');
      overlayHost.id = 'sahayak-action-overlay-root';
      overlayHost.style.position = 'absolute';
      overlayHost.style.top = '0';
      overlayHost.style.left = '0';
      overlayHost.style.width = '100%';
      overlayHost.style.height = '100%';
      overlayHost.style.pointerEvents = 'none';
      overlayHost.style.zIndex = '2147483647';
      document.body.appendChild(overlayHost);

      overlayShadow = overlayHost.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = `
        .sahayak-badge {
          position: absolute;
          background: linear-gradient(135deg, #4f46e5, #7c3aed);
          color: #ffffff;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 11px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 9999px;
          border: 1.5px solid #ffffff;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4), 0 0 10px rgba(99, 102, 241, 0.5);
          pointer-events: auto;
          cursor: pointer;
          transform: translate(-4px, -8px);
          user-select: none;
          transition: transform 0.15s ease, background 0.15s ease;
          display: flex;
          align-items: center;
          gap: 2px;
          line-height: 14px;
        }
        .sahayak-badge:hover {
          transform: translate(-4px, -10px) scale(1.15);
          background: linear-gradient(135deg, #10b981, #059669);
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.6);
        }
        .sahayak-badge.sensitive {
          background: linear-gradient(135deg, #ef4444, #b91c1c);
          border-color: #fca5a5;
        }
        .sahayak-pulse-ring {
          position: absolute;
          border: 3px solid #10b981;
          background: rgba(16, 185, 129, 0.15);
          border-radius: 6px;
          pointer-events: none;
          animation: sahayak-pulse 1.8s infinite;
          box-sizing: border-box;
        }
        @keyframes sahayak-pulse {
          0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
          70% { box-shadow: 0 0 0 12px rgba(16, 185, 129, 0); }
          100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
      `;
      overlayShadow.appendChild(style);
    }

    // Clear existing badges
    const oldBadges = overlayShadow.querySelectorAll('.sahayak-badge, .sahayak-pulse-ring');
    oldBadges.forEach((b) => b.remove());

    // Add updated badges
    indexedElements.forEach((item) => {
      const badge = document.createElement('div');
      badge.className = `sahayak-badge ${item.isSensitive ? 'sensitive' : ''}`;
      badge.textContent = `[${item.id}]`;
      badge.title = `${item.tag}: ${item.label} ${item.isSensitive ? '(Protected)' : ''}`;

      const rect = item.element.getBoundingClientRect();
      const top = rect.top + window.scrollY;
      const left = rect.left + window.scrollX;

      badge.style.top = `${top}px`;
      badge.style.left = `${left}px`;

      badge.addEventListener('click', (e) => {
        e.stopPropagation();
        highlightElement(item.id);
        chrome.runtime.sendMessage({
          type: 'ELEMENT_BADGE_CLICKED',
          elementId: item.id,
          label: item.label
        });
      });

      overlayShadow.appendChild(badge);
    });

    isBadgesVisible = true;
  }

  /**
   * Removes numbered badges from the webpage
   */
  function removeBadgesFromPage() {
    if (overlayHost) {
      overlayHost.remove();
      overlayHost = null;
      overlayShadow = null;
    }
    isBadgesVisible = false;
  }

  /**
   * Highlights a target element with smooth scroll and a glowing pulse ring
   */
  function highlightElement(id) {
    const item = indexedElements.find((x) => x.id === id);
    if (!item || !item.element) {
      return false;
    }

    const el = item.element;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Injected highlight border or overlay ring
    if (!overlayShadow) {
      renderBadgesOnPage();
    }

    // Remove existing ring
    overlayShadow.querySelectorAll('.sahayak-pulse-ring').forEach((r) => r.remove());

    const rect = el.getBoundingClientRect();
    const ring = document.createElement('div');
    ring.className = 'sahayak-pulse-ring';
    ring.style.top = `${rect.top + window.scrollY - 3}px`;
    ring.style.left = `${rect.left + window.scrollX - 3}px`;
    ring.style.width = `${rect.width + 6}px`;
    ring.style.height = `${rect.height + 6}px`;

    overlayShadow.appendChild(ring);

    // Auto-remove ring after 3.5s
    setTimeout(() => {
      ring.remove();
    }, 3500);

    return true;
  }

  /**
   * Executes a user-approved browser action safely
   */
  function executeAction(action) {
    if (!action || !action.id) {
      return { success: false, error: 'Invalid action payload. Missing action id.' };
    }

    const item = indexedElements.find((x) => x.id === action.id);
    if (!item || !item.element) {
      return {
        success: false,
        error: `Element [${action.id}] was not found. Please refresh the Action Map.`
      };
    }

    const el = item.element;

    // Safety verification check
    if (window.SahayakSafety) {
      const validation = window.SahayakSafety.validateProposedAction(
        action,
        el,
        window.location.href
      );
      if (!validation.allowed) {
        return {
          success: false,
          error: `Safety Guard Violation: ${validation.reason}`
        };
      }
    }

    // Scroll into view first
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    highlightElement(action.id);

    try {
      if (action.type === 'click') {
        el.focus();
        // Dispatch mouse events
        ['mouseenter', 'mousedown', 'mouseup', 'click'].forEach((evtType) => {
          const evt = new MouseEvent(evtType, {
            view: window,
            bubbles: true,
            cancelable: true
          });
          el.dispatchEvent(evt);
        });
        return {
          success: true,
          message: `Clicked [${action.id}] ${item.tag}: "${item.label}"`
        };
      }

      if (action.type === 'fill') {
        const val = action.value || '';
        el.focus();

        // Native prototype setter trigger for React/Vue reactive inputs
        const isTextArea = el.tagName.toUpperCase() === 'TEXTAREA';
        const proto = isTextArea ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');

        if (descriptor && descriptor.set) {
          descriptor.set.call(el, val);
        } else {
          el.value = val;
        }

        ['input', 'change', 'blur'].forEach((evtType) => {
          const evt = new Event(evtType, { bubbles: true, cancelable: true });
          el.dispatchEvent(evt);
        });

        return {
          success: true,
          message: `Filled [${action.id}] with: "${val}"`
        };
      }

      if (action.type === 'select') {
        if (el.tagName.toUpperCase() === 'SELECT') {
          el.value = action.value;
          el.dispatchEvent(new Event('change', { bubbles: true }));
          return {
            success: true,
            message: `Selected option: "${action.value}"`
          };
        }
      }

      if (action.type === 'scroll') {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return { success: true, message: `Scrolled to [${action.id}]` };
      }

      return { success: false, error: `Unsupported action type: ${action.type}` };
    } catch (err) {
      return { success: false, error: err.message || 'Execution failed.' };
    }
  }

  // Window scroll/resize updates badges positions smoothly
  let repositionTimeout = null;
  window.addEventListener('resize', () => {
    if (isBadgesVisible) {
      clearTimeout(repositionTimeout);
      repositionTimeout = setTimeout(renderBadgesOnPage, 150);
    }
  });

  // Message dispatcher
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GET_PAGE_DATA') {
      try {
        const pageTextData = extractPageText();
        const youtubeData = extractYouTubeData();
        const selectedText = window.getSelection().toString().trim();
        const urlSafety = window.SahayakSafety
          ? window.SahayakSafety.evaluateUrlSafety(window.location.href)
          : { safe: true, level: 'safe', reason: 'Safe' };

        sendResponse({
          success: true,
          data: {
            title: document.title,
            url: window.location.href,
            favIconUrl:
              document.querySelector("link[rel*='icon']")?.href ||
              `${window.location.origin}/favicon.ico`,
            text: pageTextData.text,
            wordCount: pageTextData.wordCount,
            headings: pageTextData.headings,
            selectedText,
            youtubeData,
            safety: urlSafety
          }
        });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
      return true;
    }

    if (message.type === 'SCAN_ACTION_MAP') {
      try {
        const actionMap = scanInteractiveElements();
        sendResponse({ success: true, actionMap });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
      return true;
    }

    if (message.type === 'TOGGLE_PAGE_BADGES') {
      try {
        if (message.show) {
          if (indexedElements.length === 0) {
            scanInteractiveElements();
          }
          renderBadgesOnPage();
        } else {
          removeBadgesFromPage();
        }
        sendResponse({ success: true, isBadgesVisible });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
      return true;
    }

    if (message.type === 'HIGHLIGHT_ELEMENT') {
      try {
        const ok = highlightElement(message.id);
        sendResponse({ success: ok });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
      return true;
    }

    if (message.type === 'EXECUTE_ACTION') {
      try {
        const result = executeAction(message.action);
        sendResponse(result);
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
      return true;
    }

    if (message.type === 'GET_SELECTED_TEXT') {
      const selectedText = window.getSelection().toString().trim();
      sendResponse({ success: true, selectedText });
      return true;
    }
  });

  console.log('[Sahayak Content] Injected and ready on:', window.location.href);
})();

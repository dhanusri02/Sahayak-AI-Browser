/**
 * Sahayak Browser Agent - Safety Engine (safety.js)
 * Enforces strict safety rules across pages, forms, and browser actions.
 * Prevents automated actions on banking, sensitive credentials, and system pages.
 */

(function (global) {
  'use strict';

  // 1. Restricted Protocols & Internal Browsing Schemes
  const RESTRICTED_PROTOCOLS = [
    'chrome:',
    'chrome-extension:',
    'edge:',
    'brave:',
    'about:',
    'devtools:',
    'view-source:',
    'data:',
    'blob:'
  ];

  // 2. High-Risk / Financial Domains (Hard Blocked)
  const BLOCKED_DOMAINS = [
    // Major Banks
    'hdfcbank.com',
    'icicibank.com',
    'sbi.co.in',
    'onlinesbi.sbi',
    'axisbank.com',
    'kotak.com',
    'bankofbaroda.in',
    'pnbindia.in',
    'chase.com',
    'bankofamerica.com',
    'wellsfargo.com',
    'citibank.com',
    'citi.com',
    'hsbc.com',
    'barclays.co.uk',
    'schwab.com',
    'fidelity.com',
    'vanguard.com',
    
    // Payment Processors & Crypto Wallets
    'paypal.com',
    'razorpay.com',
    'paytm.com',
    'phonepe.com',
    'billdesk.com',
    'metamask.io',
    'binance.com',
    'coinbase.com',
    'wazirx.com',
    
    // Critical Identity Providers (when on sensitive auth paths)
    'accounts.google.com',
    'login.microsoftonline.com',
    'appleid.apple.com'
  ];

  // 3. Keywords in Domain / URL indicating Financial or Banking transactions
  const BANKING_URL_PATTERNS = [
    /netbanking/i,
    /ebanking/i,
    /onlinebanking/i,
    /\/payment\b/i,
    /\/checkout\b/i,
    /\/pay\b/i,
    /\/gateway\b/i,
    /\/transfer\b/i,
    /\/fund-transfer\b/i
  ];

  // 4. Sensitive Element Keywords (Pass, CVV, Card, OTP, PIN, SSN)
  const SENSITIVE_FIELD_PATTERNS = [
    /password/i,
    /passwd/i,
    /passcode/i,
    /\bpin\b/i,
    /cvv/i,
    /cvc/i,
    /security[_-]?code/i,
    /card[_-]?num/i,
    /credit[_-]?card/i,
    /debit[_-]?card/i,
    /cc[_-]?number/i,
    /expir/i,
    /\botp\b/i,
    /one[_-]?time[_-]?pass/i,
    /\bssn\b/i,
    /social[_-]?sec/i,
    /aadhaar/i,
    /pan[_-]?card/i,
    /secret/i,
    /mfa/i,
    /2fa/i,
    /token/i
  ];

  /**
   * Evaluates the safety level of a URL.
   * @param {string} url - The URL to inspect.
   * @returns {{ safe: boolean, level: 'safe'|'caution'|'blocked', reason: string }}
   */
  function evaluateUrlSafety(url) {
    if (!url || typeof url !== 'string') {
      return { safe: false, level: 'blocked', reason: 'Invalid or missing URL.' };
    }

    const trimmedUrl = url.trim();

    // Check restricted protocols
    for (const proto of RESTRICTED_PROTOCOLS) {
      if (trimmedUrl.startsWith(proto)) {
        return {
          safe: false,
          level: 'blocked',
          reason: `Restricted system URL protocol (${proto}). Extensions cannot interact here.`
        };
      }
    }

    let parsed;
    try {
      parsed = new URL(trimmedUrl);
    } catch {
      return { safe: false, level: 'blocked', reason: 'Unparseable URL.' };
    }

    const hostname = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname.toLowerCase();
    const fullPath = (hostname + pathname).toLowerCase();

    // Check explicit blocked banking / financial domains
    for (const domain of BLOCKED_DOMAINS) {
      if (hostname === domain || hostname.endsWith('.' + domain)) {
        return {
          safe: false,
          level: 'blocked',
          reason: `Banking / Financial institution domain (${domain}) detected. Browser automation is strictly disabled.`
        };
      }
    }

    // Check banking URL patterns
    for (const pattern of BANKING_URL_PATTERNS) {
      if (pattern.test(fullPath)) {
        return {
          safe: false,
          level: 'blocked',
          reason: `Payment / Financial transaction path detected (${pattern}). Automated actions are locked.`
        };
      }
    }

    // Check for login / authentication pages (Caution level: allow reading, guard typing)
    if (/(login|signin|auth|session|signup)/i.test(pathname)) {
      return {
        safe: true,
        level: 'caution',
        reason: 'Authentication page detected. Password & credential fields are strictly protected.'
      };
    }

    return {
      safe: true,
      level: 'safe',
      reason: 'Standard web page. Actions require step-by-step user confirmation.'
    };
  }

  /**
   * Checks whether a DOM element is sensitive (password, payment, OTP, etc.).
   * @param {Element} element
   * @returns {{ sensitive: boolean, reason: string }}
   */
  function isElementSensitive(element) {
    if (!element || !(element instanceof Element)) {
      return { sensitive: false, reason: 'Not an element' };
    }

    const tag = element.tagName.toUpperCase();

    // Password inputs are ALWAYS blocked from automation
    if (tag === 'INPUT' && (element.type || '').toLowerCase() === 'password') {
      return {
        sensitive: true,
        reason: 'Password input field. Keystroke/autofill automation is blocked for safety.'
      };
    }

    // Check attributes for sensitive markers
    const attrsToCheck = [
      element.getAttribute('id') || '',
      element.getAttribute('name') || '',
      element.getAttribute('placeholder') || '',
      element.getAttribute('aria-label') || '',
      element.getAttribute('autocomplete') || '',
      element.getAttribute('title') || '',
      element.getAttribute('data-testid') || ''
    ];

    const combinedAttrs = attrsToCheck.join(' ').toLowerCase();

    for (const pattern of SENSITIVE_FIELD_PATTERNS) {
      if (pattern.test(combinedAttrs)) {
        return {
          sensitive: true,
          reason: `Field marked with sensitive attribute matching ${pattern}. Automation blocked.`
        };
      }
    }

    // Check label text if present
    if (element.labels && element.labels.length > 0) {
      for (const label of element.labels) {
        const labelText = (label.textContent || '').toLowerCase();
        for (const pattern of SENSITIVE_FIELD_PATTERNS) {
          if (pattern.test(labelText)) {
            return {
              sensitive: true,
              reason: `Associated label contains sensitive term: "${label.textContent.trim()}".`
            };
          }
        }
      }
    }

    return { sensitive: false, reason: 'Safe element' };
  }

  /**
   * Validates a proposed agent action against safety policies.
   * @param {object} action - { type, id, value, targetSelector }
   * @param {Element} [targetElement] - The resolved DOM element if available
   * @param {string} [currentUrl] - Current page URL
   * @returns {{ allowed: boolean, reason: string }}
   */
  function validateProposedAction(action, targetElement, currentUrl) {
    if (!action) {
      return { allowed: false, reason: 'No action provided.' };
    }

    // 1. Check URL safety
    if (currentUrl) {
      const urlSafety = evaluateUrlSafety(currentUrl);
      if (urlSafety.level === 'blocked') {
        return {
          allowed: false,
          reason: `Action blocked: Page safety level is BLOCKED (${urlSafety.reason})`
        };
      }
    }

    // 2. Check Element sensitivity
    if (targetElement) {
      const elSafety = isElementSensitive(targetElement);
      if (elSafety.sensitive) {
        return {
          allowed: false,
          reason: `Action blocked on sensitive element: ${elSafety.reason}`
        };
      }
    }

    // 3. Check action value for credit cards or credentials
    if (action.value && typeof action.value === 'string') {
      // Basic credit card Luhn-like string check (13-19 digits)
      if (/\b(?:\d[ -]*?){13,19}\b/.test(action.value)) {
        return {
          allowed: false,
          reason: 'Action blocked: Value appears to contain payment card digits.'
        };
      }
    }

    return { allowed: true, reason: 'Action passed all safety checks.' };
  }

  // Export to global scope
  const SahayakSafety = {
    evaluateUrlSafety,
    isElementSensitive,
    validateProposedAction,
    BLOCKED_DOMAINS,
    RESTRICTED_PROTOCOLS,
    SENSITIVE_FIELD_PATTERNS
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SahayakSafety;
  } else {
    global.SahayakSafety = SahayakSafety;
  }
})(typeof window !== 'undefined' ? window : globalThis);

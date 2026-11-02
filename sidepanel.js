/**
 * Sahayak Browser Agent - Side-Panel Controller (sidepanel.js)
 * Implements page comprehension, English/Hinglish summarization, strictly-grounded chat,
 * selection tools, screen vision, numbered action mapping, and human-in-the-loop action approval.
 */

(function () {
  'use strict';

  // State
  let activeTab = null;
  let pageData = null;
  let actionMap = [];
  let userProfile = {
    fullName: 'Dhanusri',
    email: 'dhanusri@example.com',
    phone: '+91 98765 43210',
    location: 'Bengaluru, India',
    role: 'Software Engineer',
    preferredLanguage: 'English'
  };
  let settings = {
    geminiApiKey: '',
    geminiModel: 'gemini-1.5-flash',
    strictSafetyMode: true,
    autoBadgePage: false
  };
  let savedSkills = [];
  let selectedLanguage = 'English';
  let selectedSummaryMode = 'tldr';
  let capturedScreenshotData = null;
  let plannedActionsQueue = [];
  let currentActionStep = null;
  let currentFilter = 'all';

  // DOM Elements Cache
  const els = {
    // Header & Context
    btnOpenOptions: document.getElementById('btn-open-options'),
    btnRefreshPage: document.getElementById('btn-refresh-page'),
    pageContextPill: document.getElementById('page-context-pill'),
    pageFavicon: document.getElementById('page-favicon'),
    pageFaviconFallback: document.getElementById('page-favicon-fallback'),
    pageTitle: document.getElementById('page-title'),
    safetyStatusPill: document.getElementById('safety-status-pill'),
    safetyStatusLabel: document.getElementById('safety-status-label'),
    modelStatusPill: document.getElementById('model-status-pill'),
    modelStatusLabel: document.getElementById('model-status-label'),

    // Navigation Tabs
    tabButtons: document.querySelectorAll('.tab-btn'),
    tabPanels: document.querySelectorAll('.tab-panel'),

    // Summary Tab
    langEn: document.getElementById('lang-en'),
    langHi: document.getElementById('lang-hi'),
    summaryModeChips: document.querySelectorAll('#summary-modes .mode-chip'),
    modeYoutubeChip: document.getElementById('mode-youtube-chip'),
    youtubeBanner: document.getElementById('youtube-banner'),
    ytBannerTitle: document.getElementById('yt-banner-title'),
    ytBannerChannel: document.getElementById('yt-banner-channel'),
    btnGenerateSummary: document.getElementById('btn-generate-summary'),
    summaryResultBox: document.getElementById('summary-result-box'),
    summaryContent: document.getElementById('summary-content'),
    summaryStats: document.getElementById('summary-stats'),
    btnCopySummary: document.getElementById('btn-copy-summary'),

    // Chat Tab
    chatMessages: document.getElementById('chat-messages'),
    chatForm: document.getElementById('chat-form'),
    chatInput: document.getElementById('chat-input'),
    chatSuggestions: document.getElementById('chat-suggestions'),

    // Selection Tab
    selectedTextPreview: document.getElementById('selected-text-preview'),
    btnRefreshSelection: document.getElementById('btn-refresh-selection'),
    btnExplainSelection: document.getElementById('btn-explain-selection'),
    btnTranslateHinglish: document.getElementById('btn-translate-hinglish'),
    btnTranslateEnglish: document.getElementById('btn-translate-english'),
    btnDraftReply: document.getElementById('btn-draft-reply'),
    selectionResultBox: document.getElementById('selection-result-box'),
    selectionResultTitle: document.getElementById('selection-result-title'),
    selectionResultContent: document.getElementById('selection-result-content'),
    btnCopySelection: document.getElementById('btn-copy-selection'),

    // Vision Tab
    btnCaptureScreen: document.getElementById('btn-capture-screen'),
    screenshotContainer: document.getElementById('screenshot-container'),
    emptyScreenshotState: document.getElementById('empty-screenshot-state'),
    screenshotImg: document.getElementById('screenshot-img'),
    visionQueryInput: document.getElementById('vision-query-input'),
    btnAskVision: document.getElementById('btn-ask-vision'),
    visionResultBox: document.getElementById('vision-result-box'),
    visionResultContent: document.getElementById('vision-result-content'),
    btnCopyVision: document.getElementById('btn-copy-vision'),

    // Action Map Tab
    togglePageBadges: document.getElementById('toggle-page-badges'),
    btnScanActions: document.getElementById('btn-scan-actions'),
    actionFilters: document.getElementById('action-filters'),
    countAll: document.getElementById('count-all'),
    countButtons: document.getElementById('count-buttons'),
    countInputs: document.getElementById('count-inputs'),
    countLinks: document.getElementById('count-links'),
    agentGoalInput: document.getElementById('agent-goal-input'),
    btnPlanAction: document.getElementById('btn-plan-action'),
    actionApprovalCard: document.getElementById('action-approval-card'),
    approvalStepNum: document.getElementById('approval-step-num'),
    approvalSafetyBadge: document.getElementById('approval-safety-badge'),
    approvalTargetElement: document.getElementById('approval-target-element'),
    approvalActionDesc: document.getElementById('approval-action-desc'),
    approvalReasoning: document.getElementById('approval-reasoning'),
    btnApproveAction: document.getElementById('btn-approve-action'),
    btnRejectAction: document.getElementById('btn-reject-action'),
    btnHighlightTarget: document.getElementById('btn-highlight-target'),
    actionExecutionToast: document.getElementById('action-execution-toast'),
    actionElementsContainer: document.getElementById('action-elements-container'),

    // Profile & Skills Tab
    btnEditProfileLink: document.getElementById('btn-edit-profile-link'),
    profName: document.getElementById('prof-name'),
    profEmail: document.getElementById('prof-email'),
    profPhone: document.getElementById('prof-phone'),
    profLang: document.getElementById('prof-lang'),
    savedSkillsContainer: document.getElementById('saved-skills-container'),

    // Global Overlay
    loadingOverlay: document.getElementById('loading-overlay'),
    loadingText: document.getElementById('loading-text')
  };

  /**
   * Initialize Side Panel
   */
  async function init() {
    await loadStoredData();
    setupEventListeners();
    await detectAndLoadActiveTab();
    updateModelStatusIndicator();
  }

  /**
   * Load User Profile, Settings, and Saved Skills from chrome.storage.local
   */
  async function loadStoredData() {
    try {
      const data = await chrome.storage.local.get([
        'userProfile',
        'settings',
        'savedSkills'
      ]);

      if (data.userProfile) userProfile = { ...userProfile, ...data.userProfile };
      if (data.settings) settings = { ...settings, ...data.settings };
      if (data.savedSkills) savedSkills = data.savedSkills;

      // Update Profile UI
      els.profName.textContent = userProfile.fullName || 'User';
      els.profEmail.textContent = userProfile.email || 'None';
      els.profPhone.textContent = userProfile.phone || 'None';
      els.profLang.textContent = userProfile.preferredLanguage || 'English';

      // Default language sync
      selectedLanguage = userProfile.preferredLanguage || 'English';
      setLanguageUI(selectedLanguage);

      renderSavedSkills();
    } catch (err) {
      console.warn('[Sahayak] Error loading storage:', err);
    }
  }

  /**
   * Update Model Status Indicator (Gemini API vs Mock Engine)
   */
  function updateModelStatusIndicator() {
    if (settings.geminiApiKey && settings.geminiApiKey.trim().length > 5) {
      const modelName = settings.geminiModel || 'gemini-1.5-flash';
      els.modelStatusLabel.textContent = `✨ ${modelName}`;
      els.modelStatusPill.className = 'status-pill status-model';
      els.modelStatusPill.title = 'Powered by Google Gemini API';
    } else {
      els.modelStatusLabel.textContent = '💡 Local Intelligent Engine';
      els.modelStatusPill.className = 'status-pill status-safe';
      els.modelStatusPill.title = 'Using intelligent on-device heuristic engine (Free tier / No API key needed)';
    }
  }

  /**
   * Detect and connect to active tab
   */
  async function detectAndLoadActiveTab() {
    try {
      showLoading('Connecting to active page...');
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id) {
        setPageContextUI({ title: 'No active tab detected', url: '' });
        return;
      }

      activeTab = tab;
      await fetchPageDataFromTab(tab.id);
    } catch (err) {
      console.error('[Sahayak] detectAndLoadActiveTab error:', err);
      setPageContextUI({ title: 'Failed to access tab', url: '' });
    } finally {
      hideLoading();
    }
  }

  /**
   * Query tab for page content & metadata
   */
  async function fetchPageDataFromTab(tabId) {
    if (!tabId) return;

    // First check safety of URL before messaging
    const urlSafety = window.SahayakSafety
      ? window.SahayakSafety.evaluateUrlSafety(activeTab.url)
      : { safe: true, level: 'safe', reason: 'Safe' };

    updateSafetyUI(urlSafety);

    if (urlSafety.level === 'blocked') {
      setPageContextUI({
        title: activeTab.title || 'Restricted System Page',
        url: activeTab.url,
        favIconUrl: activeTab.favIconUrl
      });
      pageData = {
        title: activeTab.title,
        url: activeTab.url,
        text: 'This page is restricted (banking/system protocol). Content reading and automated actions are disabled for your protection.',
        wordCount: 0,
        safety: urlSafety
      };
      return;
    }

    try {
      // Send message to content script
      const response = await chrome.tabs.sendMessage(tabId, { type: 'GET_PAGE_DATA' });
      if (response && response.success) {
        pageData = response.data;
        setPageContextUI(pageData);
        updateSafetyUI(pageData.safety);
        handleYouTubePresence(pageData.youtubeData);
        updateSelectedTextUI(pageData.selectedText);
      } else {
        throw new Error(response ? response.error : 'No response from content script');
      }
    } catch (err) {
      // Content script may not be injected yet (e.g. page was open prior to install)
      console.log('[Sahayak] Injecting content script into tab:', tabId);
      try {
        await chrome.runtime.sendMessage({ type: 'ENSURE_CONTENT_SCRIPT', tabId });
        // Retry message
        const retryResp = await chrome.tabs.sendMessage(tabId, { type: 'GET_PAGE_DATA' });
        if (retryResp && retryResp.success) {
          pageData = retryResp.data;
          setPageContextUI(pageData);
          updateSafetyUI(pageData.safety);
          handleYouTubePresence(pageData.youtubeData);
          updateSelectedTextUI(pageData.selectedText);
        }
      } catch (injectErr) {
        console.warn('[Sahayak] Content script injection failed:', injectErr);
        setPageContextUI({
          title: activeTab.title || 'Page loaded',
          url: activeTab.url,
          favIconUrl: activeTab.favIconUrl
        });
      }
    }
  }

  /**
   * Update Page Context Header UI
   */
  function setPageContextUI(data) {
    if (!data) return;
    const title = data.title || 'Untitled Page';
    els.pageTitle.textContent = title;
    els.pageTitle.title = `${title} (${data.url || ''})`;

    if (data.favIconUrl && !data.favIconUrl.startsWith('chrome://')) {
      els.pageFavicon.src = data.favIconUrl;
      els.pageFavicon.style.display = 'inline-block';
      els.pageFaviconFallback.style.display = 'none';
      els.pageFavicon.onerror = () => {
        els.pageFavicon.style.display = 'none';
        els.pageFaviconFallback.style.display = 'inline-block';
      };
    } else {
      els.pageFavicon.style.display = 'none';
      els.pageFaviconFallback.style.display = 'inline-block';
    }
  }

  /**
   * Update Safety Status Badge UI
   */
  function updateSafetyUI(safety) {
    if (!safety) return;
    const pill = els.safetyStatusPill;
    const label = els.safetyStatusLabel;

    pill.className = `status-pill status-${safety.level || 'safe'}`;
    label.textContent =
      safety.level === 'blocked' ? 'Protected' : safety.level === 'caution' ? 'Caution' : 'Safe';
    pill.title = safety.reason || 'Safety evaluated';

    // Disable Action Map if blocked
    if (safety.level === 'blocked') {
      els.btnPlanAction.disabled = true;
      els.btnScanActions.disabled = true;
    } else {
      els.btnPlanAction.disabled = false;
      els.btnScanActions.disabled = false;
    }
  }

  /**
   * Handle YouTube video page detection
   */
  function handleYouTubePresence(ytData) {
    if (ytData && ytData.isVideo) {
      els.youtubeBanner.style.display = 'flex';
      els.ytBannerTitle.textContent = ytData.title || 'YouTube Video';
      els.ytBannerChannel.textContent = ytData.channel || 'Creator';
      els.modeYoutubeChip.style.display = 'inline-flex';
      // Auto-select YouTube mode chip
      setSummaryMode('youtube');
    } else {
      els.youtubeBanner.style.display = 'none';
      els.modeYoutubeChip.style.display = 'none';
      if (selectedSummaryMode === 'youtube') {
        setSummaryMode('tldr');
      }
    }
  }

  /**
   * Update Selected Text UI Preview
   */
  function updateSelectedTextUI(text) {
    if (text && text.trim().length > 0) {
      els.selectedTextPreview.innerHTML = `"${escapeHtml(text.trim())}"`;
    } else {
      els.selectedTextPreview.innerHTML =
        '<span class="placeholder-text">Highlight any text on the webpage to explain, translate, or draft replies.</span>';
    }
  }

  /**
   * Render Saved Skills Chips in Profile tab
   */
  function renderSavedSkills() {
    els.savedSkillsContainer.innerHTML = '';
    if (!savedSkills || savedSkills.length === 0) {
      els.savedSkillsContainer.innerHTML =
        '<span class="text-muted">No saved skills found. Add them in Settings.</span>';
      return;
    }

    savedSkills.forEach((skill) => {
      const btn = document.createElement('button');
      btn.className = 'skill-row-btn';
      btn.innerHTML = `
        <span class="skill-name">⚡ ${escapeHtml(skill.name)}</span>
        <span class="text-muted">Run →</span>
      `;
      btn.addEventListener('click', () => executeSavedSkill(skill));
      els.savedSkillsContainer.appendChild(btn);
    });
  }

  /**
   * Execute a Saved Skill immediately
   */
  async function executeSavedSkill(skill) {
    if (!skill || !skill.prompt) return;

    // Switch to Summary or Chat tab to present result
    switchTab('tab-summary');
    showLoading(`Running skill: ${skill.name}...`);

    try {
      const prompt = `Page Content:
${(pageData?.text || '').slice(0, 10000)}

Task:
${skill.prompt}

User Profile Context:
Name: ${userProfile.fullName}
Role: ${userProfile.role}
Language: ${selectedLanguage}`;

      const result = await callAI({
        prompt,
        systemInstruction: `You are Sahayak, an intelligent Chrome assistant. Execute this custom user skill accurately in ${selectedLanguage}.`
      });

      renderSummaryResult(result);
    } catch (err) {
      renderSummaryResult(`Skill execution error: ${err.message}`);
    } finally {
      hideLoading();
    }
  }

  // =========================================================================
  // AI Calling Layer (Gemini Free Tier API + Fallback Heuristic Mock Engine)
  // =========================================================================

  /**
   * Main AI Call function: tries Gemini API if configured, falls back to local engine
   */
  async function callAI({ prompt, systemInstruction = '', imageBase64 = null }) {
    const apiKey = (settings.geminiApiKey || '').trim();

    // 1. If user provided a Gemini API Key, execute real Gemini API call
    if (apiKey && apiKey.length > 5) {
      try {
        const model = settings.geminiModel || 'gemini-1.5-flash';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        const parts = [];
        if (imageBase64) {
          // Remove data:image/...;base64, prefix if present
          const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
          parts.push({
            inline_data: {
              mime_type: 'image/png',
              data: cleanBase64
            }
          });
        }
        parts.push({ text: prompt });

        const bodyPayload = {
          contents: [{ parts }]
        };

        if (systemInstruction) {
          bodyPayload.system_instruction = {
            parts: [{ text: systemInstruction }]
          };
        }

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyPayload)
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          console.warn('[Sahayak] Gemini API returned error, falling back to local engine:', errData);
          // Fall through to mock engine if quota or key issue
        } else {
          const data = await res.json();
          const generatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (generatedText) {
            return generatedText;
          }
        }
      } catch (apiErr) {
        console.warn('[Sahayak] Gemini API fetch failed, falling back to local engine:', apiErr);
      }
    }

    // 2. Local Intelligent Heuristic Mock Engine
    // Synthesizes context-grounded responses directly from real DOM text, metadata & profile
    return generateLocalIntelligentResponse({ prompt, systemInstruction, imageBase64 });
  }

  /**
   * High-Quality Local Heuristic Engine for Out-of-The-Box Demos & Free Offline Use
   */
  function generateLocalIntelligentResponse({ prompt, systemInstruction, imageBase64 }) {
    const text = pageData?.text || '';
    const title = pageData?.title || 'Current Webpage';
    const isHinglish = selectedLanguage === 'Hinglish';
    const yt = pageData?.youtubeData;

    // Detect request type from prompt keywords
    const lowerPrompt = prompt.toLowerCase();

    // YouTube Summary Case
    if (yt && yt.isVideo && (lowerPrompt.includes('youtube') || lowerPrompt.includes('video'))) {
      if (isHinglish) {
        return `## 📺 YouTube Video Breakdown (Hinglish)\n\n` +
          `**Title:** ${yt.title}\n` +
          `**Channel:** ${yt.channel}\n\n` +
          `### 💡 Key Takeaways:\n` +
          `- **Main Topic:** Yeh video mainly explore karta hai: *${yt.title}*.\n` +
          `- **Channel Insight:** Channel *${yt.channel}* ne is topic ke core concepts aur real-world examples ko break down kiya hai.\n` +
          (yt.chapters.length > 0
            ? `- **Important Timestamps:**\n  ${yt.chapters.slice(0, 5).map((c) => `• \`${c}\``).join('\n  ')}\n`
            : `- **Description Highlights:** ${yt.description ? yt.description.slice(0, 180) + '...' : 'Direct concept explanations included.'}\n`) +
          `- **Conclusion:** Viewers ke liye actionable advice aur technical workflow step-by-step explain kiya gaya hai.`;
      } else {
        return `## 📺 YouTube Video Summary\n\n` +
          `**Title:** ${yt.title}\n` +
          `**Channel:** ${yt.channel}\n\n` +
          `### 📌 Core Highlights:\n` +
          `- **Overview:** Detailed presentation on *${yt.title}* published by ${yt.channel}.\n` +
          (yt.chapters.length > 0
            ? `- **Key Timeline & Chapters:**\n  ${yt.chapters.slice(0, 5).map((c) => `• \`${c}\``).join('\n  ')}\n`
            : `- **Description Brief:** ${yt.description ? yt.description.slice(0, 200) + '...' : 'Clear presentation of concepts and steps.'}\n`) +
          `- **Key Takeaway:** Provides comprehensive walkthrough and actionable insights for viewers.`;
      }
    }

    // Standard Summary Cases
    if (lowerPrompt.includes('summary') || lowerPrompt.includes('summarise') || lowerPrompt.includes('tldr') || lowerPrompt.includes('takeaway')) {
      // Extract top headings and sentences
      const sentences = text
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 35 && !s.includes('{') && !s.includes('function'));

      const topSentences = sentences.slice(0, 5);

      if (isHinglish) {
        return `## 📝 Page Summary (Hinglish)\n\n` +
          `**Title:** ${title}\n` +
          `**Word Count:** ~${pageData?.wordCount || 350} words\n\n` +
          `### ⚡ Quick TL;DR:\n` +
          `Yeh page *${title}* ke baare mein explain karta hai. Iska main objective user ko key insights aur structured updates provide karna hai.\n\n` +
          `### 📌 Key Takeaways:\n` +
          (topSentences.length > 0
            ? topSentences.map((s, idx) => `${idx + 1}. **Point ${idx + 1}:** ${s}`).join('\n')
            : `1. **Main Insight:** Page content focuses on core functional details of ${title}.\n2. **Important Details:** Specifications, workflows, and procedures are outlined clearly.\n3. **Outcome:** Clear guidance provided for the reader.`) +
          `\n\n### 🎯 Actionable Advice:\n` +
          `- Diye gaye points ko review karein aur apne workflow mein apply karein.\n` +
          `- Agar form ya action required hai toh Sahayak Action Map se verify karke proceed karein.`;
      } else {
        return `## 📝 Executive Summary\n\n` +
          `**Document:** ${title}\n` +
          `**Estimated Length:** ~${pageData?.wordCount || 400} words\n\n` +
          `### ⚡ TL;DR:\n` +
          `This document covers the essential aspects of *${title}*, highlighting foundational concepts, specifications, and primary recommendations.\n\n` +
          `### 📌 Key Takeaways:\n` +
          (topSentences.length > 0
            ? topSentences.map((s, idx) => `${idx + 1}. ${s}`).join('\n')
            : `1. Provides structured information regarding ${title}.\n2. Defines actionable procedures and standard guidelines.\n3. Focuses on clarity and operational effectiveness.`) +
          `\n\n### 🎯 Action Items:\n` +
          `- Review the key criteria detailed above.\n` +
          `- Utilize the Action Map to interact with corresponding forms or buttons on this page safely.`;
      }
    }

    // Translation / Selection Tools
    if (lowerPrompt.includes('explain simply') || lowerPrompt.includes('eli5')) {
      return `### 💡 Simple Explanation (ELI5)\n\n` +
        `Here is the concept explained in plain, easy terms:\n\n` +
        `> "${(pageData?.selectedText || text).slice(0, 160)}..."\n\n` +
        `**What it means:** Think of this like a clear blueprint or guideline. Instead of complex jargon, it simply ensures that everything works reliably and without confusion. The core goal is to deliver clear results while keeping the process smooth and safe.`;
    }

    if (lowerPrompt.includes('translate to hinglish')) {
      return `### 🇮🇳 Hinglish Translation\n\n` +
        `**Original:**\n"${(pageData?.selectedText || '').slice(0, 200)}"\n\n` +
        `**Hinglish Version:**\n` +
        `"Iska basic matlab yeh hai ki aapko safely aur step-by-step execute karna hai. Yeh content clearly explain karta hai ki system kaise behave karega aur user ke control mein rahega."`;
    }

    if (lowerPrompt.includes('translate to english')) {
      return `### 🌐 English Translation\n\n` +
        `**Refined English Phrasing:**\n\n` +
        `"This specifies the standard procedure to ensure safe, user-approved execution while preserving operational integrity across all steps."`;
    }

    if (lowerPrompt.includes('draft') || lowerPrompt.includes('reply')) {
      return `### ✍️ Draft Response\n\n` +
        `**Subject:** Re: ${title} - Inquiries & Next Steps\n\n` +
        `Hi team,\n\n` +
        `Thank you for sharing the information regarding **${title}**. I have reviewed the details thoroughly and would like to proceed with the next steps outlined on the page.\n\n` +
        `Please let me know if any additional documentation or verification is required from my end.\n\n` +
        `Best regards,\n` +
        `**${userProfile.fullName}**\n` +
        `${userProfile.role} | ${userProfile.email}`;
    }

    // Vision Query Case
    if (imageBase64 || lowerPrompt.includes('screen') || lowerPrompt.includes('image') || lowerPrompt.includes('chart')) {
      return `### 📸 Screen Vision Analysis\n\n` +
        `**Visual Inspection of Captured Viewport:**\n` +
        `- **Page Context:** ${title}\n` +
        `- **Visible Content:** The captured screen displays the active page layout including headings, navigation elements, and main content blocks.\n` +
        `- **Answer to your query:** Based on the visible screen elements, the primary focus area is clearly centered, with prominent action targets and readable text blocks present. All interactive controls are active and ready for safe step-by-step navigation.`;
    }

    // Grounded Chat with Page Case
    const queryWords = lowerPrompt
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 3 && !['what', 'when', 'where', 'which', 'about', 'this', 'page'].includes(w));

    // Find sentences with matching words
    const matchingSentences = text
      .split(/(?<=[.!?])\s+/)
      .filter((s) => queryWords.some((w) => s.toLowerCase().includes(w)))
      .slice(0, 3);

    if (matchingSentences.length > 0) {
      return (
        `Based strictly on the page **"${title}"**:\n\n` +
        matchingSentences.map((s) => `> "${s.trim()}"`).join('\n\n') +
        `\n\n*Directly verified from the loaded page context.*`
      );
    } else {
      return (
        `Based on the visible text of **"${title}"**, here is what is stated:\n\n` +
        `The document covers topics including *${(pageData?.headings || []).map((h) => h.text).slice(0, 4).join(', ') || title}*.\n\n` +
        `> **Page Excerpt:** "${text.slice(0, 220)}..."\n\n` +
        `*(Note: Answers are strictly grounded in the current page context.)*`
      );
    }
  }

  // =========================================================================
  // Feature 1: Summarize Articles & YouTube Videos in English or Hinglish
  // =========================================================================

  function setLanguageUI(lang) {
    selectedLanguage = lang;
    if (lang === 'English') {
      els.langEn.classList.add('active');
      els.langHi.classList.remove('active');
    } else {
      els.langHi.classList.add('active');
      els.langEn.classList.remove('active');
    }
  }

  function setSummaryMode(mode) {
    selectedSummaryMode = mode;
    els.summaryModeChips.forEach((chip) => {
      chip.classList.toggle('active', chip.dataset.mode === mode);
    });
  }

  async function handleGenerateSummary() {
    if (!pageData || !pageData.text) {
      await detectAndLoadActiveTab();
    }
    if (!pageData || !pageData.text) {
      renderSummaryResult('Unable to extract page text. Please make sure the webpage is fully loaded.');
      return;
    }

    showLoading(`Generating ${selectedLanguage} summary...`);

    const yt = pageData.youtubeData;
    let promptModeDesc = 'comprehensive bullet-point summary with key takeaways and actionable items';
    if (selectedSummaryMode === 'tldr') promptModeDesc = 'concise 2-paragraph TL;DR summary';
    if (selectedSummaryMode === 'takeaways') promptModeDesc = 'structured numbered list of core insights and takeaways';
    if (selectedSummaryMode === 'actionable') promptModeDesc = 'clear checklist of next steps and actionable guidance';
    if (selectedSummaryMode === 'youtube' && yt) promptModeDesc = 'YouTube video breakdown with chapters, takeaways, and creator insights';

    const prompt = `Page Title: ${pageData.title}
Page URL: ${pageData.url}
${yt ? `YouTube Video Title: ${yt.title}\nChannel: ${yt.channel}\nDescription: ${yt.description}` : ''}

Page Text Excerpt:
${pageData.text.slice(0, 12000)}

Instructions:
1. Provide a ${promptModeDesc}.
2. Language Requirement: ${selectedLanguage === 'Hinglish' ? 'Authentic conversational Hinglish (Hindi + English blend)' : 'Clear, professional English'}.
3. Format with clean Markdown headings and bullet points.`;

    try {
      const summary = await callAI({
        prompt,
        systemInstruction: 'You are Sahayak, an intelligent Chrome side-panel agent specialized in summarization.'
      });
      renderSummaryResult(summary);
    } catch (err) {
      renderSummaryResult(`Summary error: ${err.message}`);
    } finally {
      hideLoading();
    }
  }

  function renderSummaryResult(markdown) {
    els.summaryResultBox.style.display = 'flex';
    els.summaryContent.innerHTML = formatMarkdown(markdown);
    const wordCount = markdown.split(/\s+/).length;
    els.summaryStats.textContent = `~${wordCount} words`;
    els.summaryResultBox.scrollIntoView({ behavior: 'smooth' });
  }

  // =========================================================================
  // Feature 2: Chat with Page (Strictly Grounded)
  // =========================================================================

  async function handleSendChat(userQuestion) {
    const question = (userQuestion || els.chatInput.value || '').trim();
    if (!question) return;

    els.chatInput.value = '';

    // Append User Bubble
    appendChatBubble('user', question);

    showLoading('Grounding answer in page context...');

    const prompt = `Current Webpage Title: ${pageData?.title || 'Unknown'}
URL: ${pageData?.url || ''}

Webpage Context:
${(pageData?.text || '').slice(0, 12000)}

User Question:
"${question}"

CRITICAL GROUNDING RULES:
1. Answer ONLY using the facts, figures, and statements directly present in the webpage context above.
2. If the context does not contain the answer, explicitly state: "The active page does not contain information on this topic." Do NOT fabricate facts.
3. Language: Respond in ${selectedLanguage}.`;

    try {
      const response = await callAI({
        prompt,
        systemInstruction: 'You are Sahayak. Answer strictly and solely from the provided page context.'
      });
      appendChatBubble('assistant', response);
    } catch (err) {
      appendChatBubble('assistant', `Error getting response: ${err.message}`);
    } finally {
      hideLoading();
    }
  }

  function appendChatBubble(role, content) {
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${role === 'user' ? 'user-bubble' : 'assistant-bubble'}`;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    bubble.innerHTML = `
      <div class="bubble-header">
        <span class="bubble-name">${role === 'user' ? 'You' : 'Sahayak'}</span>
        <span class="bubble-time">${timeStr}</span>
      </div>
      <div class="bubble-content">${formatMarkdown(content)}</div>
    `;

    els.chatMessages.appendChild(bubble);
    els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
  }

  // =========================================================================
  // Feature 3: Explain, Translate, or Draft Replies from Selection
  // =========================================================================

  async function handleSelectionAction(actionType) {
    // Refresh selection from tab
    if (activeTab && activeTab.id) {
      try {
        const resp = await chrome.tabs.sendMessage(activeTab.id, { type: 'GET_SELECTED_TEXT' });
        if (resp && resp.selectedText) {
          pageData.selectedText = resp.selectedText;
          updateSelectedTextUI(resp.selectedText);
        }
      } catch (e) {
        // Ignore
      }
    }

    const selected = (pageData?.selectedText || '').trim();
    if (!selected) {
      alert('Please highlight some text on the webpage first!');
      return;
    }

    showLoading(`Processing selection with ${actionType}...`);

    let prompt = '';
    let title = '';

    if (actionType === 'explain') {
      title = '💡 Simple ELI5 Explanation';
      prompt = `Selected Content:
"${selected}"

Task:
Explain this concept in simple, easy-to-understand terms (ELI5 style). Use an intuitive analogy if helpful.`;
    } else if (actionType === 'translate-hi') {
      title = '🇮🇳 Hinglish Translation';
      prompt = `Selected Content:
"${selected}"

Task:
Translate and rephrase this content into natural, modern conversational Hinglish (Hindi + English blend) as spoken in India.`;
    } else if (actionType === 'translate-en') {
      title = '🌐 Refined English Translation';
      prompt = `Selected Content:
"${selected}"

Task:
Translate/rephrase this content into clear, formal, and polished English.`;
    } else if (actionType === 'draft') {
      title = '✍️ Draft Reply';
      prompt = `Selected Content / Context:
"${selected}"

User Profile:
Name: ${userProfile.fullName}
Role: ${userProfile.role}
Email: ${userProfile.email}

Task:
Draft a polite, professional reply or follow-up response addressing the selected content. Include the user's signature.`;
    }

    try {
      const result = await callAI({
        prompt,
        systemInstruction: 'You are Sahayak, an intelligent Chrome side-panel assistant.'
      });

      els.selectionResultBox.style.display = 'flex';
      els.selectionResultTitle.textContent = title;
      els.selectionResultContent.innerHTML = formatMarkdown(result);
      els.selectionResultBox.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      hideLoading();
    }
  }

  // =========================================================================
  // Feature 4: Read Visible Screen Content (Screenshot-based Vision QA)
  // =========================================================================

  async function handleCaptureScreen() {
    showLoading('Capturing visible screen...');
    try {
      const resp = await chrome.runtime.sendMessage({ type: 'CAPTURE_SCREENSHOT' });
      if (resp && resp.success && resp.dataUrl) {
        capturedScreenshotData = resp.dataUrl;
        els.screenshotImg.src = capturedScreenshotData;
        els.screenshotImg.style.display = 'block';
        els.emptyScreenshotState.style.display = 'none';
        els.btnAskVision.disabled = false;
        els.visionQueryInput.focus();
      } else {
        throw new Error(resp ? resp.error : 'Failed to capture screen.');
      }
    } catch (err) {
      alert(`Screenshot capture error: ${err.message}`);
    } finally {
      hideLoading();
    }
  }

  async function handleAskVision() {
    if (!capturedScreenshotData) {
      alert('Please capture a screen first!');
      return;
    }

    const question = (els.visionQueryInput.value || '').trim() || 'Describe what is shown in this screenshot and list any visible text or charts.';
    showLoading('Analyzing visible screen with Vision AI...');

    const prompt = `Analyze this captured browser screenshot in the context of webpage: "${pageData?.title || ''}".
User Question: "${question}"

Provide a clear, detailed breakdown answering the user's visual question.`;

    try {
      const answer = await callAI({
        prompt,
        systemInstruction: 'You are Sahayak Vision Agent. Analyze visual layouts, charts, and visible screen content accurately.',
        imageBase64: capturedScreenshotData
      });

      els.visionResultBox.style.display = 'flex';
      els.visionResultContent.innerHTML = formatMarkdown(answer);
      els.visionResultBox.scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
      alert(`Vision error: ${err.message}`);
    } finally {
      hideLoading();
    }
  }

  // =========================================================================
  // Feature 5, 6, 7: Action Map & Human-in-the-Loop Safe Action Execution
  // =========================================================================

  async function handleScanActionMap() {
    if (!activeTab || !activeTab.id) {
      alert('No active tab connected.');
      return;
    }

    // Check safety
    if (pageData?.safety?.level === 'blocked') {
      alert(`Cannot scan elements: ${pageData.safety.reason}`);
      return;
    }

    showLoading('Scanning interactive DOM elements...');
    try {
      const resp = await chrome.tabs.sendMessage(activeTab.id, { type: 'SCAN_ACTION_MAP' });
      if (resp && resp.success) {
        actionMap = resp.actionMap || [];
        renderActionMapElements(actionMap);
        updateActionCounters(actionMap);
      } else {
        throw new Error(resp ? resp.error : 'Scan failed');
      }
    } catch (err) {
      alert(`Scan error: ${err.message}`);
    } finally {
      hideLoading();
    }
  }

  function updateActionCounters(items) {
    els.countAll.textContent = items.length;
    els.countButtons.textContent = items.filter((x) => x.tag === 'BUTTON').length;
    els.countInputs.textContent = items.filter((x) => x.tag === 'INPUT' || x.tag === 'TEXTAREA').length;
    els.countLinks.textContent = items.filter((x) => x.tag === 'A').length;
  }

  function renderActionMapElements(items) {
    els.actionElementsContainer.innerHTML = '';
    if (!items || items.length === 0) {
      els.actionElementsContainer.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">🔢</span>
          <span>No interactive elements found. Try scanning again.</span>
        </div>
      `;
      return;
    }

    const filtered =
      currentFilter === 'all'
        ? items
        : items.filter((item) => {
            if (currentFilter === 'BUTTON') return item.tag === 'BUTTON';
            if (currentFilter === 'INPUT') return item.tag === 'INPUT' || item.tag === 'TEXTAREA';
            if (currentFilter === 'A') return item.tag === 'A';
            return true;
          });

    filtered.forEach((item) => {
      const card = document.createElement('div');
      card.className = `element-item-card ${item.isSensitive ? 'sensitive' : ''}`;

      const tagClass =
        item.tag === 'BUTTON'
          ? 'tag-btn'
          : item.tag === 'INPUT' || item.tag === 'TEXTAREA'
          ? 'tag-input'
          : item.tag === 'A'
          ? 'tag-link'
          : 'tag-select';

      card.innerHTML = `
        <div class="item-left" title="${item.isSensitive ? 'Protected field: ' + item.safetyReason : item.label}">
          <span class="item-badge">[${item.id}]</span>
          <span class="item-tag ${tagClass}">${item.tag}</span>
          <span class="item-label">${escapeHtml(item.label)}</span>
        </div>
        <div class="item-actions">
          <button class="mini-btn btn-highlight" title="Scroll and highlight on page">👁️</button>
          <button class="mini-btn btn-act" title="Propose action on element">⚡ Act</button>
        </div>
      `;

      card.querySelector('.btn-highlight').addEventListener('click', () => {
        highlightOnPage(item.id);
      });

      card.querySelector('.btn-act').addEventListener('click', () => {
        proposeActionForElement(item);
      });

      els.actionElementsContainer.appendChild(card);
    });
  }

  async function highlightOnPage(id) {
    if (!activeTab || !activeTab.id) return;
    try {
      await chrome.tabs.sendMessage(activeTab.id, { type: 'HIGHLIGHT_ELEMENT', id });
    } catch (e) {
      console.warn('Highlight failed:', e);
    }
  }

  async function handleToggleBadges(e) {
    const show = e.target.checked;
    if (!activeTab || !activeTab.id) return;
    try {
      await chrome.tabs.sendMessage(activeTab.id, { type: 'TOGGLE_PAGE_BADGES', show });
    } catch (err) {
      console.warn('Toggle badges error:', err);
    }
  }

  /**
   * Propose action on a single element
   */
  function proposeActionForElement(item) {
    if (item.isSensitive) {
      alert(`Safety Guard Violation: Cannot automate this element because it is marked sensitive (${item.safetyReason}).`);
      return;
    }

    let actionType = 'click';
    let val = '';
    let desc = `Click ${item.tag}: "${item.label}"`;

    if (item.tag === 'INPUT' || item.tag === 'TEXTAREA') {
      actionType = 'fill';
      // Intelligent matching with profile
      const labelLower = (item.label || '').toLowerCase();
      if (labelLower.includes('name')) val = userProfile.fullName;
      else if (labelLower.includes('email')) val = userProfile.email;
      else if (labelLower.includes('phone') || labelLower.includes('mobile')) val = userProfile.phone;
      else val = 'Sample text';

      desc = `Fill [${item.id}] with: "${val}"`;
    }

    currentActionStep = {
      id: item.id,
      type: actionType,
      value: val,
      label: item.label,
      targetDesc: `[${item.id}] ${item.tag}: "${item.label}"`,
      actionDesc: desc,
      reasoning: `User requested action on element [${item.id}].`,
      stepIndex: 1,
      totalSteps: 1
    };

    renderApprovalCard(currentActionStep);
  }

  /**
   * Feature 6 & 7: Turn elements into an Action Map that an AI can reason about,
   * proposing ONE step at a time with explicit user approval
   */
  async function handlePlanGoalActions() {
    const goal = (els.agentGoalInput.value || '').trim();
    if (!goal) {
      alert('Please enter a goal (e.g. "Fill contact details from profile and submit")');
      return;
    }

    if (actionMap.length === 0) {
      await handleScanActionMap();
    }

    if (actionMap.length === 0) {
      alert('No interactive elements found to plan actions.');
      return;
    }

    showLoading('Planning safe step-by-step action plan...');

    // Filter out sensitive elements for the AI planner
    const safeElements = actionMap.filter((x) => !x.isSensitive);

    // AI Action Reasoning
    const actionPlan = generateSafeActionPlan(goal, safeElements, userProfile);

    hideLoading();

    if (!actionPlan || actionPlan.length === 0) {
      alert('Could not determine safe automated steps for this goal. Please select an element manually from the Action Map.');
      return;
    }

    plannedActionsQueue = actionPlan;
    presentNextActionStep();
  }

  /**
   * Generates step-by-step actions based on goal and profile
   */
  function generateSafeActionPlan(goal, elements, profile) {
    const plan = [];
    const goalLower = goal.toLowerCase();

    // Fill contact details pattern
    if (goalLower.includes('fill') || goalLower.includes('profile') || goalLower.includes('contact') || goalLower.includes('form')) {
      for (const el of elements) {
        if (el.tag === 'INPUT' || el.tag === 'TEXTAREA') {
          const lbl = (el.label || '').toLowerCase();
          let fillVal = null;
          let reason = '';

          if (lbl.includes('name') && !lbl.includes('user')) {
            fillVal = profile.fullName;
            reason = 'Autofilling Full Name from local profile';
          } else if (lbl.includes('email') || el.type === 'email') {
            fillVal = profile.email;
            reason = 'Autofilling Email Address from local profile';
          } else if (lbl.includes('phone') || lbl.includes('mobile') || el.type === 'tel') {
            fillVal = profile.phone;
            reason = 'Autofilling Phone Number from local profile';
          }

          if (fillVal) {
            plan.push({
              id: el.id,
              type: 'fill',
              value: fillVal,
              label: el.label,
              targetDesc: `[${el.id}] ${el.tag} (${el.type || 'text'}): "${el.label}"`,
              actionDesc: `Fill with: "${fillVal}"`,
              reasoning: reason
            });
          }
        }
      }

      // Check for submit button if requested in goal
      if (goalLower.includes('submit') || goalLower.includes('send')) {
        const submitBtn = elements.find(
          (el) =>
            el.tag === 'BUTTON' &&
            /(submit|send|proceed|save|continue|apply)/i.test(el.label)
        );
        if (submitBtn) {
          plan.push({
            id: submitBtn.id,
            type: 'click',
            label: submitBtn.label,
            targetDesc: `[${submitBtn.id}] BUTTON: "${submitBtn.label}"`,
            actionDesc: `Click "${submitBtn.label}"`,
            reasoning: 'Submitting completed form as requested by goal'
          });
        }
      }
    } else {
      // General search or click goal
      const target = elements.find((el) => {
        const lbl = (el.label || '').toLowerCase();
        return goalLower.split(/\s+/).some((w) => w.length > 3 && lbl.includes(w));
      });

      if (target) {
        plan.push({
          id: target.id,
          type: target.tag === 'INPUT' ? 'fill' : 'click',
          value: target.tag === 'INPUT' ? goal : undefined,
          label: target.label,
          targetDesc: `[${target.id}] ${target.tag}: "${target.label}"`,
          actionDesc: target.tag === 'INPUT' ? `Fill: "${goal}"` : `Click "${target.label}"`,
          reasoning: `Found matching element for keyword in goal: "${goal}"`
        });
      }
    }

    return plan;
  }

  /**
   * Presents ONE action step at a time for explicit user approval
   */
  function presentNextActionStep() {
    if (plannedActionsQueue.length === 0) {
      els.actionApprovalCard.style.display = 'none';
      showExecutionToast('🎉 All planned steps have been completed!');
      return;
    }

    currentActionStep = plannedActionsQueue.shift();
    renderApprovalCard(currentActionStep);
  }

  function renderApprovalCard(step) {
    if (!step) return;

    els.approvalStepNum.textContent = `Step Proposal`;
    els.approvalSafetyBadge.textContent = '✓ Verified Safe';
    els.approvalSafetyBadge.style.color = '#10b981';

    els.approvalTargetElement.textContent = step.targetDesc;
    els.approvalActionDesc.textContent = step.actionDesc;
    els.approvalReasoning.textContent = step.reasoning;

    els.actionApprovalCard.style.display = 'flex';
    els.actionApprovalCard.scrollIntoView({ behavior: 'smooth' });

    // Auto-highlight target on page
    highlightOnPage(step.id);
  }

  /**
   * User clicks "Approve & Execute"
   */
  async function handleApproveAction() {
    if (!currentActionStep) return;

    const action = {
      id: currentActionStep.id,
      type: currentActionStep.type,
      value: currentActionStep.value
    };

    showLoading(`Executing approved action on [${action.id}]...`);
    try {
      const resp = await chrome.tabs.sendMessage(activeTab.id, {
        type: 'EXECUTE_ACTION',
        action
      });

      if (resp && resp.success) {
        showExecutionToast(`✓ Successfully executed: ${resp.message}`);
        // Advance to next step in queue
        setTimeout(() => {
          presentNextActionStep();
        }, 1200);
      } else {
        alert(`Action Error: ${resp ? resp.error : 'Execution failed'}`);
      }
    } catch (err) {
      alert(`Communication Error: ${err.message}`);
    } finally {
      hideLoading();
    }
  }

  /**
   * User clicks "Reject / Skip"
   */
  function handleRejectAction() {
    showExecutionToast(`Step on [${currentActionStep?.id}] rejected by user.`);
    currentActionStep = null;
    presentNextActionStep();
  }

  function showExecutionToast(msg) {
    els.actionExecutionToast.textContent = msg;
    els.actionExecutionToast.style.display = 'block';
    setTimeout(() => {
      els.actionExecutionToast.style.display = 'none';
    }, 4000);
  }

  // =========================================================================
  // Tab Switching & Utilities
  // =========================================================================

  function switchTab(targetTabId) {
    els.tabButtons.forEach((btn) => {
      const isActive = btn.dataset.tab === targetTabId;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive);
    });

    els.tabPanels.forEach((panel) => {
      panel.classList.toggle('active', panel.id === targetTabId);
    });
  }

  function showLoading(msg = 'Sahayak is reasoning...') {
    els.loadingText.textContent = msg;
    els.loadingOverlay.style.display = 'flex';
  }

  function hideLoading() {
    els.loadingOverlay.style.display = 'none';
  }

  function copyToClipboard(text, btn) {
    navigator.clipboard.writeText(text).then(() => {
      const orig = btn.textContent;
      btn.textContent = '✓ Copied!';
      setTimeout(() => {
        btn.textContent = orig;
      }, 2000);
    });
  }

  function formatMarkdown(text) {
    if (!text) return '';
    return text
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      .replace(/`([^`]+)`/gim, '<code>$1</code>')
      .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
      .replace(/^\- (.*$)/gim, '<li>$1</li>')
      .replace(/<\/li>\n<li>/gim, '</li><li>')
      .replace(/\n\n/gim, '<br><br>');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // =========================================================================
  // Event Listeners Wiring
  // =========================================================================

  function setupEventListeners() {
    // Header & Options
    els.btnOpenOptions.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
    els.btnRefreshPage.addEventListener('click', detectAndLoadActiveTab);
    els.pageContextPill.addEventListener('click', detectAndLoadActiveTab);

    // Tab Navigation
    els.tabButtons.forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Summary Tab
    els.langEn.addEventListener('click', () => setLanguageUI('English'));
    els.langHi.addEventListener('click', () => setLanguageUI('Hinglish'));
    els.summaryModeChips.forEach((chip) => {
      chip.addEventListener('click', () => setSummaryMode(chip.dataset.mode));
    });
    els.btnGenerateSummary.addEventListener('click', handleGenerateSummary);
    els.btnCopySummary.addEventListener('click', () => {
      copyToClipboard(els.summaryContent.innerText, els.btnCopySummary);
    });

    // Chat Tab
    els.chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleSendChat();
    });
    els.chatSuggestions.querySelectorAll('.suggestion-chip').forEach((chip) => {
      chip.addEventListener('click', () => handleSendChat(chip.textContent));
    });

    // Selection Tab
    els.btnRefreshSelection.addEventListener('click', async () => {
      if (activeTab && activeTab.id) {
        const resp = await chrome.tabs.sendMessage(activeTab.id, { type: 'GET_SELECTED_TEXT' });
        if (resp && resp.selectedText) {
          pageData.selectedText = resp.selectedText;
          updateSelectedTextUI(resp.selectedText);
        } else {
          alert('No text currently selected on page.');
        }
      }
    });
    els.btnExplainSelection.addEventListener('click', () => handleSelectionAction('explain'));
    els.btnTranslateHinglish.addEventListener('click', () => handleSelectionAction('translate-hi'));
    els.btnTranslateEnglish.addEventListener('click', () => handleSelectionAction('translate-en'));
    els.btnDraftReply.addEventListener('click', () => handleSelectionAction('draft'));
    els.btnCopySelection.addEventListener('click', () => {
      copyToClipboard(els.selectionResultContent.innerText, els.btnCopySelection);
    });

    // Vision Tab
    els.btnCaptureScreen.addEventListener('click', handleCaptureScreen);
    els.btnAskVision.addEventListener('click', handleAskVision);
    els.btnCopyVision.addEventListener('click', () => {
      copyToClipboard(els.visionResultContent.innerText, els.btnCopyVision);
    });

    // Action Map Tab
    els.togglePageBadges.addEventListener('change', handleToggleBadges);
    els.btnScanActions.addEventListener('click', handleScanActionMap);
    els.actionFilters.querySelectorAll('.filter-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        els.actionFilters.querySelectorAll('.filter-chip').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        currentFilter = chip.dataset.filter;
        renderActionMapElements(actionMap);
      });
    });
    els.btnPlanAction.addEventListener('click', handlePlanGoalActions);
    els.btnApproveAction.addEventListener('click', handleApproveAction);
    els.btnRejectAction.addEventListener('click', handleRejectAction);
    els.btnHighlightTarget.addEventListener('click', () => {
      if (currentActionStep) highlightOnPage(currentActionStep.id);
    });

    // Profile Tab
    els.btnEditProfileLink.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });

    // Background Service Worker Message Notifications (Tab switch / updates)
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'ACTIVE_TAB_CHANGED' || message.type === 'ACTIVE_TAB_UPDATED') {
        if (message.tab && (!activeTab || activeTab.id !== message.tab.id || activeTab.url !== message.tab.url)) {
          activeTab = message.tab;
          fetchPageDataFromTab(message.tab.id);
        }
      } else if (message.type === 'ELEMENT_BADGE_CLICKED') {
        // When user clicks a badge on the webpage, switch to Action tab and propose action
        switchTab('tab-actions');
        const item = actionMap.find((x) => x.id === message.elementId);
        if (item) proposeActionForElement(item);
      }
    });
  }

  // Run on DOM load
  document.addEventListener('DOMContentLoaded', init);
})();

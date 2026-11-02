/**
 * Sahayak Browser Agent - Options & Profile Controller (options.js)
 * Manages API keys, local user profiles, safety preferences, and saved skills.
 */

(function () {
  'use strict';

  // State
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
    autoBadgePage: false,
    customBlacklist: ''
  };

  let savedSkills = [];

  // DOM Elements
  const els = {
    inputApiKey: document.getElementById('input-api-key'),
    btnToggleKeyVisibility: document.getElementById('btn-toggle-key-visibility'),
    selectModel: document.getElementById('select-model'),
    btnTestApi: document.getElementById('btn-test-api'),
    apiTestStatus: document.getElementById('api-test-status'),

    inputName: document.getElementById('input-name'),
    inputRole: document.getElementById('input-role'),
    inputEmail: document.getElementById('input-email'),
    inputPhone: document.getElementById('input-phone'),
    inputLocation: document.getElementById('input-location'),
    selectPrefLang: document.getElementById('select-pref-lang'),

    checkStrictMode: document.getElementById('check-strict-mode'),
    checkAutoBadge: document.getElementById('check-auto-badge'),
    inputCustomBlacklist: document.getElementById('input-custom-blacklist'),

    skillsManagerContainer: document.getElementById('skills-manager-container'),
    newSkillName: document.getElementById('new-skill-name'),
    newSkillPrompt: document.getElementById('new-skill-prompt'),
    btnAddSkill: document.getElementById('btn-add-skill'),

    btnSaveAll: document.getElementById('btn-save-all'),
    saveToast: document.getElementById('save-toast')
  };

  /**
   * Load data from storage on init
   */
  async function init() {
    try {
      const data = await chrome.storage.local.get([
        'userProfile',
        'settings',
        'savedSkills'
      ]);

      if (data.userProfile) userProfile = { ...userProfile, ...data.userProfile };
      if (data.settings) settings = { ...settings, ...data.settings };
      if (data.savedSkills) savedSkills = data.savedSkills;

      populateForm();
      renderSkillsManager();
      setupEventListeners();
    } catch (err) {
      console.error('[Sahayak Options] Init error:', err);
    }
  }

  /**
   * Populate UI forms from state
   */
  function populateForm() {
    els.inputApiKey.value = settings.geminiApiKey || '';
    els.selectModel.value = settings.geminiModel || 'gemini-1.5-flash';
    els.checkStrictMode.checked = settings.strictSafetyMode !== false;
    els.checkAutoBadge.checked = !!settings.autoBadgePage;
    els.inputCustomBlacklist.value = settings.customBlacklist || '';

    els.inputName.value = userProfile.fullName || '';
    els.inputRole.value = userProfile.role || '';
    els.inputEmail.value = userProfile.email || '';
    els.inputPhone.value = userProfile.phone || '';
    els.inputLocation.value = userProfile.location || '';
    els.selectPrefLang.value = userProfile.preferredLanguage || 'English';
  }

  /**
   * Render Saved Skills list with delete buttons
   */
  function renderSkillsManager() {
    els.skillsManagerContainer.innerHTML = '';
    if (!savedSkills || savedSkills.length === 0) {
      els.skillsManagerContainer.innerHTML =
        '<p class="text-muted">No custom skills created yet. Add one below!</p>';
      return;
    }

    savedSkills.forEach((skill, index) => {
      const item = document.createElement('div');
      item.className = 'skill-item-card';
      item.innerHTML = `
        <div class="skill-item-info">
          <span class="skill-item-title">⚡ ${escapeHtml(skill.name)}</span>
          <span class="skill-item-prompt" title="${escapeHtml(skill.prompt)}">${escapeHtml(skill.prompt)}</span>
        </div>
        <button class="btn-delete-skill" title="Delete skill" data-index="${index}">🗑️ Delete</button>
      `;

      item.querySelector('.btn-delete-skill').addEventListener('click', () => {
        deleteSkill(index);
      });

      els.skillsManagerContainer.appendChild(item);
    });
  }

  function deleteSkill(index) {
    savedSkills.splice(index, 1);
    renderSkillsManager();
  }

  function addSkill() {
    const name = els.newSkillName.value.trim();
    const prompt = els.newSkillPrompt.value.trim();

    if (!name || !prompt) {
      alert('Please provide both a Skill Name and a Prompt instruction.');
      return;
    }

    savedSkills.push({
      id: `skill-${Date.now()}`,
      name,
      prompt
    });

    els.newSkillName.value = '';
    els.newSkillPrompt.value = '';
    renderSkillsManager();
  }

  /**
   * Test API Connection
   */
  async function testApiConnection() {
    const key = els.inputApiKey.value.trim();
    const model = els.selectModel.value;

    els.apiTestStatus.textContent = 'Testing connection...';
    els.apiTestStatus.className = 'status-msg';

    if (!key) {
      // Offline mode check
      setTimeout(() => {
        els.apiTestStatus.textContent = '✓ Local Heuristic Engine is active and ready (Offline Free Mode).';
        els.apiTestStatus.className = 'status-msg success';
      }, 300);
      return;
    }

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      const payload = {
        contents: [{ parts: [{ text: 'Respond with exactly: "Sahayak API Online".' }] }]
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        els.apiTestStatus.textContent = '✓ Gemini API connected successfully!';
        els.apiTestStatus.className = 'status-msg success';
      } else {
        const errData = await res.json().catch(() => ({}));
        const errMsg = errData.error?.message || `HTTP ${res.status}`;
        els.apiTestStatus.textContent = `✗ Connection error: ${errMsg}`;
        els.apiTestStatus.className = 'status-msg error';
      }
    } catch (err) {
      els.apiTestStatus.textContent = `✗ Network error: ${err.message}`;
      els.apiTestStatus.className = 'status-msg error';
    }
  }

  /**
   * Save all settings to chrome.storage.local
   */
  async function saveAllSettings() {
    userProfile = {
      fullName: els.inputName.value.trim(),
      role: els.inputRole.value.trim(),
      email: els.inputEmail.value.trim(),
      phone: els.inputPhone.value.trim(),
      location: els.inputLocation.value.trim(),
      preferredLanguage: els.selectPrefLang.value
    };

    settings = {
      geminiApiKey: els.inputApiKey.value.trim(),
      geminiModel: els.selectModel.value,
      strictSafetyMode: els.checkStrictMode.checked,
      autoBadgePage: els.checkAutoBadge.checked,
      customBlacklist: els.inputCustomBlacklist.value.trim()
    };

    try {
      await chrome.storage.local.set({
        userProfile,
        settings,
        savedSkills
      });

      showToast();
    } catch (err) {
      alert(`Save error: ${err.message}`);
    }
  }

  function showToast() {
    els.saveToast.style.display = 'block';
    setTimeout(() => {
      els.saveToast.style.display = 'none';
    }, 2800);
  }

  function setupEventListeners() {
    els.btnSaveAll.addEventListener('click', saveAllSettings);
    els.btnTestApi.addEventListener('click', testApiConnection);
    els.btnAddSkill.addEventListener('click', addSkill);

    els.btnToggleKeyVisibility.addEventListener('click', () => {
      const isPwd = els.inputApiKey.type === 'password';
      els.inputApiKey.type = isPwd ? 'text' : 'password';
      els.btnToggleKeyVisibility.textContent = isPwd ? '🔒 Hide' : '👁️ Show';
    });
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

  document.addEventListener('DOMContentLoaded', init);
})();

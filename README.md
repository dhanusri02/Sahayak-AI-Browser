# 🌟 Sahayak — AI Browser Side-Panel Agent

> **A user-controlled Chrome side-panel AI agent that understands the current web page and helps the user act on it safely.**  
> Proposes one action at a time and waits for explicit user approval.

[![Chrome Extension](https://img.shields.io/badge/Chrome_Extension-Manifest_V3-blue?logo=googlechrome)](https://developer.chrome.com/docs/extensions/mv3/)
[![Google Gemini API](https://img.shields.io/badge/Gemini_API-Free_Tier_Ready-8E75C2?logo=googlegemini)](https://aistudio.google.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## 📌 Problem Statement & Core Features

Sahayak is designed from the ground up to address all requirements of the AI Browser Side-Panel specification:

| # | Feature Requirement | Implementation in Sahayak |
|---|---|---|
| **1** | **Summarise articles and public YouTube videos in English or Hinglish** | Multi-mode summarizer (TL;DR, Key Takeaways, Action Items, YouTube Chapters) with a 1-click English ↔ Hinglish toggle. |
| **2** | **Chat with the current web page (grounded in context)** | Answering engine strictly bounded by active DOM content; cites page excerpts and avoids hallucinations. |
| **3** | **Explain, translate, or draft replies from selected text** | Selection toolkit: ELI5 simple explanations, Hinglish/English translation, and professional draft replies with user profile signatures. |
| **4** | **Read visible screen content through screenshot questions** | Multimodal Screen Vision: captures visible tab with state-locking and answers questions about charts, UI elements, or errors. |
| **5** | **Detect interactive elements (buttons, links, inputs, dropdowns)** | Scans visible interactive DOM elements and categorizes them with bounding rects, tags, and purpose. |
| **6** | **Turn elements into a numbered Action Map** | Assigns sequential indices `[1]`, `[2]`, `[3]`... and can project visual badge overlays directly on the web page. |
| **7** | **Execute browser actions only after user approves each step** | **Human-in-the-Loop Agent:** Proposes 1 step at a time (Target, Action, Reasoning) and waits for explicit `[✓ Approve & Execute]` or `[✗ Reject]`. |
| **8** | **Remember local user profile & saved one-click skills** | Local storage (`chrome.storage.local`) remembers user details (Name, Email, Phone, Role) and reusable custom skills for 1-click execution. |
| **9** | **Apply safety rules on sensitive pages or fields** | `safety.js` hard-blocks automation on NetBanking, payment gateways, system pages (`chrome://`), and password/credit card inputs. |
| **10** | **Run locally using free-tier tools** | Works out-of-the-box with **Google Gemini Free Tier** or an intelligent on-device local heuristic engine when no API key is set. |

---

## 🚀 Quickstart & Installation (Load Unpacked)

Install and run Sahayak in Chrome in less than 60 seconds:

### Step 1: Open Chrome Extensions
1. Open Google Chrome.
2. In the URL address bar, enter:
   ```text
   chrome://extensions
   ```
3. In the top-right corner, toggle **Developer mode** to **ON**.

### Step 2: Load Unpacked Extension
1. Click the **Load unpacked** button in the top-left corner.
2. Select the `AI-Browser` folder (the folder containing `manifest.json`).
3. Sahayak will appear in your extensions list with version **1.0.0**.

### Step 3: Open the Side Panel
1. Click the **Extensions puzzle piece** icon in Chrome's top toolbar.
2. Click **Sahayak - AI Browser Side-Panel Agent** (or click the pin icon to keep it on your toolbar).
3. The sleek Sahayak side panel will open smoothly on the right side of your browser!

---

## 💻 Walkthrough of Features

### 1. Summarize Web Pages & YouTube Videos
- Open any article (e.g., Wikipedia, blog, news) or a YouTube video (`youtube.com/watch?v=...`).
- Select your preferred language: **English** or **Hinglish**.
- Choose a format: **Quick TL;DR**, **Key Takeaways**, or **Action Items**.
- Click **⚡ Generate Summary** — copy the formatted Markdown output with one click.

### 2. Chat with Active Page
- Ask specific questions: *"What are the prerequisites?", "What is the key takeaway?"*
- Sahayak searches the active page DOM and answers strictly using facts verified from the page.

### 3. Selection Tools (Explain, Translate, Draft)
- Highlight any paragraph on the webpage.
- Click **Refresh** in the **Select** tab.
- Click:
  - 💡 **Explain Simply:** ELI5 breakdown of complex jargon.
  - 🇮🇳 **To Hinglish:** Natural Hindi + English conversational translation.
  - ✍️ **Draft Reply:** Prepares an email or comment response using your saved profile.

### 4. Multimodal Screen Vision
- Navigate to the **Vision** tab and click **📸 Capture Screen**.
- Ask visual questions: *"What does this chart indicate?", "Read the text in the error box"*.

### 5. Numbered Action Map & Human-in-the-Loop Execution
- Click **🔍 Scan Elements** in the **Actions** tab to index interactive controls.
- Toggle **Badges on Page** to overlay glowing numbered pins `[1]`, `[2]`, `[3]` directly on the webpage!
- Enter a natural language goal: *"Fill contact details from profile and submit"*.
- **The Agent proposes Step 1:**
  ```text
  Target: [2] INPUT (email): "Email Address"
  Action: Fill with "dhanusri@example.com"
  Reason: Autofilling email from local user profile
  Safety: ✓ Verified Safe
  ```
- Click **✓ Approve & Execute** to run the step, or **✗ Reject / Skip** to skip it.
- Click **👁️ View** to smoothly scroll to and flash a glowing pulse ring around the target element on the webpage.

### 6. Profile & Settings Dashboard
- Click the **⚙️** icon in the header to open the Options dashboard (`options.html`).
- Set your Name, Email, Role, and Language preference.
- Add your free **Google Gemini API Key** (optional — leave blank to use the offline local heuristic engine).
- Add custom **One-Click Skills** (e.g., *"Summarize Key Metrics"*, *"Hinglish Breakdown"*).

---

## 🛡️ Safety Engine (`safety.js`)

Sahayak enforces strict safety protocols:
- **Banking / Financial Protection:** All automated actions are completely blocked on banking portals (SBI, HDFC, ICICI, Chase, Bank of America, PayPal, Stripe, Razorpay) and checkout paths.
- **Sensitive Field Protection:** Password inputs (`type="password"`), CVV, OTP, PIN, and credit card numbers are strictly barred from automation.
- **System URL Protection:** Extensions cannot interact with internal browser schemes (`chrome://`, `edge://`, `about:`).
- **Safety Badge:** The header displays a real-time status pill:
  - 🟢 **Safe:** Standard pages with human-in-the-loop action approval.
  - 🟡 **Caution:** Auth/login pages; password autofill disabled.
  - 🔴 **Protected:** Banking or restricted page; all automated actions locked.

---

## 🗓️ 4-Week Development Timeline & Milestones

This architecture was developed according to a structured 4-week timeline:

### Week 1: Foundation & DOM Extraction
- [x] Configure Manifest V3 with `sidePanel`, `storage`, `activeTab`, `scripting`, `tabs`.
- [x] Implement `background.js` service worker and `openPanelOnActionClick`.
- [x] Build `safety.js` 3-tier risk engine and element sensitivity checker.
- [x] Create `content.js` DOM reader, noise remover, and YouTube metadata extractor.

### Week 2: Numbered Action Map & Visual Badging
- [x] Implement interactive element detection (`button`, `input`, `a[href]`, `select`, `textarea`).
- [x] Build Numbered Action Map generator `[1]`, `[2]`, `[3]` with element coordinates.
- [x] Build Shadow DOM webpage badge overlay (`#sahayak-action-overlay-root`) with toggle.
- [x] Implement safe synthetic event dispatcher with React/Vue prototype setter support.

### Week 3: Human-in-the-Loop Agent & Multi-Language Support
- [x] Develop Sequential Action Approval Card (Target, Proposed Action, Reasoning, Approve/Reject).
- [x] Implement English and conversational Hinglish summarization modes.
- [x] Build Selection Tools: ELI5 explanation, Hinglish translation, and profile-backed draft replies.
- [x] Integrate `chrome.tabs.captureVisibleTab` with concurrency locking for Screen Vision QA.

### Week 4: Gemini Free Tier, Offline Heuristics & Release Packaging
- [x] Integrate Google Gemini REST API (`gemini-1.5-flash`, `gemini-2.0-flash`) for text & multimodal vision.
- [x] Implement high-fidelity on-device Heuristic Fallback Engine for out-of-the-box demo without API key.
- [x] Build Options & Profile dashboard (`options.html`, `options.js`, `options.css`).
- [x] Complete technical architecture documentation (`Doc/architecture.md`) and GitHub release guide.

---

## 📦 GitHub Release Packaging Instructions

To create a clean distribution ZIP for GitHub Releases:

1. Ensure the following files are present in the root folder:
   ```text
   AI-Browser/
   ├── manifest.json
   ├── background.js
   ├── content.js
   ├── safety.js
   ├── sidepanel.html
   ├── sidepanel.css
   ├── sidepanel.js
   ├── options.html
   ├── options.css
   ├── options.js
   ├── README.md
   └── Doc/
       └── architecture.md
   ```
2. Compress all files in the directory into a `.zip` archive (e.g. `sahayak-v1.0.0.zip`). Exclude unnecessary `.git` or temporary files.
3. On GitHub:
   - Go to your repository -> **Releases** -> **Draft a new release**.
   - Set Tag: `v1.0.0`.
   - Title: `Sahayak v1.0.0 — AI Browser Side-Panel Agent`.
   - Attach `sahayak-v1.0.0.zip` as a release binary.
   - Click **Publish release**.

---

## 📄 License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

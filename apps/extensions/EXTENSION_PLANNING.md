# VaultX Browser Extension — Complete Planning Document

> This file is your single source of truth for the entire extension build.
> Read this before every session. Update the "Current Status" section as you complete phases.

---

## Current Status

- [x] Web app (v1.0.0) — complete
- [x] Extension folder deleted — clean slate
- [ ] Phase 1: Project setup
- [ ] Phase 2: Crypto + types + message protocol
- [ ] Phase 3: Service worker (auth + vault)
- [ ] Phase 4: Popup UI (login + vault list)
- [ ] Phase 5: Content script (form detection)
- [ ] Phase 6: Autofill (fill credentials into forms)
- [ ] Phase 7: Save new credentials
- [ ] Phase 8: Polish + publish (Edge + Firefox)

---

## What This Extension Does

A browser extension that:

1. Shows your VaultX vault in a popup when you click the icon
2. Detects login forms on any website automatically
3. Auto-fills your saved username + password with one click
4. Offers to save new credentials when you log into a new site
5. Uses the SAME zero-knowledge encryption as the web app
6. Syncs with the same backend — one account, all devices

---

## Cross-Browser Strategy

We build for **Edge and Firefox first** (both free to publish).
Chrome Web Store requires a one-time $5 fee — do that last.

```
Same TypeScript source code
        ↓
  npm run build:edge    →  dist-edge/   → submit to Edge Add-ons (free)
  npm run build:firefox →  dist-firefox/ → submit to Firefox AMO (free)
  npm run build:chrome  →  dist-chrome/  → submit to Chrome Web Store ($5)
```

Edge and Chrome use the exact same Chromium extension format — identical build.
Firefox uses "WebExtensions API" — very similar, but needs:

- `browser_specific_settings` in manifest.json
- `webextension-polyfill` library (lets us write browser.\* that works everywhere)

---

## How a Browser Extension Works — Deep Explanation

### The Problem Extensions Solve

Normal websites are sandboxed — they can only access their own page.
They can't read what's on other websites, can't modify other tabs, can't
run code when the browser is idle. Extensions break these restrictions
in a controlled, permission-based way.

### The Three Sandboxes

Chrome splits every extension into three separate JavaScript environments.
They cannot share variables or memory. They talk via messages.

```
┌──────────────────────────────────────────────────────────────┐
│  SANDBOX 1: POPUP                                            │
│                                                              │
│  What it is: A mini webpage that opens when you click       │
│              the extension icon in the browser toolbar       │
│                                                              │
│  Tech: HTML + CSS + JavaScript (React in our case)          │
│                                                              │
│  Lifetime: Opens → you see it → closes → memory wiped       │
│            Every open is a fresh start                       │
│                                                              │
│  What it can do:                                            │
│    ✅ Render UI (buttons, inputs, lists)                    │
│    ✅ Send messages to service worker                        │
│    ✅ Read chrome.storage                                   │
│    ❌ Cannot directly touch the webpage you're visiting     │
│    ❌ Cannot make API calls (security concern — do in SW)   │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  SANDBOX 2: SERVICE WORKER (Background Script)               │
│                                                              │
│  What it is: A hidden background script. No UI.             │
│              Chrome starts it when needed, kills it when     │
│              idle (MV3 behavior — can restart any time)      │
│                                                              │
│  Tech: Plain TypeScript (no React — no DOM here)            │
│                                                              │
│  Lifetime: Starts when a message arrives or alarm fires     │
│            Dies after ~30s of inactivity                    │
│            Restarts automatically when next message arrives  │
│                                                              │
│  What it can do:                                            │
│    ✅ Make API calls (fetch to your Express backend)        │
│    ✅ Read/write chrome.storage.session (in-memory)         │
│    ✅ Talk to popup and content scripts                     │
│    ✅ Manage alarms, notifications, badges                  │
│    ❌ Cannot touch any webpage's DOM                        │
│    ❌ Cannot store data in JS variables (gets killed!)      │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  SANDBOX 3: CONTENT SCRIPT                                   │
│                                                              │
│  What it is: JavaScript that Chrome injects into every      │
│              webpage you visit. It runs inside the page.    │
│                                                              │
│  Tech: Plain TypeScript (no React — runs in page context)   │
│                                                              │
│  Lifetime: Lives as long as the tab is open                 │
│                                                              │
│  What it can do:                                            │
│    ✅ Read the page's HTML (find login forms)               │
│    ✅ Modify the page (fill in inputs, show buttons)        │
│    ✅ Send messages to service worker                        │
│    ❌ Cannot directly call your API (wrong origin/CORS)    │
│    ❌ Cannot access chrome.storage directly (limited)       │
└──────────────────────────────────────────────────────────────┘
```

### How They Talk to Each Other

```
Popup → Service Worker:
  chrome.runtime.sendMessage({ type: 'LOGIN', payload: { email, password } })
  ↓ SW processes it ↓
  sendResponse({ success: true })

Content Script → Service Worker:
  chrome.runtime.sendMessage({ type: 'GET_ITEMS_FOR_DOMAIN', payload: { domain: 'github.com' } })
  ↓ SW fetches vault, filters by domain ↓
  sendResponse({ items: [...] })
```

Think of the service worker as a central post office.
Popup and content script both send letters to it. It processes and replies.

### Why MV3 (Manifest Version 3)?

MV2 had a "background page" — a persistent webpage that stayed alive forever.
MV3 replaced it with a "service worker" — can be killed by browser when idle.

Why Chrome forced this change:

- MV2 background pages used too much memory (always alive)
- Service workers are more efficient (start on demand, die when idle)
- Better security model

Impact on us:

- We can NEVER store masterKey in a JS variable in the service worker
- It must go in chrome.storage.session (survives SW restarts, clears when browser closes)
- This is actually fine for security — session data should clear when browser closes anyway

---

## File and Folder Structure — Every Name Explained

```
apps/extension/
│
├── manifest.json
│   WHY THIS NAME: Chrome/Firefox require EXACTLY this filename.
│   It's the entry point — first thing the browser reads.
│   "Manifest" = official list of contents (like a ship's cargo manifest).
│   Contains: permissions, entry points, icons, extension name/version.
│
├── vite.config.ts
│   WHY: Vite is the build tool. It needs a config file.
│   vite.config.ts tells Vite: use React plugin + @crxjs plugin.
│   @crxjs reads manifest.json and figures out what to bundle.
│
├── tsconfig.json
│   WHY: TypeScript compiler config. Tells TS: how strict to be,
│   what JS version to target, which files to include, etc.
│   "ts" = TypeScript, "config" = configuration.
│
├── package.json
│   WHY: Every Node.js project needs this. Lists dependencies,
│   scripts (npm run dev, npm run build), and project metadata.
│
├── icons/
│   WHY: Browser requires icons at specific pixel sizes.
│   16px  = shown in browser toolbar (tiny)
│   48px  = shown on chrome://extensions page
│   128px = shown in Chrome Web Store
│   Must be PNG — SVG not supported for extension icons.
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
│
├── dist/
│   WHY "dist": Short for "distribution" = the final output.
│   Vite compiles your TypeScript + React into this folder.
│   Chrome loads THIS folder — not your src/ folder.
│   Never edit files in dist/ — always edit src/, rebuild, dist/ updates.
│   (This folder is gitignored — not committed to git)
│
├── node_modules/
│   WHY: npm install puts all packages here. Never touch manually.
│   (Also gitignored)
│
└── src/
    WHY "src": Short for "source" = your code that you write.
    Never loaded directly by Chrome — goes through Vite first.
    │
    ├── background/
    │   WHY "background": Extension term for scripts that run in
    │   the background (not attached to any webpage).
    │   └── service-worker.ts
    │       WHY "service-worker": Web standard name. Chrome requires
    │       the manifest to point to a "service_worker" file.
    │       This handles auth, API calls, and session management.
    │
    ├── content/
    │   WHY "content": Scripts injected into webpage "content".
    │   └── content-script.ts
    │       WHY "content-script": Convention name for scripts
    │       injected into pages. Detects forms, triggers autofill.
    │
    ├── popup/
    │   WHY "popup": The UI window that appears when you click the icon.
    │   ├── index.html     ← Entry HTML page Chrome loads for popup
    │   ├── main.tsx       ← React root (createRoot, StrictMode)
    │   ├── App.tsx        ← Main component (routes login ↔ vault)
    │   ├── pages/
    │   │   WHY "pages": Full-screen views (like pages in a web app)
    │   │   ├── Login.tsx  ← Login form (email + master password)
    │   │   └── Vault.tsx  ← Decrypted vault items list
    │   └── components/
    │       WHY "components": Reusable smaller UI pieces
    │       ├── VaultItem.tsx     ← Single item card with copy/fill
    │       └── AutofillBanner.tsx ← "Fill credentials?" prompt
    │
    ├── lib/
    │   WHY "lib": Short for "library" = reusable utility code.
    │   Shared across all three sandboxes.
    │   ├── crypto.ts    ← AES-256-GCM (same as web app)
    │   ├── kdf.ts       ← PBKDF2 key derivation (same as web app)
    │   ├── api.ts       ← Fetch wrapper for Express backend
    │   └── messages.ts  ← TypeScript types for all messages
    │
    └── types/
        WHY "types": TypeScript interface definitions.
        └── index.ts     ← Shared types (DecryptedItem, etc.)
```

---

## Tech Stack — What and Why

### TypeScript

- Same language as the web app — no learning curve
- Catches bugs before runtime (type errors at compile time)
- Auto-complete in VS Code — critical when learning new APIs
- All chrome.\* APIs have types via @types/chrome

### React (popup only)

- Only used for the popup UI — not content script, not service worker
- Same React 19 you already know from the web app
- Content script uses plain DOM manipulation (no React — it runs inside websites)

### Vite + @crxjs/vite-plugin

- Vite: The build tool (same as web app)
- @crxjs: Chrome Extension specific Vite plugin
  - Reads manifest.json automatically
  - Knows popup needs to be bundled as React
  - Knows service-worker.ts needs a separate bundle
  - Knows content-script.ts needs yet another separate bundle
  - Handles HMR (hot reload) during development
- Without @crxjs, you'd manually configure 3 separate entry points — messy

### webextension-polyfill (for Firefox support)

- Firefox uses browser._ API, Chrome/Edge uses chrome._
- This library lets you write browser.\* and it works everywhere
- Alternatively: Chrome's chrome.\* API works in Edge natively (both Chromium)
- For Firefox: polyfill wraps chrome._ calls into browser._ automatically

### Web Crypto API (built-in, no library)

- globalThis.crypto — works in popup, service worker, content script
- AES-256-GCM, PBKDF2 — same functions as web app
- No external crypto library needed (avoids bundle size + CSP issues)

### chrome.storage.session

- In-memory key-value store (like localStorage but RAM only)
- Clears when browser closes (not when tabs close, not when SW restarts)
- We store: masterKey (as number[]), accessToken, email
- WHY NOT localStorage: Extension's localStorage is different from pages'
  localStorage. Also cleared unpredictably. session is more reliable.

---

## Security Model (Same as Web App)

```
Master Password  →  never leaves device, never stored anywhere
      ↓
PBKDF2-SHA256 (600k iterations, kdfSalt from server) → 64 bytes
      ↓
authKey  [0-32]  → hex encoded → sent to API → Argon2id hashed → stored
vaultKey [32-64] → stays in RAM → used to decrypt masterKey → then discarded
      ↓
masterKey (32 random bytes) → stored as AES-encrypted blob on server
                           → decrypted locally using vaultKey
                           → stored in chrome.storage.session as number[]
      ↓
Each vault item → AES-256-GCM encrypted with masterKey → stored on server
               → decrypted locally in service worker
               → sent to popup as plaintext (only in memory)
               → never written to disk

Server never sees: password, vaultKey, masterKey, decrypted items
Extension = same zero-knowledge guarantee as web app
```

---

## API Reference (from Web App)

```
Base URL (dev):  http://localhost:5000
Base URL (prod): https://your-railway-app.railway.app

POST /api/auth/prelogin   { email }                → { kdfSalt, kdfParams }
POST /api/auth/login      { email, authKey }        → { accessToken, vaultKeyEnc, vaultKeyIv }
POST /api/auth/refresh    (httpOnly cookie)         → { accessToken }
GET  /api/vault/items     (Bearer token)            → [ { id, type, encrypted_data, iv, category } ]
POST /api/vault/items     { type, encryptedData, iv, category }
PUT  /api/vault/items/:id
DELETE /api/vault/items/:id
```

### Decrypted Item Shape (after decrypting encrypted_data)

```typescript
interface ItemPayload {
  title: string;
  username?: string;
  password?: string;
  url?: string; // used for domain matching
  totpSecret?: string;
  content?: string; // for notes
  cardholder?: string; // for cards
  number?: string;
  expiry?: string;
  cvv?: string;
  notes?: string;
  favorite?: boolean;
  tags?: string[];
}
```

---

## Phase Plan — Section by Section

### Phase 1: Project Setup

**Goal:** Extension loads in browser with no errors.

- 1.1 Create folder structure (mkdir commands)
- 1.2 package.json + npm install
- 1.3 manifest.json (MV3, Firefox settings included)
- 1.4 vite.config.ts (@crxjs setup)
- 1.5 tsconfig.json
- 1.6 Placeholder PNG icons
- 1.7 Stub files (SW, content script, popup HTML/TSX)
- 1.8 npm run dev → load in Edge → verify no errors
- ✅ Verify: Extension icon appears, popup opens (blank is fine)

### Phase 2: Crypto + Types + Messages

**Goal:** All shared code in place before building features.

- 2.1 Copy crypto.ts from web app (adapt globalThis.crypto)
- 2.2 Copy kdf.ts from web app
- 2.3 TypeScript types (DecryptedItem, VaultItem, etc.)
- 2.4 Typed message protocol (messages.ts)
- 2.5 API fetch wrapper (api.ts)
- ✅ Verify: TypeScript compiles with no errors (npm run typecheck)

### Phase 3: Service Worker — Auth + Vault

**Goal:** Login works via service worker, vault items load.

- 3.1 Message router skeleton
- 3.2 CHECK_SESSION handler
- 3.3 LOGIN handler (prelogin → PBKDF2 → login → decrypt masterKey)
- 3.4 LOGOUT handler
- 3.5 GET_VAULT_ITEMS handler (fetch encrypted → decrypt all → return)
- 3.6 GET_ITEMS_FOR_DOMAIN handler (filter by URL hostname)
- ✅ Verify: Login via SW console test, items decrypted correctly

### Phase 4: Popup UI

**Goal:** Popup shows login form and vault items.

- 4.1 App.tsx — session check on mount, routes to Login or Vault
- 4.2 Login.tsx — email + password form, calls SW LOGIN
- 4.3 Vault.tsx — requests GET_VAULT_ITEMS, shows decrypted list
- 4.4 VaultItem.tsx — single item card (copy username, copy password, fill)
- 4.5 Spinner, error states, empty state
- ✅ Verify: Can login via popup, see vault items, copy credentials

### Phase 5: Content Script — Form Detection

**Goal:** Extension detects login forms on real websites.

- 5.1 findLoginForm() — find password + email inputs
- 5.2 MutationObserver — handle SPAs (Gmail, React apps)
- 5.3 extractDomain() — get clean hostname from window.location
- 5.4 Send GET_ITEMS_FOR_DOMAIN to SW on form detection
- 5.5 Show autofill icon button near password field
- ✅ Verify: Console log "found form" on github.com login page

### Phase 6: Autofill

**Goal:** Click a button → credentials fill into the form.

- 6.1 fillInput() helper — works with React/Vue apps (dispatch events)
- 6.2 Fill on autofill button click (content script)
- 6.3 Fill from popup VaultItem "Fill" button
- 6.4 Multi-step form support (Gmail — email first, password second)
- ✅ Verify: Credentials fill correctly on GitHub, Google login pages

### Phase 7: Save New Credentials

**Goal:** Extension offers to save when you log in somewhere new.

- 7.1 Detect form submission (submit event on login forms)
- 7.2 Check if current domain already in vault
- 7.3 Show "Save to VaultX?" banner (content script UI)
- 7.4 User clicks Save → encrypt → POST /api/vault/items
- ✅ Verify: New credential appears in vault after saving

### Phase 8: Polish + Publish

**Goal:** Real icons, deployed backend, published to stores.

- 8.1 Design real icons (Figma or AI-generated PNG)
- 8.2 Handle edge cases (locked vault, offline, expired token)
- 8.3 Token refresh (POST /api/auth/refresh when 401 received)
- 8.4 Deploy API to Railway + Neon PostgreSQL
- 8.5 Update API_BASE to production URL
- 8.6 Build for Edge → publish to Edge Add-ons (free)
- 8.7 Build for Firefox → publish to Firefox AMO (free)
- 8.8 Build for Chrome → publish to Chrome Web Store ($5 one-time)
- ✅ Verify: Extension works on deployed production API

---

## How to Publish — Free Stores

### Microsoft Edge Add-ons (Free)

1. Go to: https://partner.microsoft.com/dashboard/microsoftedge/overview
2. Sign in with any Microsoft account (Outlook, Hotmail, etc.)
3. Click "Submit a new extension"
4. Run `npm run build` → zip the `dist/` folder
5. Upload the zip, fill in name/description, add screenshots
6. Submit — review takes 1-3 business days
7. Once approved — anyone with Edge can install it free

### Firefox Add-ons / AMO (Completely Free)

1. Go to: https://addons.mozilla.org/developers/
2. Create a Firefox account (free)
3. Click "Submit a New Add-on"
4. Upload zip of dist-firefox/ (Firefox build, has polyfill)
5. Review is mostly automated — often same day for MV3
6. Once approved — any Firefox user can install free

### Chrome Web Store ($5 one-time, do last)

1. Go to: https://chrome.google.com/webstore/devconsole
2. Pay $5 one-time developer registration
3. Upload zip of dist-chrome/
4. Submit — 1-3 day review
5. Once approved — any Chrome user can install free
6. Updates are always free after this

---

## Keeping It Live for Resume

```
What stays alive:             Where hosted:          Cost:
─────────────────────────────────────────────────────────
Extension UI (popup, CS)   →  Inside user's browser   Free (once published)
VaultX API                 →  Railway free tier        Free
PostgreSQL database        →  Neon free tier           Free
Redis (rate limiting)      →  Redis Cloud free tier    Free
Web App (bonus)            →  Vercel free tier         Free
```

Steps to make it fully live:

1. Deploy API to Railway (already planned in web app phase)
2. In `src/lib/api.ts` change:
   `const API_BASE = 'http://localhost:5000'`
   to:
   `const API_BASE = 'https://your-app.railway.app'`
3. Run `npm run build`
4. Publish to Edge + Firefox stores
5. Add to resume: "Available on Microsoft Edge Add-ons and Firefox AMO"

---

## Key Concepts — Notes for Learning

> **Note 1: Service worker can die anytime**
> Never store masterKey in `let masterKey = ...` inside the service worker.
> Chrome kills SW after idle. Next message → SW restarts → variable is gone.
> Solution: Always use `chrome.storage.session.set/get`.

> **Note 2: Three sandboxes = three separate JS environments**
> You cannot do `import { masterKey } from '../service-worker'`.
> They don't share memory. All data transfer is via `chrome.runtime.sendMessage`.
> This is why messages.ts exists — to type those messages.

> **Note 3: Content script runs INSIDE the webpage**
> `window` in content script = the website's window.
> It can read `document.querySelector('input[type="password"]')`.
> But it shares the page's DOM, so be careful not to break the website.

> **Note 4: React/Vue forms need special fill handling**
> Setting `input.value = 'password'` isn't enough for React apps.
> React tracks state internally. You must dispatch synthetic events
> after setting the value, otherwise the form won't register the change.

> **Note 5: PBKDF2 takes 1-2 seconds intentionally**
> 600,000 iterations makes brute-forcing expensive.
> The spinner during login is expected — it's a security feature, not a bug.

> **Note 6: chrome._ vs browser._**
> Edge + Chrome: use `chrome.*` natively
> Firefox: uses `browser.*` but the polyfill maps `chrome.*` to `browser.*`
> So we write `chrome.*` everywhere — the polyfill handles Firefox.

> **Note 7: MV3 Content Security Policy**
> Extensions cannot load external scripts or use eval().
> All JS must be bundled locally (Vite handles this).
> Don't try `<script src="https://cdn.something.com">` — it will be blocked.

---

## Development Commands

```powershell
# From: apps/extension/

npm install          # Install dependencies (run once)
npm run dev          # Build + watch (rebuilds on save, Chrome auto-reloads)
npm run build        # Production build
npm run typecheck    # TypeScript check without building

# After saving files → go to edge://extensions → click refresh on VaultX card
# Service worker console: edge://extensions → VaultX → "Service Worker" link
```

---

## What Changes from Web App to Extension (JS/TS differences)

| Web App                          | Extension                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------- |
| `window.crypto`                  | `globalThis.crypto` (works in SW, popup, content script)                        |
| `localStorage`                   | `chrome.storage.session` (for in-memory) or `chrome.storage.local` (persistent) |
| `fetch('/api/...')`              | `fetch('http://localhost:5000/api/...')` (full URL, no proxy)                   |
| React Router                     | No router needed — popup is one page, uses state to switch views                |
| `useContext` for global state    | Messages to service worker (no shared state across sandboxes)                   |
| Import CSS files                 | Inline styles or CSS Modules (CSP restricts some approaches)                    |
| `console.log` → browser DevTools | Each sandbox has its OWN DevTools console                                       |

---

_Last updated: Phase 0 (Planning complete, ready to build)_

import 'webextension-polyfill';

// ── Types ──────────────────────────────────────────────────────────────────
interface LoginForm {
  emailInput: HTMLInputElement | null;
  passwordInput: HTMLInputElement;
  submitButton: HTMLElement | null;
}

// ── Find login forms on the page ───────────────────────────────────────────
function findLoginForms(): LoginForm[] {
  const passwordInputs = Array.from(
    document.querySelectorAll<HTMLInputElement>('input[type="password"]')
  ).filter((el) => isVisible(el));

  return passwordInputs.map((passwordInput) => {
    // Look for email/username input near the password field
    const form = passwordInput.closest('form');
    const container =
      form ?? passwordInput.parentElement?.parentElement ?? document.body;

    const emailInput =
      container.querySelector<HTMLInputElement>('input[type="email"]') ??
      container.querySelector<HTMLInputElement>(
        'input[type="text"][name*="user"]'
      ) ??
      container.querySelector<HTMLInputElement>(
        'input[type="text"][name*="email"]'
      ) ??
      container.querySelector<HTMLInputElement>(
        'input[type="text"][autocomplete*="email"]'
      ) ??
      container.querySelector<HTMLInputElement>(
        'input[type="text"][autocomplete*="username"]'
      ) ??
      null;

    const submitButton =
      form?.querySelector<HTMLElement>('button[type="submit"]') ??
      form?.querySelector<HTMLElement>('input[type="submit"]') ??
      null;

    return { emailInput, passwordInput, submitButton };
  });
}

function isVisible(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  const style = window.getComputedStyle(el);
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0'
  );
}

// ── Fill a single input (works with React/Vue/Angular) ─────────────────────
function fillInput(input: HTMLInputElement, value: string): void {
  // Focus first
  input.focus();

  // React uses a custom property descriptor — we need to trick it
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value'
  )?.set;

  if (nativeInputValueSetter) {
    nativeInputValueSetter.call(input, value);
  } else {
    input.value = value;
  }

  // Dispatch events so React/Vue/Angular pick up the change
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.blur();
}

// ── Domain extraction ──────────────────────────────────────────────────────
function getCurrentDomain(): string {
  return window.location.hostname;
}

// ── Autofill button injection ──────────────────────────────────────────────
const BUTTON_ID = 'vaultx-autofill-btn';
const DROPDOWN_ID = 'vaultx-autofill-dropdown';

function removeExistingUI() {
  document.getElementById(BUTTON_ID)?.remove();
  document.getElementById(DROPDOWN_ID)?.remove();
}

function injectAutofillButton(form: LoginForm) {
  removeExistingUI();

  const { passwordInput, emailInput } = form;

  // Create the VaultX button
  const button = document.createElement('button');
  button.id = BUTTON_ID;
  button.type = 'button';
  button.title = 'Autofill with VaultX';
  button.innerHTML = '🔐';
  button.style.cssText = `
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    width: 28px;
    height: 28px;
    border: none;
    background: #10b981;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2147483647;
    box-shadow: 0 2px 8px rgba(16,185,129,0.4);
    line-height: 1;
    padding: 0;
  `;

  // Position relative to password input
  const wrapper = document.createElement('div');
  wrapper.style.cssText = `
    position: absolute;
    z-index: 2147483647;
  `;

  const rect = passwordInput.getBoundingClientRect();
  const scrollTop = window.scrollY || document.documentElement.scrollTop;
  const scrollLeft = window.scrollX || document.documentElement.scrollLeft;

  wrapper.style.top = `${rect.top + scrollTop}px`;
  wrapper.style.left = `${rect.left + scrollLeft}px`;
  wrapper.style.width = `${rect.width}px`;
  wrapper.style.height = `${rect.height}px`;

  wrapper.appendChild(button);
  document.body.appendChild(wrapper);

  button.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await showCredentialDropdown(form, button);
  });
}

// ── Credential dropdown ────────────────────────────────────────────────────
async function showCredentialDropdown(form: LoginForm, anchor: HTMLElement) {
  // Remove existing dropdown
  document.getElementById(DROPDOWN_ID)?.remove();

  // Ask service worker for matching items
  const domain = getCurrentDomain();
  const response = (await chrome.runtime.sendMessage({
    type: 'GET_ITEMS_FOR_DOMAIN',
    payload: { domain },
  })) as {
    items: Array<{
      id: string;
      payload: {
        title: string;
        username?: string;
        email?: string;
        password?: string;
      };
    }>;
  };

  const items = response?.items ?? [];

  // Create dropdown
  const dropdown = document.createElement('div');
  dropdown.id = DROPDOWN_ID;

  const anchorRect = anchor.getBoundingClientRect();
  const scrollTop = window.scrollY || document.documentElement.scrollTop;
  const scrollLeft = window.scrollX || document.documentElement.scrollLeft;

  dropdown.style.cssText = `
    position: absolute;
    top: ${anchorRect.bottom + scrollTop + 4}px;
    left: ${anchorRect.left + scrollLeft - 180}px;
    width: 220px;
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 10px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    z-index: 2147483647;
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  `;

  if (items.length === 0) {
    dropdown.innerHTML = `
      <div style="padding:12px 14px;text-align:center;">
        <div style="font-size:20px;margin-bottom:6px;">🔐</div>
        <p style="color:#64748b;font-size:12px;margin:0;">No saved credentials for this site</p>
        <p style="color:#475569;font-size:11px;margin:6px 0 0;">Add them in the VaultX extension</p>
      </div>
    `;
  } else {
    const header = document.createElement('div');
    header.style.cssText =
      'padding:8px 12px;border-bottom:1px solid #334155;display:flex;align-items:center;gap:6px;';
    header.innerHTML =
      '<span style="font-size:14px;">🔐</span><span style="font-size:11px;font-weight:600;color:#94a3b8;">VaultX — Select credential</span>';
    dropdown.appendChild(header);

    items.forEach((item) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.style.cssText = `
        width: 100%;
        padding: 10px 12px;
        border: none;
        background: transparent;
        text-align: left;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 10px;
        border-bottom: 1px solid #1e293b;
      `;

      const usernameDisplay =
        item.payload.username || item.payload.email || '—';
      row.innerHTML = `
        <div style="width:28px;height:28px;border-radius:6px;background:#0f172a;display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;">🔑</div>
        <div style="overflow:hidden;">
          <p style="font-size:12px;font-weight:600;color:#f1f5f9;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(item.payload.title)}</p>
          <p style="font-size:11px;color:#64748b;margin:2px 0 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(usernameDisplay)}</p>
        </div>
      `;

      row.addEventListener('mouseenter', () => {
        row.style.background = '#0f172a';
      });
      row.addEventListener('mouseleave', () => {
        row.style.background = 'transparent';
      });

      row.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Fill credentials
        if (form.emailInput && (item.payload.username || item.payload.email)) {
          fillInput(
            form.emailInput,
            item.payload.username ?? item.payload.email ?? ''
          );
        }
        if (item.payload.password) {
          fillInput(form.passwordInput, item.payload.password);
        }

        dropdown.remove();

        // Show success feedback on button
        const vaultBtn = document.getElementById(BUTTON_ID);
        if (vaultBtn) {
          vaultBtn.innerHTML = '✓';
          vaultBtn.style.background = '#059669';
          setTimeout(() => {
            vaultBtn.innerHTML = '🔐';
            vaultBtn.style.background = '#10b981';
          }, 2000);
        }
      });

      dropdown.appendChild(row);
    });
  }

  document.body.appendChild(dropdown);

  // Close dropdown on outside click
  function handleOutsideClick(e: MouseEvent) {
    if (!dropdown.contains(e.target as Node) && e.target !== anchor) {
      dropdown.remove();
      document.removeEventListener('click', handleOutsideClick);
    }
  }
  setTimeout(() => document.addEventListener('click', handleOutsideClick), 100);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Main: scan page and inject UI ─────────────────────────────────────────
function scanAndInject() {
  const forms = findLoginForms();
  if (forms.length > 0) {
    console.log(
      `[VaultX] Found ${forms.length} login form(s) on ${getCurrentDomain()}`
    );
    injectAutofillButton(forms[0]); // inject on first detected form
  }
}

// Run on page load
scanAndInject();

// MutationObserver for SPAs (React/Vue apps that render forms dynamically)
// Debounce to avoid running on every tiny DOM change
let scanTimer: ReturnType<typeof setTimeout> | null = null;
const observer = new MutationObserver(() => {
  if (scanTimer) clearTimeout(scanTimer);
  scanTimer = setTimeout(() => {
    scanAndInject();
    scanTimer = null;
  }, 500);
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});

// Clean up button when navigating away (SPA navigation)
window.addEventListener('beforeunload', () => {
  removeExistingUI();
  observer.disconnect();
});

console.log('[VaultX] Content script loaded on', getCurrentDomain());

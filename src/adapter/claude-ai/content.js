// Content script for claude.ai (runs at document_start).
// It only injects prebuilt CSS: the popup does all theme generation, so this
// script stays small and the cached stylesheet lands before first paint.
// Every step is guarded: a failure here must never break the page.

import { KEYS, PREVIEW_PORT } from '../../shared/storage.js';
import { HEALTH_CHECKS } from './selectors.js';

const STYLE_ID = 'claude-theme-style';
const LOG = '[ClaudeTheme]';

let storedCss = '';
let previewing = false;

function styleElement() {
  let el = document.getElementById(STYLE_ID);
  if (!el) {
    el = document.createElement('style');
    el.id = STYLE_ID;
    // <head> may not exist yet at document_start; <html> always does.
    (document.head || document.documentElement).appendChild(el);
  }
  return el;
}

function applyCss(css) {
  try {
    if (!css) {
      document.getElementById(STYLE_ID)?.remove();
      return;
    }
    const el = styleElement();
    if (el.textContent !== css) el.textContent = css;
  } catch (err) {
    console.warn(LOG, 'could not apply theme:', err);
  }
}

// 1. Apply the cached theme as early as possible.
chrome.storage.local
  .get(KEYS.activeCss)
  .then((data) => {
    storedCss = data[KEYS.activeCss] || '';
    if (!previewing) applyCss(storedCss);
  })
  .catch((err) => console.warn(LOG, 'could not read stored theme:', err));

// 2. Follow changes made from the popup (or from another tab).
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !(KEYS.activeCss in changes)) return;
  storedCss = changes[KEYS.activeCss].newValue || '';
  if (!previewing) applyCss(storedCss);
});

// 3. Live preview: the popup keeps a port open while it shows a preview.
// When the popup closes the port disconnects and the saved theme returns.
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== PREVIEW_PORT) return;
  port.onMessage.addListener((msg) => {
    if (msg?.type === 'preview' && typeof msg.css === 'string') {
      previewing = true;
      applyCss(msg.css);
    } else if (msg?.type === 'stop-preview') {
      previewing = false;
      applyCss(storedCss);
    } else if (msg?.type === 'ping') {
      port.postMessage({ type: 'pong', mode: document.documentElement.getAttribute('data-mode') });
    }
  });
  port.onDisconnect.addListener(() => {
    previewing = false;
    applyCss(storedCss);
  });
});

// Keep our <style> last in <head> once the page has built it, so equal
// specificity ties go to the theme. Re-adds it if the app removed it.
function ensurePlacement() {
  const el = document.getElementById(STYLE_ID);
  if (el && document.head && el.parentNode !== document.head) document.head.appendChild(el);
  if (!el && storedCss && !previewing) applyCss(storedCss);
}

// 4. Health check: warn (never throw) when claude.ai changed something the
// theme relies on, so users and contributors know selectors.js needs work.
function healthCheck() {
  try {
    const root = document.documentElement;
    const missing = [];
    if (!root.classList.contains(HEALTH_CHECKS.rootClass)) {
      missing.push(`root class ".${HEALTH_CHECKS.rootClass}"`);
    }
    const styles = getComputedStyle(root);
    for (const name of HEALTH_CHECKS.variables) {
      // Our own overrides would mask a missing variable, so only check the
      // page's values when no theme is applied.
      if (!document.getElementById(STYLE_ID) && !styles.getPropertyValue(name).trim()) {
        missing.push(`CSS variable ${name}`);
      }
    }
    for (const check of HEALTH_CHECKS.elements) {
      if (check.paths && !check.paths.test(location.pathname)) continue;
      if (!document.querySelector(check.selector)) missing.push(`${check.name} (${check.selector})`);
    }
    if (missing.length) {
      console.warn(
        LOG,
        'claude.ai may have changed. Not found:',
        missing.join(', '),
        '— the rest of the theme still applies. See CONTRIBUTING.md, "Updating selectors".'
      );
    }
  } catch (err) {
    console.warn(LOG, 'health check failed:', err);
  }
}

function onReady() {
  ensurePlacement();
  // claude.ai renders client-side; give it time before checking elements.
  setTimeout(healthCheck, 4000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', onReady, { once: true });
} else {
  onReady();
}

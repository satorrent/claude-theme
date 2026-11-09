// Popup: pick one of the preset themes (or Claude's original look), preview
// it live on the claude.ai tab and apply it. The content script only ever
// receives finished CSS.

import { buildCss } from '../adapter/claude-ai/css-builder.js';
import { PREVIEW_PORT, clearActive, getActive, setActive } from '../shared/storage.js';

const t = (key, subs) => chrome.i18n.getMessage(key, subs) || '';
const $ = (sel, root = document) => root.querySelector(sel);

const ORIGINAL = 'original';
const CLAUDE_URL = /^https:\/\/claude\.ai\//;

const state = {
  themes: [], // full theme objects, in index order
  index: [], // entries from themes/index.json
  activeId: ORIGINAL, // what is saved
  selectedId: ORIGINAL, // what is shown
  pageMode: 'dark',
  port: null,
};

// ---------- i18n ----------
function localize() {
  document.documentElement.lang = chrome.i18n.getUILanguage();
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll('[data-i18n-label]')) el.setAttribute('aria-label', t(el.dataset.i18nLabel));
}

/** Localized theme name; falls back to the name in the theme file. */
function themeName(entry) {
  return t(`theme_${entry.id.replace(/-/g, '_')}`) || entry.name;
}

// ---------- Themes ----------
async function loadThemes() {
  const index = await fetch('../themes/index.json').then((r) => r.json());
  const themes = await Promise.all(index.map((e) => fetch(`../themes/${e.file}`).then((r) => r.json())));
  state.index = index;
  state.themes = themes;
}

const themeById = (id) => state.themes.find((th) => th.id === id) || null;

function renderCards() {
  const list = $('.themes');
  list.replaceChildren();
  const template = $('#theme-card');

  const addCard = (id, name, meta, tokens) => {
    const card = template.content.firstElementChild.cloneNode(true);
    card.dataset.id = id;
    $('.card-name', card).textContent = name;
    $('.card-meta', card).textContent = meta;
    if (tokens) {
      const mini = $('.mini', card);
      for (const [k, v] of Object.entries(tokens)) mini.style.setProperty(`--m-${k}`, v);
    } else {
      card.classList.add('original');
    }
    card.addEventListener('click', () => select(id));
    card.addEventListener('keydown', onCardKey);
    list.appendChild(card);
  };

  for (const entry of state.index) {
    const theme = themeById(entry.id);
    const c = entry.contrast[state.pageMode] || entry.contrast.dark;
    const meta = t('contrastMeta', [String(c.text), c.level]);
    addCard(entry.id, themeName(entry), meta, theme.tokens[state.pageMode]);
  }
  addCard(ORIGINAL, t('originalName'), t('originalMeta'), null);
  updateCards();
}

function updateCards() {
  for (const card of document.querySelectorAll('.card')) {
    const selected = card.dataset.id === state.selectedId;
    card.setAttribute('aria-checked', String(selected));
    card.tabIndex = selected ? 0 : -1;
    const meta = $('.card-meta', card);
    meta.querySelector('.active')?.remove();
    if (card.dataset.id === state.activeId) {
      const tag = document.createElement('span');
      tag.className = 'active';
      tag.textContent = ` · ${t('activeTag')}`;
      meta.appendChild(tag);
    }
  }
  $('#apply').disabled = state.selectedId === state.activeId;
}

// Arrow keys move between cards, as in a native radio group.
function onCardKey(event) {
  const cards = [...document.querySelectorAll('.card')];
  const i = cards.indexOf(event.currentTarget);
  const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key];
  if (!step) return;
  event.preventDefault();
  const next = cards[(i + step + cards.length) % cards.length];
  next.focus();
  select(next.dataset.id);
}

function cssFor(id) {
  const theme = themeById(id);
  return theme ? buildCss(theme.tokens, { name: theme.name }) : '';
}

function select(id) {
  state.selectedId = id;
  updateCards();
  if (!state.port) return;
  try {
    if (id === state.activeId) {
      state.port.postMessage({ type: 'stop-preview' });
      setStatus('');
    } else {
      // An empty stylesheet previews Claude's original look.
      state.port.postMessage({ type: 'preview', css: cssFor(id) });
      setStatus(t('statusPreviewing'));
    }
  } catch {
    state.port = null;
  }
}

async function apply() {
  const id = state.selectedId;
  if (id === ORIGINAL) {
    await clearActive();
    setStatus(t('statusReset'));
  } else {
    const theme = themeById(id);
    await setActive(theme, cssFor(id));
    setStatus(t('statusApplied'));
  }
  state.activeId = id;
  updateCards();
}

// ---------- Tab connection ----------
async function connectToTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || !CLAUDE_URL.test(tab.url)) {
    setStatus(t('statusNoTab'), true);
    return;
  }
  const port = chrome.tabs.connect(tab.id, { name: PREVIEW_PORT });
  port.onDisconnect.addListener(() => {
    // Fires immediately when the tab has no working content script: tabs
    // opened before the extension was installed or reloaded keep a stale
    // one until they are reloaded. Also fires if the tab navigates away.
    void chrome.runtime.lastError;
    if (state.port === port) state.port = null;
    setStatus(t('statusReloadTab'), true);
    showReloadButton(tab.id);
  });
  port.onMessage.addListener((msg) => {
    if (msg?.type !== 'pong') return;
    state.port = port;
    $('#reload-tab').hidden = true;
    const dark = msg.mode === 'dark' || (msg.mode !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
    if (state.pageMode !== (dark ? 'dark' : 'light')) {
      state.pageMode = dark ? 'dark' : 'light';
      renderCards();
    }
    if (state.selectedId !== state.activeId) select(state.selectedId);
  });
  port.postMessage({ type: 'ping' });
}

/** Offers to reload the claude.ai tab, then reconnects the live preview. */
function showReloadButton(tabId) {
  const btn = $('#reload-tab');
  btn.hidden = false;
  btn.onclick = () => {
    btn.disabled = true;
    const onUpdated = (id, info) => {
      if (id !== tabId || info.status !== 'complete') return;
      chrome.tabs.onUpdated.removeListener(onUpdated);
      btn.disabled = false;
      setStatus('');
      connectToTab().catch((err) => setStatus(String(err.message || err), true));
    };
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.reload(tabId);
  };
}

function setStatus(text, warn = false) {
  const el = $('#status');
  el.textContent = text;
  el.classList.toggle('warn', warn);
}

// ---------- Init ----------
async function init() {
  localize();
  state.pageMode = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  await loadThemes();
  const { theme } = await getActive();
  state.activeId = theme && themeById(theme.id) ? theme.id : ORIGINAL;
  state.selectedId = state.activeId;
  renderCards();
  $('#apply').addEventListener('click', () => apply().catch((err) => setStatus(String(err.message || err), true)));
  await connectToTab();
}

init().catch((err) => setStatus(String(err.message || err), true));

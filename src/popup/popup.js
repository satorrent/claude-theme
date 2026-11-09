// Popup: pick base and accent colors, preview live on claude.ai, apply or
// reset. Theme generation runs here with the engine; the content script
// only receives finished CSS.

import { formatRatio, hexToOklch, isHex, normalizeHex, oklchToHex } from '../engine/index.js';
import { DEFAULT_TINT, createTheme, generateTokens } from '../engine/index.js';
import { buildCss } from '../adapter/claude-ai/css-builder.js';
import { PREVIEW_PORT, clearActive, getActive, setActive } from '../shared/storage.js';

const t = (key, subs) => chrome.i18n.getMessage(key, subs) || key;
const $ = (sel, root = document) => root.querySelector(sel);

// Warm terracotta starting point, colored enough to be visible at once.
const DEFAULT_INPUTS = { base: '#a0603c', accent: '#c2410c', tint: DEFAULT_TINT };
const CLAUDE_URL = /^https:\/\/claude\.ai\//;

const state = {
  colors: {}, // name -> {L, C, h}
  tint: DEFAULT_TINT, // 0..1, how colored the backgrounds are
  tokens: null,
  corrections: [],
  previewMode: 'light',
  port: null,
  dirty: false,
};

// ---------- i18n ----------
function localize() {
  document.documentElement.lang = chrome.i18n.getUILanguage();
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
}

// ---------- Color editors ----------
const SLIDERS = [
  { key: 'L', label: 'lightnessLabel', min: 0, max: 1, step: 0.005, fmt: (v) => `${Math.round(v * 100)}%` },
  { key: 'C', label: 'chromaLabel', min: 0, max: 0.37, step: 0.001, fmt: (v) => v.toFixed(3) },
  { key: 'h', label: 'hueLabel', min: 0, max: 360, step: 1, fmt: (v) => `${Math.round(v)}°` },
];

function buildEditor(name) {
  const editor = $(`.editor[data-color="${name}"]`);
  const box = $('.sliders', editor);
  for (const s of SLIDERS) {
    const row = document.createElement('label');
    row.className = 'slider-row';
    const id = `${name}-${s.key}`;
    row.innerHTML = `<span></span><input type="range" id="${id}" min="${s.min}" max="${s.max}" step="${s.step}"><output for="${id}"></output>`;
    $('span', row).textContent = t(s.label);
    const input = $('input', row);
    input.setAttribute('aria-label', `${t(name === 'base' ? 'baseLabel' : 'accentLabel')} – ${t(s.label)}`);
    input.addEventListener('input', () => {
      state.colors[name] = { ...state.colors[name], [s.key]: Number(input.value) };
      renderEditor(name, { skipHex: false });
      onColorsChanged();
    });
    box.appendChild(row);
  }

  if (name === 'base') buildTintSlider(box);

  const hex = $('.hex', editor);
  hex.addEventListener('input', () => {
    const value = hex.value.trim();
    const valid = isHex(value) && value.replace('#', '').length === 6;
    hex.setAttribute('aria-invalid', String(!valid));
    if (!valid) return;
    state.colors[name] = hexToOklch(normalizeHex(value));
    renderEditor(name, { skipHex: true });
    onColorsChanged();
  });
  hex.addEventListener('blur', () => renderEditor(name, { skipHex: false }));
}

/** Tint intensity slider, shown under the base color. */
function buildTintSlider(box) {
  const row = document.createElement('label');
  row.className = 'slider-row tint-row';
  row.innerHTML = '<span></span><input type="range" id="tint" min="0" max="1" step="0.05"><output for="tint"></output>';
  $('span', row).textContent = t('tintLabel');
  const input = $('input', row);
  input.setAttribute('aria-label', t('tintLabel'));
  input.addEventListener('input', () => {
    state.tint = Number(input.value);
    renderTint();
    onColorsChanged();
  });
  box.appendChild(row);
}

function renderTint() {
  const input = $('#tint');
  input.value = String(state.tint);
  const base = state.colors.base;
  const capped = { ...base, L: 0.6, C: Math.min(base.C, 0.12) };
  input.style.setProperty('--track', `linear-gradient(to right, ${oklchToHex({ ...capped, C: 0 })}, ${oklchToHex(capped)})`);
  $('output[for="tint"]').textContent = `${Math.round(state.tint * 100)}%`;
}

const hexOf = (name) => oklchToHex(state.colors[name]);

/** Gradient for a slider track: the color as that one channel varies. */
function trackGradient(lch, key, min, max) {
  const stops = [];
  for (let i = 0; i <= 12; i++) {
    const v = min + ((max - min) * i) / 12;
    stops.push(oklchToHex({ ...lch, [key]: v }));
  }
  return `linear-gradient(to right, ${stops.join(', ')})`;
}

function renderEditor(name, { skipHex }) {
  const editor = $(`.editor[data-color="${name}"]`);
  const lch = state.colors[name];
  const hex = hexOf(name);
  $('.swatch', editor).style.background = hex;
  if (!skipHex) {
    $('.hex', editor).value = hex;
    $('.hex', editor).setAttribute('aria-invalid', 'false');
  }
  for (const s of SLIDERS) {
    const input = $(`#${name}-${s.key}`);
    input.value = String(lch[s.key]);
    input.style.setProperty('--track', trackGradient(lch, s.key, s.min, s.max));
    $(`output[for="${name}-${s.key}"]`).textContent = s.fmt(lch[s.key]);
  }
  if (name === 'base') renderTint();
}

// ---------- Theme generation + preview ----------
function currentInputs() {
  return { base: hexOf('base'), accent: hexOf('accent'), tint: state.tint };
}

function regenerate() {
  const { light, dark, corrections } = generateTokens(currentInputs());
  state.tokens = { light, dark };
  state.corrections = corrections;
  renderMock();
  renderCorrections();
}

function renderMock() {
  const mock = $('.mock');
  const tokens = state.tokens[state.previewMode];
  for (const [name, value] of Object.entries(tokens)) mock.style.setProperty(`--t-${name}`, value);
  for (const btn of document.querySelectorAll('.segmented button')) {
    btn.setAttribute('aria-checked', String(btn.dataset.mode === state.previewMode));
  }
}

const TOKEN_LABELS = {
  text: 'tokenText',
  textSecondary: 'tokenTextSecondary',
  textMuted: 'tokenTextMuted',
  accent: 'tokenAccent',
  accentHover: 'tokenAccentHover',
  accentText: 'tokenAccentText',
  borderStrong: 'tokenBorderStrong',
  danger: 'tokenDanger',
  success: 'tokenSuccess',
  warning: 'tokenWarning',
};

function renderCorrections() {
  const list = $('.fixes');
  list.replaceChildren();
  // A token can be fixed in several passes; show first "from" and last "to".
  const merged = new Map();
  for (const c of state.corrections) {
    const key = `${c.mode}:${c.token}`;
    const prev = merged.get(key);
    merged.set(key, prev ? { ...c, from: prev.from, ratioBefore: prev.ratioBefore } : c);
  }
  $('.contrast .count').textContent = merged.size ? `(${merged.size})` : '';
  if (merged.size === 0) {
    const li = document.createElement('li');
    li.className = 'ok';
    li.textContent = t('contrastNone');
    list.appendChild(li);
    return;
  }
  for (const c of merged.values()) {
    const li = document.createElement('li');
    const text = t('contrastFix', [
      t(c.mode === 'light' ? 'modeLight' : 'modeDark'),
      t(TOKEN_LABELS[c.token] || c.token),
      c.from,
      c.to,
      String(formatRatio(c.ratioBefore)),
      String(formatRatio(c.ratioAfter)),
      String(c.min),
    ]);
    const span = document.createElement('span');
    span.textContent = c.resolved ? text : `${text} · ${t('contrastUnresolved')}`;
    li.appendChild(span);
    list.appendChild(li);
  }
}

let previewFrame = 0;
function sendPreview() {
  if (!state.port) return;
  cancelAnimationFrame(previewFrame);
  previewFrame = requestAnimationFrame(() => {
    try {
      state.port.postMessage({ type: 'preview', css: buildCss(state.tokens, { name: 'preview' }) });
      setStatus(t('statusPreviewing'));
    } catch {
      state.port = null;
    }
  });
}

function onColorsChanged() {
  state.dirty = true;
  regenerate();
  sendPreview();
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
    // Fires immediately when the tab has no content script yet
    // (tab opened before the extension was installed or reloaded).
    void chrome.runtime.lastError;
    if (state.port === port) state.port = null;
    setStatus(t('statusReloadTab'), true);
  });
  port.onMessage.addListener((msg) => {
    if (msg?.type !== 'pong') return;
    state.port = port;
    // Default the popup preview to the mode the page is using.
    const pageDark =
      msg.mode === 'dark' || (msg.mode !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
    state.previewMode = pageDark ? 'dark' : 'light';
    renderMock();
    if (state.dirty) sendPreview();
  });
  port.postMessage({ type: 'ping' });
}

// ---------- Status + actions ----------
function setStatus(text, warn = false) {
  const el = $('#status');
  el.textContent = text;
  el.classList.toggle('warn', warn);
}

async function apply() {
  const name = t('customThemeName');
  const { theme } = createTheme({ name, source: 'manual', inputs: currentInputs() });
  await setActive(theme, buildCss(theme.tokens, { name }));
  state.dirty = false;
  setStatus(t('statusApplied'));
}

async function reset() {
  await clearActive();
  state.dirty = false;
  try {
    state.port?.postMessage({ type: 'stop-preview' });
  } catch {
    state.port = null;
  }
  setStatus(t('statusReset'));
}

// ---------- Init ----------
async function init() {
  localize();
  buildEditor('base');
  buildEditor('accent');

  const { theme } = await getActive();
  const inputs = theme?.inputs || DEFAULT_INPUTS;
  state.colors.base = hexToOklch(inputs.base);
  state.colors.accent = hexToOklch(inputs.accent);
  state.tint = inputs.tint ?? DEFAULT_TINT;
  state.previewMode = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  renderEditor('base', { skipHex: false });
  renderEditor('accent', { skipHex: false });
  regenerate();

  for (const btn of document.querySelectorAll('.segmented button')) {
    btn.addEventListener('click', () => {
      state.previewMode = btn.dataset.mode;
      renderMock();
    });
  }
  $('#apply').addEventListener('click', () => apply().catch((err) => setStatus(String(err.message || err), true)));
  $('#reset').addEventListener('click', () => reset().catch((err) => setStatus(String(err.message || err), true)));

  await connectToTab();
  if (theme && !$('#status').textContent) setStatus(t('statusActive', [theme.name]));
}

init().catch((err) => setStatus(String(err.message || err), true));

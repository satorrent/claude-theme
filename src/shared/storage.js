// Storage layout shared by the popup and the content script.
// Everything lives in chrome.storage.local, which Chrome deletes when the
// extension is uninstalled. Nothing is written to claude.ai's own storage.

export const KEYS = Object.freeze({
  /** The active theme object (inputs + tokens), or absent for Claude's original look. */
  activeTheme: 'activeTheme',
  /** Prebuilt CSS for the active theme, read first at document_start to avoid a flash. */
  activeCss: 'activeCss',
});

/** Port name used for live preview between popup and content script. */
export const PREVIEW_PORT = 'contrast-themes-preview';

export async function getActive() {
  const data = await chrome.storage.local.get([KEYS.activeTheme, KEYS.activeCss]);
  return { theme: data[KEYS.activeTheme] || null, css: data[KEYS.activeCss] || '' };
}

export async function setActive(theme, css) {
  await chrome.storage.local.set({ [KEYS.activeTheme]: theme, [KEYS.activeCss]: css });
}

export async function clearActive() {
  await chrome.storage.local.remove([KEYS.activeTheme, KEYS.activeCss]);
}

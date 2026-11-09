# ClaudeTheme

**English** · [Español](README.es.md)

Custom color themes for the [claude.ai](https://claude.ai) website, beyond light and dark. Pick a base and an accent color and ClaudeTheme generates a complete light **and** dark theme, checks every text and control against WCAG AA contrast, and fixes what does not pass.

> **Unofficial project.** ClaudeTheme is not made, endorsed or supported by Anthropic. "Claude" is a trademark of Anthropic; it is used here only to describe the website this extension works on.

> **Status: 0.1.0, early development.** This version covers manual colors with live preview. Preset palettes, image-based themes, saved themes and import/export are coming next.

## Build and load (developer mode)

You need [Node.js](https://nodejs.org) 20.10 or newer and Google Chrome 120 or newer.

1. Get the code and build it:

   ```bash
   git clone <this repository's URL>
   cd claude-theme
   npm install
   npm run build
   ```

   This creates the `dist/` folder: that is the extension. (`dist/` is generated, so it is not in the repository.)

2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select the `dist/` folder.
5. Open or reload a claude.ai tab, then click the ClaudeTheme icon in the toolbar (pin it from the puzzle-piece menu).

After changing the code, run `npm run build` again and click the reload icon on the extension's card in `chrome://extensions`. `npm run watch` rebuilds automatically on every change.

### Why a build step?

Manifest V3 content scripts cannot be ES modules, while the theme engine is written as plain ES modules so it can be reused anywhere. [esbuild](https://esbuild.github.io) bundles them into single files. It is the only dependency and is used at build time only: nothing third-party ships inside the extension.

## Usage

- **Base color** tints backgrounds and text. **Accent color** drives buttons, links and focus rings.
- While the popup is open, the claude.ai tab shows a live preview. Close the popup to discard it, or click **Apply theme** to keep it.
- The theme follows the light/dark/system mode you chose in Claude's settings.
- **Restore Claude's original** removes the theme.
- **Contrast fixes** lists every color that was adjusted to reach WCAG AA (4.5:1 for text, 3:1 for controls), with the before and after values.

## Development

```bash
npm test        # engine and adapter tests (node:test, no extra dependencies)
npm run build   # build dist/
npm run watch   # rebuild on change
```

Project layout:

```
src/engine/            Theme engine: pure ES modules, no browser APIs
src/adapter/claude-ai/ Everything specific to claude.ai (selectors.js is the only place with its selectors)
src/popup/             Popup UI
src/shared/            Storage keys shared by popup and content script
themes/                Preset themes (one JSON file each) and theme.schema.json
tests/                 Tests
scripts/build.mjs      Build script
```

## Limitations

- Works only on the claude.ai **website** in Chrome (and Chromium-based browsers). It cannot theme the Claude desktop or mobile apps.
- It relies on claude.ai's internal CSS variables. When claude.ai changes them, parts of the theme may stop applying until `src/adapter/claude-ai/selectors.js` is updated. The extension never breaks the page: it logs a `[ClaudeTheme]` warning in the console and keeps applying what still works.
- Artifacts, images and code syntax colors keep their own colors.

## Uninstall

Remove it from `chrome://extensions`. Chrome deletes all of its stored data; ClaudeTheme writes nothing to claude.ai's own storage, so nothing is left behind.

## License

[MIT](LICENSE)

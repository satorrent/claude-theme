# ClaudeTheme

**English** · [Español](README.es.md)

Five bold color themes for the [claude.ai](https://claude.ai) website, with visible borders and readable text. Every theme is checked against WCAG contrast rules at build time, so none of them trades legibility for looks.

> **Unofficial project.** ClaudeTheme is not made, endorsed or supported by Anthropic. "Claude" is a trademark of Anthropic; it is used here only to describe the website this extension works on.

> **Status: 0.1.0, early development.**

## Themes

| Theme | Background | Borders | Text contrast |
| --- | --- | --- | --- |
| Navy & orange | `#0b1f3a` | `#ff8a1f` | 10.63:1 (AAA) |
| Black & orange | `#0a0a0a` | `#ff7a00` | 15.52:1 (AAA) |
| Cream & navy | `#fbf6ea` | `#14284f` | 14.56:1 (AAA) |
| Cream & green | `#fbf6ea` | `#1b9e00` | 13.83:1 (AAA) |
| Cream & pink | `#fbf6ea` | `#ff1493` | 15.03:1 (AAA) |

Text contrast is body text on the page background ([WCAG](https://www.w3.org/TR/WCAG22/#contrast-minimum): AA is 4.5:1, AAA is 7:1). Borders and controls reach at least 3:1. That is why the green is a vivid green rather than a neon one: a true neon green on cream contrasts only about 1.3:1 and the borders would almost disappear.

Each theme looks the same whether Claude is in light or dark mode: the color is the theme.

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

- Click a theme in the popup to preview it on the open claude.ai tab. Close the popup to discard the preview, or click **Apply** to keep it.
- Choose **Claude's original** and click **Apply** to remove the theme.
- If the popup says the tab needs a reload (tabs opened before the extension was installed or updated), use the **Reload tab** button.

## Adding a theme

Add one JSON file to `themes/`, named after its `id` (for example `themes/forest-gold.json`), following `themes/theme.schema.json`. Copy an existing theme as a starting point. `npm run build` validates it and refuses to build if any text, accent or border pair falls below WCAG AA; `npm test` runs the same checks. Then add a translated name as `theme_<id with underscores>` in `_locales/*/messages.json`.

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

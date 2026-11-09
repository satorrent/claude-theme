# Contributing

Thanks for helping. This is a small, unofficial project, so changes should stay small and focused.

## Setup

```bash
npm install
npm run check   # tests + build
```

Load `dist/` in `chrome://extensions` (Developer mode → Load unpacked). After each change, run `npm run build` (or keep `npm run watch` running), reload the extension, then reload the claude.ai tab.

## Proposing a theme

1. Copy an existing file in `themes/` and name it after its new `id` (kebab case, e.g. `themes/forest-gold.json`).
2. Set `name`, `description`, `inputs` (`base` is the background, `accent` the border color) and all 18 tokens for both `light` and `dark`. Presets use the same palette in both modes.
3. Add the translated name as `theme_<id with underscores>` in `_locales/en/messages.json` and `_locales/es/messages.json`.
4. Add the theme to the list in `tests/engine/audit.test.js` and to the table in both READMEs.
5. Run `npm run check`. The build refuses any theme where text falls below 4.5:1 or borders and controls fall below 3:1 against the surfaces they sit on. The error says which pair failed. [WebAIM's contrast checker](https://webaim.org/resources/contrastchecker/) helps when picking colors.
6. In the pull request, include a screenshot of claude.ai with the theme applied.

The popup orders themes from lightest to darkest automatically.

## When claude.ai changes

claude.ai is not designed to be themed, and its internal CSS can change at any time. Everything that depends on it lives in **`src/adapter/claude-ai/selectors.js`**:

- `ROOT_VARIABLES` and `SCOPED_VARIABLES` map our tokens to claude.ai's CSS variables. Prefer these: variables survive redesigns better than selectors.
- `ELEMENT_RULES` style specific elements that have no variable (for example the border on your message bubble).
- `HEALTH_CHECKS` lists what the content script expects to find. When something is missing, it logs a `[Contrast Themes]` warning in the page's console.

To find a new variable, open claude.ai, inspect the element in DevTools and look for the `var(--…)` it uses. Never add selectors anywhere else, and never let a missing element throw: log and carry on.

## Code

- Three layers: `src/engine/` is pure (no browser APIs) and tested; `src/adapter/claude-ai/` knows about claude.ai; `src/popup/` is the UI.
- No runtime dependencies. esbuild is the only dev dependency.
- Comments in English. Add or update tests in `tests/` for engine changes.
- Small commits with clear messages.

## Releasing (maintainers)

1. Update `CHANGELOG.md` and bump `version` in both `package.json` and `manifest.json` (the build checks that they match).
2. `npm run package` runs the tests, builds and writes `contrast-themes-<version>.zip`.
3. Upload the zip in the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) (Package → Upload new package) and submit for review.
4. Tag the release: `git tag v<version>` and push the tag.

First publication also needs: a developer account (one-time 5 USD fee), the store description, at least one 1280×800 screenshot, a 440×280 promo tile, the category, a justification for each permission, and a link to [PRIVACY.md](PRIVACY.md).

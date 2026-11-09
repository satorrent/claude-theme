// Every claude.ai-specific name lives in this file: CSS variables, scope
// selectors and the elements used by the health check. When claude.ai
// changes its markup, this is the only file that should need updating.
// See CONTRIBUTING.md ("Updating selectors").
//
// Strategy: override claude.ai's own design tokens first (one rule themes
// the whole UI); fall back to element selectors only where a color is not
// driven by a variable.

/** Element that carries `data-mode` ("light" | "dark" | "system"). */
export const MODE_ROOT = 'html';
export const MODE_ATTRIBUTE = 'data-mode';

/**
 * Elements where claude.ai (re)declares its tokens. Overrides must target
 * all of them, otherwise a nested declaration would win again.
 */
export const TOKEN_HOSTS = ['', ' .cds-root'];

/**
 * claude.ai CSS variable -> theme token.
 * `format: 'hsl'` means the variable holds bare HSL components ("15 63% 60%")
 * instead of a color, as the legacy tokens do.
 */
export const ROOT_VARIABLES = [
  // Current design system ("cds").
  { name: '--cds-page-bg', token: 'bg' },
  { name: '--cds-surface-0', token: 'surfaceLow' },
  { name: '--cds-surface-1', token: 'bg' },
  { name: '--cds-surface-2', token: 'surface' },
  { name: '--cds-surface-3', token: 'surfaceRaised' },
  { name: '--cds-surface-popover', token: 'popover' },
  { name: '--cds-neutral-0', token: 'bg' },
  { name: '--cds-neutral-30', token: 'surface' },
  { name: '--cds-neutral-400', token: 'textMuted' },
  { name: '--cds-neutral-600', token: 'textSecondary' },
  { name: '--cds-neutral-750', token: 'textSecondary' },
  { name: '--cds-neutral-900', token: 'text' }, // also tints --cds-alpha-1..4
  { name: '--cds-text-primary', token: 'text' },
  { name: '--cds-text-secondary', token: 'textSecondary' },
  { name: '--cds-text-muted', token: 'textMuted' },
  { name: '--cds-text-accent', token: 'accentText' },
  { name: '--cds-text-danger', token: 'danger' },
  { name: '--cds-fill-primary', token: 'text' },
  { name: '--cds-fill-primary-hover', token: 'textSecondary' },
  { name: '--cds-on-primary', token: 'bg' },
  { name: '--cds-fill-accent', token: 'accent' },
  { name: '--cds-role-accent-fill', token: 'accent' },
  { name: '--cds-role-accent-450', token: 'accent' },
  { name: '--cds-bg-accent', token: 'accentSoft' },
  { name: '--cds-border', token: 'border' },

  // Unprefixed aliases still used by some components.
  { name: '--page-bg', token: 'bg' },
  { name: '--surface-0', token: 'surfaceLow' },
  { name: '--surface-3', token: 'surfaceRaised' },
  { name: '--neutral-0', token: 'bg' },
  { name: '--neutral-400', token: 'textMuted' },
  { name: '--neutral-600', token: 'textSecondary' },
  { name: '--neutral-750', token: 'textSecondary' },
  { name: '--neutral-900', token: 'text' },
  { name: '--text-primary', token: 'text' },
  { name: '--text-secondary', token: 'textSecondary' },
  { name: '--text-muted', token: 'textMuted' },
  { name: '--text-accent', token: 'accentText' },
  { name: '--text-danger', token: 'danger' },
  { name: '--fill-primary', token: 'text' },
  { name: '--fill-primary-hover', token: 'textSecondary' },
  { name: '--on-primary', token: 'bg' },
  { name: '--fill-accent', token: 'accent' },
  { name: '--role-accent-fill', token: 'accent' },
  { name: '--bg-accent', token: 'accentSoft' },
  { name: '--border', token: 'border' },

  // Brand color ("clay") used by a few highlighted controls.
  { name: '--clay', token: 'accent' },
  { name: '--clay-emphasized', token: 'accentHover' },
  { name: '--fill-brand', token: 'accent' },
  { name: '--fill-brand-hover', token: 'accentHover' },
  { name: '--on-brand', token: 'onAccent' },

  // Legacy tokens in bare HSL components, used as hsl(var(--bg-100)).
  { name: '--bg-000', token: 'surfaceRaised', format: 'hsl' },
  { name: '--bg-100', token: 'bg', format: 'hsl' },
  { name: '--bg-200', token: 'surfaceLow', format: 'hsl' },
  { name: '--bg-300', token: 'surfaceLow', format: 'hsl' },
  { name: '--bg-400', token: 'surfaceLow', format: 'hsl' },
  { name: '--bg-500', token: 'surfaceLow', format: 'hsl' },
  { name: '--text-000', token: 'text', format: 'hsl' },
  { name: '--text-100', token: 'text', format: 'hsl' },
  { name: '--text-200', token: 'textSecondary', format: 'hsl' },
  { name: '--text-300', token: 'textSecondary', format: 'hsl' },
  { name: '--text-400', token: 'textMuted', format: 'hsl' },
  { name: '--text-500', token: 'textMuted', format: 'hsl' },
  { name: '--border-100', token: 'border', format: 'hsl' },
  { name: '--border-200', token: 'border', format: 'hsl' },
  { name: '--border-300', token: 'border', format: 'hsl' },
  { name: '--border-400', token: 'borderStrong', format: 'hsl' },
  { name: '--accent-brand', token: 'accent', format: 'hsl' },
  { name: '--accent-main-000', token: 'accentHover', format: 'hsl' },
  { name: '--accent-main-100', token: 'accent', format: 'hsl' },
  { name: '--accent-main-200', token: 'accent', format: 'hsl' },
  { name: '--accent-secondary-000', token: 'accentText', format: 'hsl' },
  { name: '--accent-secondary-100', token: 'accentText', format: 'hsl' },
  { name: '--oncolor-100', token: 'onAccent', format: 'hsl' },
  { name: '--danger-000', token: 'danger', format: 'hsl' },
  { name: '--danger-100', token: 'danger', format: 'hsl' },
  { name: '--danger-200', token: 'danger', format: 'hsl' },
];

/**
 * Areas with their own variables that do not inherit from the root tokens.
 * `selector` is matched as a descendant of the mode root.
 */
export const SCOPED_VARIABLES = [
  {
    area: 'sidebar',
    selector: '.dframe-sidebar',
    variables: [
      { name: '--df-web-sidebar-bg', token: 'surfaceLow' },
      { name: '--df-sidebar-tint', token: 'surfaceLow' },
      { name: '--df-sidebar-bg', token: 'surfaceLow' },
      { name: '--df-surface-primary', token: 'surfaceLow', format: 'hsl' },
    ],
  },
];

/**
 * Health check. After load the content script verifies these still exist
 * and logs a console warning for any that is missing; nothing breaks.
 * `paths` limits an element check to pages where it should appear.
 */
export const HEALTH_CHECKS = {
  rootClass: 'cds-root',
  variables: ['--cds-surface-1', '--cds-text-primary', '--cds-border', '--cds-fill-accent'],
  elements: [
    { name: 'sidebar', selector: '[data-testid="sidebar"], .dframe-sidebar' },
    { name: 'chat input', selector: '[data-testid="chat-input"]', paths: /^\/(new|chat|project)/ },
    { name: 'user message', selector: '[data-testid="user-message"]', paths: /^\/chat\// },
    { name: 'assistant message', selector: '[data-testid="assistant-message"]', paths: /^\/chat\// },
  ],
};

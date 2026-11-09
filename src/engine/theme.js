// Theme objects: create, complete and validate. Pure, no browser APIs.

import { auditTokens } from './audit.js';
import { normalizeHex } from './color.js';
import { SCHEMA_VERSION, validateTheme } from './schema.js';
import { generateTokens } from './tokens.js';

/** Turns a display name into a kebab-case id (falls back to 'theme'). */
export function slugify(name) {
  const slug = String(name)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  return slug.length >= 2 ? slug : 'theme';
}

/**
 * Builds a complete, valid theme (inputs + generated tokens).
 * @param {{id?: string, name: string, source: 'preset'|'manual'|'image',
 *          inputs: {base: string, accent: string, tint?: number, palette?: string[]},
 *          author?: string, description?: string}} spec
 * @returns {{theme: object, corrections: Array}}
 */
export function createTheme(spec) {
  const inputs = {
    base: normalizeHex(spec.inputs.base),
    accent: normalizeHex(spec.inputs.accent),
  };
  if (spec.inputs.tint != null) inputs.tint = Math.round(Math.min(1, Math.max(0, spec.inputs.tint)) * 100) / 100;
  if (spec.inputs.palette) inputs.palette = spec.inputs.palette.map(normalizeHex);

  const { light, dark, corrections } = generateTokens(inputs);
  const theme = {
    schemaVersion: SCHEMA_VERSION,
    id: spec.id || slugify(spec.name),
    name: spec.name,
    ...(spec.author ? { author: spec.author } : {}),
    ...(spec.description ? { description: spec.description } : {}),
    source: spec.source,
    inputs,
    tokens: { light, dark },
  };
  return { theme, corrections };
}

/**
 * Validates a theme, fills in tokens when they are missing and audits the
 * contrast of hand-written tokens. Throws an Error listing every problem.
 * @returns {{theme: object, corrections: Array, audit: {light: object, dark: object}}}
 */
export function completeTheme(raw) {
  const check = validateTheme(raw);
  if (!check.valid) {
    const list = check.errors.map((e) => `${e.path} ${e.message}`).join('; ');
    throw new Error(`Invalid theme: ${list}`);
  }
  const { $schema, ...rest } = raw;
  let theme = rest;
  let corrections = [];
  if (!rest.tokens) {
    const generated = generateTokens(rest.inputs);
    corrections = generated.corrections;
    theme = { ...rest, tokens: { light: generated.light, dark: generated.dark } };
  }
  const audit = { light: auditTokens(theme.tokens.light), dark: auditTokens(theme.tokens.dark) };
  const failures = ['light', 'dark'].flatMap((mode) =>
    audit[mode].results
      .filter((r) => !r.pass)
      .map((r) => `${mode} ${r.fg} on ${r.bg} is ${r.ratio.toFixed(2)}:1 (needs ${r.min}:1)`)
  );
  if (failures.length) throw new Error(`Contrast too low: ${failures.join('; ')}`);
  return { theme, corrections, audit };
}

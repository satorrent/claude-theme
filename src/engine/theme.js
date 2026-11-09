// Theme objects: create, complete and validate. Pure, no browser APIs.

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
 *          inputs: {base: string, accent: string, palette?: string[]},
 *          author?: string, description?: string}} spec
 * @returns {{theme: object, corrections: Array}}
 */
export function createTheme(spec) {
  const inputs = {
    base: normalizeHex(spec.inputs.base),
    accent: normalizeHex(spec.inputs.accent),
  };
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
 * Validates a theme and fills in tokens when they are missing.
 * Throws an Error listing every schema violation.
 * @returns {{theme: object, corrections: Array}}
 */
export function completeTheme(raw) {
  const check = validateTheme(raw);
  if (!check.valid) {
    const list = check.errors.map((e) => `${e.path} ${e.message}`).join('; ');
    throw new Error(`Invalid theme: ${list}`);
  }
  if (raw.tokens) return { theme: raw, corrections: [] };
  const { $schema, ...rest } = raw;
  const { light, dark, corrections } = generateTokens(rest.inputs);
  return { theme: { ...rest, tokens: { light, dark } }, corrections };
}

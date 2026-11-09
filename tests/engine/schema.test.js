import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { completeTheme, createTheme, slugify } from '../../src/engine/theme.js';
import { SCHEMA_VERSION, validateAgainst, validateTheme } from '../../src/engine/schema.js';

const minimal = () => ({
  schemaVersion: 1,
  id: 'my-theme',
  name: 'My theme',
  source: 'manual',
  inputs: { base: '#c2410c', accent: '#2a78d6' },
});

test('a minimal theme is valid', () => {
  assert.deepEqual(validateTheme(minimal()), { valid: true, errors: [] });
});

test('reports every error with its path', () => {
  const bad = { ...minimal(), id: 'Not Kebab', schemaVersion: 2, extra: true };
  bad.inputs = { base: 'red' };
  const { valid, errors } = validateTheme(bad);
  assert.equal(valid, false);
  const paths = errors.map((e) => e.path).sort();
  assert.deepEqual(paths, ['/extra', '/id', '/inputs/accent', '/inputs/base', '/schemaVersion']);
});

test('rejects incomplete token sets', () => {
  const { theme } = createTheme({ name: 'X theme', source: 'manual', inputs: minimal().inputs });
  delete theme.tokens.dark.accent;
  const { valid, errors } = validateTheme(theme);
  assert.equal(valid, false);
  assert.equal(errors[0].path, '/tokens/dark/accent');
});

test('createTheme produces a valid theme with inputs and tokens', () => {
  const { theme } = createTheme({ name: 'Café con leche', source: 'manual', inputs: { base: '#C2410C', accent: '#2a78d6' } });
  assert.equal(theme.schemaVersion, SCHEMA_VERSION);
  assert.equal(theme.id, 'cafe-con-leche');
  assert.equal(theme.inputs.base, '#c2410c');
  assert.ok(theme.tokens.light && theme.tokens.dark);
  assert.equal(validateTheme(theme).valid, true);
});

test('completeTheme fills tokens and throws on invalid input', () => {
  const { theme } = completeTheme({ $schema: './theme.schema.json', ...minimal() });
  assert.ok(theme.tokens.light.bg);
  assert.equal('$schema' in theme, false);
  assert.throws(() => completeTheme({ ...minimal(), source: 'nope' }), /source must be one of/);
});

test('slugify', () => {
  assert.equal(slugify('  Terracota Cálida! '), 'terracota-calida');
  assert.equal(slugify('?'), 'theme');
});

test('unsupported schema keywords fail loudly instead of being ignored', () => {
  assert.throws(() => validateAgainst({ oneOf: [] }, 1), /Unsupported schema keyword/);
});

test('every theme file in /themes is valid and named after its id', () => {
  const dir = new URL('../../themes/', import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'theme.schema.json' && f !== 'index.json');
  for (const file of files) {
    const theme = JSON.parse(readFileSync(new URL(file, dir), 'utf8'));
    const { valid, errors } = validateTheme(theme);
    assert.ok(valid, `${file}: ${JSON.stringify(errors)}`);
    assert.equal(`${theme.id}.json`, file);
  }
});

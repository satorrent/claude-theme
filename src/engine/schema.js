// Theme validation driven by themes/theme.schema.json.
// The rules live only in the JSON Schema; this file is a small interpreter
// for the subset of JSON Schema that file uses (no external dependency).
// Pure functions, no browser or DOM dependencies.

import themeSchema from '../../themes/theme.schema.json' with { type: 'json' };

export { themeSchema };
export const SCHEMA_VERSION = themeSchema.properties.schemaVersion.const;

const SUPPORTED = new Set([
  '$schema', '$id', '$ref', '$defs', 'title', 'description',
  'type', 'const', 'enum', 'required', 'properties', 'additionalProperties',
  'pattern', 'minLength', 'maxLength', 'items', 'minItems', 'maxItems',
  'minimum', 'maximum',
]);

const typeOf = (v) => {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (Number.isInteger(v)) return 'integer';
  return typeof v;
};

const typeMatches = (expected, actual) =>
  expected === actual || (expected === 'number' && actual === 'integer');

function resolveRef(root, ref) {
  if (!ref.startsWith('#/')) throw new Error(`Unsupported $ref: ${ref}`);
  return ref
    .slice(2)
    .split('/')
    .reduce((node, key) => {
      if (!node || !(key in node)) throw new Error(`Unresolvable $ref: ${ref}`);
      return node[key];
    }, root);
}

/**
 * Validates `value` against a JSON Schema (subset) and collects all errors.
 * @returns {{valid: boolean, errors: Array<{path: string, message: string}>}}
 */
export function validateAgainst(schema, value, root = schema) {
  const errors = [];
  walk(schema, value, '', root, errors);
  return { valid: errors.length === 0, errors };
}

function walk(schema, value, path, root, errors) {
  for (const key of Object.keys(schema)) {
    if (!SUPPORTED.has(key)) throw new Error(`Unsupported schema keyword "${key}" at ${path || '/'}`);
  }
  const at = path || '/';
  const err = (message) => errors.push({ path: at, message });

  if (schema.$ref) return walk(resolveRef(root, schema.$ref), value, path, root, errors);

  if ('const' in schema && value !== schema.const) {
    return err(`must be ${JSON.stringify(schema.const)}`);
  }
  if (schema.enum && !schema.enum.includes(value)) {
    return err(`must be one of ${schema.enum.map((v) => JSON.stringify(v)).join(', ')}`);
  }
  if (schema.type && !typeMatches(schema.type, typeOf(value))) {
    return err(`must be of type ${schema.type}`);
  }

  if (typeof value === 'string') {
    if (schema.minLength != null && value.length < schema.minLength) err(`must have at least ${schema.minLength} characters`);
    if (schema.maxLength != null && value.length > schema.maxLength) err(`must have at most ${schema.maxLength} characters`);
    if (schema.pattern && !new RegExp(schema.pattern, 'u').test(value)) err(`must match pattern ${schema.pattern}`);
  }

  if (typeof value === 'number') {
    if (schema.minimum != null && value < schema.minimum) err(`must be >= ${schema.minimum}`);
    if (schema.maximum != null && value > schema.maximum) err(`must be <= ${schema.maximum}`);
  }

  if (Array.isArray(value)) {
    if (schema.minItems != null && value.length < schema.minItems) err(`must have at least ${schema.minItems} items`);
    if (schema.maxItems != null && value.length > schema.maxItems) err(`must have at most ${schema.maxItems} items`);
    if (schema.items) value.forEach((item, i) => walk(schema.items, item, `${path}/${i}`, root, errors));
  }

  if (typeOf(value) === 'object') {
    for (const key of schema.required || []) {
      if (!(key in value)) errors.push({ path: `${path}/${key}`, message: 'is required' });
    }
    const props = schema.properties || {};
    for (const [key, child] of Object.entries(value)) {
      if (key in props) walk(props[key], child, `${path}/${key}`, root, errors);
      else if (schema.additionalProperties === false) {
        errors.push({ path: `${path}/${key}`, message: 'is not allowed' });
      }
    }
  }
}

/** Validates a theme object against theme.schema.json. */
export function validateTheme(theme) {
  return validateAgainst(themeSchema, theme);
}

/** Tokens listed in the schema's tokenSet, in schema order. */
export function schemaTokenNames() {
  return [...themeSchema.$defs.tokenSet.required];
}

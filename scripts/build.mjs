// Builds the unpacked extension into dist/.
//   npm run build        one-off build
//   npm run watch        rebuild on every change
//
// Steps: bundle the scripts with esbuild (MV3 content scripts cannot be ES
// modules), copy static files, and validate every theme in /themes, writing
// complete copies plus an auto-generated themes/index.json to dist/.

import * as esbuild from 'esbuild';
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { watch } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { completeTheme } from '../src/engine/theme.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const WATCH = process.argv.includes('--watch');
const NON_THEME_FILES = new Set(['theme.schema.json', 'index.json']);

const esbuildOptions = {
  absWorkingDir: ROOT,
  entryPoints: {
    content: 'src/adapter/claude-ai/content.js',
    'popup/popup': 'src/popup/popup.js',
  },
  outdir: DIST,
  bundle: true,
  format: 'iife',
  target: 'chrome120',
  charset: 'utf8',
  legalComments: 'none',
  sourcemap: WATCH ? 'inline' : false,
  logLevel: 'warning',
};

async function copyStatic() {
  const pkg = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'));
  const manifest = JSON.parse(await readFile(join(ROOT, 'manifest.json'), 'utf8'));
  if (manifest.version !== pkg.version) {
    throw new Error(`Version mismatch: manifest.json ${manifest.version} vs package.json ${pkg.version}`);
  }
  await writeFile(join(DIST, 'manifest.json'), JSON.stringify(manifest, null, 2));
  await cp(join(ROOT, '_locales'), join(DIST, '_locales'), { recursive: true });
  await mkdir(join(DIST, 'popup'), { recursive: true });
  for (const file of ['popup.html', 'popup.css']) {
    await cp(join(ROOT, 'src/popup', file), join(DIST, 'popup', file));
  }
  await cp(join(ROOT, 'icons'), join(DIST, 'icons'), { recursive: true }).catch((err) => {
    if (err.code !== 'ENOENT') throw err;
  });
}

async function buildThemes() {
  const srcDir = join(ROOT, 'themes');
  const outDir = join(DIST, 'themes');
  await mkdir(outDir, { recursive: true });
  const files = (await readdir(srcDir)).filter((f) => f.endsWith('.json') && !NON_THEME_FILES.has(f)).sort();

  const index = [];
  const problems = [];
  for (const file of files) {
    try {
      const raw = JSON.parse(await readFile(join(srcDir, file), 'utf8'));
      if (`${raw.id}.json` !== file) throw new Error(`id "${raw.id}" must match the file name`);
      const { theme, corrections } = completeTheme(raw);
      await writeFile(join(outDir, file), JSON.stringify(theme));
      index.push({
        id: theme.id,
        name: theme.name,
        ...(theme.author ? { author: theme.author } : {}),
        ...(theme.description ? { description: theme.description } : {}),
        file,
        swatch: [theme.tokens.light.bg, theme.tokens.light.accent, theme.tokens.dark.bg, theme.tokens.dark.accent],
      });
      if (corrections.length) {
        console.log(`  ${file}: ${corrections.length} contrast correction(s) applied automatically`);
      }
    } catch (err) {
      problems.push(`themes/${file}: ${err.message}`);
    }
  }
  if (problems.length) throw new Error(`Invalid theme files:\n  ${problems.join('\n  ')}`);
  await writeFile(join(outDir, 'index.json'), JSON.stringify(index, null, 2));
  return index.length;
}

async function buildAll() {
  const started = Date.now();
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });
  await esbuild.build(esbuildOptions);
  await copyStatic();
  const themes = await buildThemes();
  console.log(`Built dist/ in ${Date.now() - started} ms (${themes} preset theme(s)).`);
}

if (!WATCH) {
  buildAll().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
} else {
  let timer = null;
  const rebuild = () => {
    clearTimeout(timer);
    timer = setTimeout(() => buildAll().catch((err) => console.error(err.message || err)), 100);
  };
  await rebuild();
  for (const target of ['src', 'themes', '_locales', 'icons', 'manifest.json']) {
    try {
      watch(join(ROOT, target), { recursive: true }, rebuild);
    } catch {
      // Optional folders (e.g. icons) may not exist yet.
    }
  }
  console.log('Watching for changes. After each build, reload the extension in chrome://extensions.');
}

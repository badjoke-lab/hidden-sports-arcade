import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const requiredRoutes = [
  '/',
  '/sports/',
  '/sports/boccia/',
  '/sports/tchoukball/',
  '/sports/boccia/rules/',
  '/sports/tchoukball/rules/',
];

const distDir = 'dist';
const distIndexPath = join(distDir, 'index.html');
const redirectsPath = join('public', '_redirects');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readText(path) {
  return readFileSync(path, 'utf8');
}

assert(existsSync(redirectsPath), 'public/_redirects is missing.');
assert(readText(redirectsPath).includes('/* /index.html 200'), 'public/_redirects must keep the Cloudflare Pages SPA fallback.');
assert(existsSync(distIndexPath), 'dist/index.html is missing. Run npm run build before this route smoke check.');

const distIndex = readText(distIndexPath);
assert(distIndex.includes('id="app"'), 'Built index.html must include the #app mount root.');
assert(/<script[^>]+type="module"[^>]+src="\.?\/assets\//.test(distIndex), 'Built index.html must include the bundled module script.');

const assetDir = join(distDir, 'assets');
assert(existsSync(assetDir), 'dist/assets is missing.');

const builtText = [distIndex]
  .concat(
    readdirSync(assetDir)
      .filter((fileName) => fileName.endsWith('.js') || fileName.endsWith('.css'))
      .map((fileName) => readText(join(assetDir, fileName))),
  )
  .join('\n');

for (const route of requiredRoutes) {
  assert(builtText.includes(route), `Built app is missing route string: ${route}`);
}

for (const label of ['Boccia', 'Tchoukball', 'Game failed to start.', 'Back to sports']) {
  assert(builtText.includes(label), `Built app is missing visible shell/fallback text: ${label}`);
}

console.log(`Route render smoke passed for ${requiredRoutes.length} routes and the visible game fallback.`);

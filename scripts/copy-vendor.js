// Copies the pinned browser builds of the libraries and fonts I use from node_modules
// into vendor/, so the site loads everything from its own origin and needs no CDN.
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const vendorDir = join(root, 'vendor');

// [source in node_modules, target in vendor/]. Each minified file points at its
// source map, so the maps come along. Fonts ship with their license (SIL OFL), which
// has to travel with the font files.
const files = [
  ['jquery/dist/jquery.min.js'],
  ['jquery/dist/jquery.min.map'],
  ['bootstrap/dist/js/bootstrap.bundle.min.js'],
  ['bootstrap/dist/js/bootstrap.bundle.min.js.map'],
  ['chart.js/dist/chart.umd.min.js'],
  ['chart.js/dist/chart.umd.min.js.map'],
  ['@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff2', 'fonts'],
  ['@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-italic.woff2', 'fonts'],
  ['@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff2', 'fonts'],
  ['@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2', 'fonts'],
  ['@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-600-normal.woff2', 'fonts'],
  ['@fontsource/ibm-plex-sans/LICENSE', 'fonts', 'IBM-Plex-Sans-OFL.txt'],
  ['@fontsource/ibm-plex-mono/LICENSE', 'fonts', 'IBM-Plex-Mono-OFL.txt'],
];

rmSync(vendorDir, { recursive: true, force: true });

for (const [source, folder = '', name = basename(source)] of files) {
  mkdirSync(join(vendorDir, folder), { recursive: true });
  cpSync(join(root, 'node_modules', source), join(vendorDir, folder, name));
  console.log(`vendor/${folder ? `${folder}/` : ''}${name}`);
}

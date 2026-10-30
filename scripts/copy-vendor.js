// Copies the pinned browser builds of the libraries I use from node_modules into vendor/,
// so the site loads everything from its own origin and needs no CDN.
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const vendorDir = join(root, 'vendor');

// Each minified file points at its source map, so copy the maps too.
const files = [
  'jquery/dist/jquery.min.js',
  'jquery/dist/jquery.min.map',
  'bootstrap/dist/js/bootstrap.bundle.min.js',
  'bootstrap/dist/js/bootstrap.bundle.min.js.map',
  'chart.js/dist/chart.umd.min.js',
  'chart.js/dist/chart.umd.min.js.map',
];

rmSync(vendorDir, { recursive: true, force: true });
mkdirSync(vendorDir);

for (const file of files) {
  const name = file.split('/').pop();
  cpSync(join(root, 'node_modules', file), join(vendorDir, name));
  console.log(`vendor/${name}`);
}

// Draws the guilloche ribbon used in the header: the fine braided lines printed on
// banknotes and old bank books. It's a set of waves shifted along the x axis, which
// cross each other and form a rope. Run once with `node scripts/make-guilloche.js`;
// the result, images/guilloche.svg, is committed like any other image.
//
// Each wave is a chain of quadratic curves (SVG Q, then T, which mirrors the last
// control point). That looks like a sine wave and takes a few hundred bytes instead
// of a long list of sampled points.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const width = 240; // a whole number of wavelengths, so the tile repeats seamlessly
const height = 24;
const wavelength = 60;
const strands = 8;
const amplitude = height / 2 - 1.5;

const middle = height / 2;

// A quadratic curve peaks halfway to its control point, so a control point at twice
// the amplitude gives a wave of the right height.
function wave(shift) {
  const start = -shift;
  const parts = [`M${start} ${middle}`, `Q${start + wavelength / 4} ${middle - 2 * amplitude} ${start + wavelength / 2} ${middle}`];
  for (let x = start + wavelength; x <= width + wavelength; x += wavelength / 2) parts.push(`T${x} ${middle}`);
  return `<path d="${parts.join(' ')}"/>`;
}

const lines = Array.from({ length: strands }, (_, i) => wave((i * wavelength) / strands));
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`
  + `<g fill="none" stroke="#000" stroke-width="0.6">${lines.join('')}</g></svg>\n`;

const target = join(root, 'images', 'guilloche.svg');
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, svg);
console.log(`images/guilloche.svg (${svg.length} bytes)`);

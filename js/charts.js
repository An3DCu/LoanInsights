// The two charts, drawn with Chart.js.
//
// - Chart.js (210 KB) is loaded the first time a chart is needed, so pages without
//   charts never download it.
// - Colors come from the theme's CSS variables. Every color option is a small function
//   that reads the current palette (a "scriptable option" in Chart.js terms), so when
//   light/dark mode switches, the palette is re-read and the charts redraw with it.
//   Plain color values would be cached inside Chart.js and never change.
// - Every chart returns a handle with destroy(). Chart.js keeps listeners and memory
//   per chart, so the old one must be destroyed before a new one takes its canvas.
import { formatDuration, formatMoney, formatMoneyShort } from './format.js';

let loading = null;

// A plain <script src> tag, not $.getScript: jQuery runs same-origin scripts it fetches
// as inline code, which the site's Content Security Policy blocks.
function loadChartJs() {
  if (window.Chart) return Promise.resolve(window.Chart);
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'vendor/chart.umd.min.js';
    script.onload = () => resolve(window.Chart);
    script.onerror = () => {
      loading = null; // let the next attempt try again
      reject(new Error('Chart.js did not load.'));
    };
    document.head.append(script);
  });
  return loading;
}

function readPalette() {
  const style = getComputedStyle(document.documentElement);
  const read = (name) => style.getPropertyValue(name).trim();
  return {
    ink: read('--bs-body-color'),
    pencil: read('--bs-secondary-color'),
    paper: read('--bs-body-bg'),
    rule: read('--li-rule'),
    stamp: read('--li-stamp'),
  };
}

let palette = readPalette();
const color = (name) => () => palette[name];

const live = new Set();

// Light/dark switched: read the new palette and redraw every chart at once.
new MutationObserver(() => {
  palette = readPalette();
  for (const chart of live) {
    chart.options.plugins.legend.labels.color = palette.ink; // legend colors aren't scriptable
    chart.update('none');
  }
}).observe(document.documentElement, { attributes: true, attributeFilter: ['data-bs-theme'] });

async function draw(canvas, config) {
  const Chart = await loadChartJs();
  if (!canvas.isConnected) return null; // the page changed while Chart.js was loading

  // Two quick submits can both be waiting here; only one chart may own a canvas.
  const existing = Chart.getChart(canvas);
  if (existing) {
    live.delete(existing);
    existing.destroy();
  }

  palette = readPalette();
  const chart = new Chart(canvas, config);
  live.add(chart);

  return {
    // Safe to call twice: a chart that's no longer live was already destroyed.
    destroy() {
      if (!live.delete(chart)) return;
      chart.destroy();
    },
  };
}

// One chart at a time on a page. show() replaces the old chart; destroy() is what the
// router's cleanup hook calls when the page goes away.
export function chartSlot() {
  let current = null;
  let latest = 0;
  return {
    async show(drawChart) {
      const id = ++latest;
      current?.destroy();
      current = null;
      const handle = await drawChart();
      if (id !== latest) {
        handle?.destroy(); // a newer chart was asked for in the meantime
        return;
      }
      current = handle;
    },
    destroy() {
      latest++;
      current?.destroy();
      current = null;
    },
  };
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const textFont = { family: '"IBM Plex Sans", system-ui, sans-serif' };
const numberFont = { family: '"IBM Plex Mono", ui-monospace, monospace' };

function commonOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: reducedMotion() ? false : { duration: 400 },
    plugins: {
      colors: { enabled: false }, // every color comes from the theme
      legend: { labels: { font: textFont, boxWidth: 14, color: palette.ink } },
      tooltip: { titleFont: textFont, bodyFont: numberFont },
    },
  };
}

// An axis in the theme's colors.
const axis = (options) => ({
  ...options,
  ticks: { color: color('pencil'), ...options.ticks },
  grid: { color: color('rule'), ...options.grid },
});

// Calculator: principal and interest paid in each year, stacked. Early bars are mostly
// interest, later ones mostly principal.
export function drawYearBars(canvas, years) {
  const options = commonOptions();
  options.plugins.tooltip.callbacks = {
    title: (items) => `Year ${years[items[0].dataIndex].year}`,
    label: (item) => `${item.dataset.label}: ${formatMoney(item.parsed.y)}`,
  };
  options.scales = {
    x: axis({ stacked: true, grid: { display: false }, ticks: { font: textFont } }),
    y: axis({ stacked: true, ticks: { font: numberFont, callback: (value) => formatMoneyShort(value) } }),
  };

  // A thin paper-colored line on top of each part keeps the two parts of a bar apart.
  const bar = (label, data, fill) => ({
    label, data, backgroundColor: color(fill), borderColor: color('paper'), borderWidth: { top: 1 },
  });

  return draw(canvas, {
    type: 'bar',
    data: {
      labels: years.map((year) => `Y${year.year}`),
      datasets: [
        bar('Principal', years.map((year) => year.principal), 'ink'),
        bar('Interest', years.map((year) => year.interest), 'stamp'),
      ],
    },
    options,
  });
}

// The balance over time for one plan, as { x: years, y: balance } points.
function balancePoints(plan, periodsPerYear, startBalance) {
  return [{ x: 0, y: startBalance }, ...plan.schedule.map((row) => ({ x: row.number / periodsPerYear, y: row.balance }))];
}

// Pay off faster: the current plan (dashed) and the faster one (solid). Dashes, not
// just color, tell them apart.
export function drawBalanceLines(canvas, { now, plan, nowPerYear, planPerYear, balance, planHeading }) {
  const options = commonOptions();
  options.interaction = { mode: 'nearest', axis: 'x', intersect: false };
  options.elements = { point: { radius: 0, hitRadius: 6 }, line: { borderWidth: 2.5 } };
  options.plugins.tooltip.callbacks = {
    title: (items) => `After ${formatDuration(items[0].parsed.x)}`,
    label: (item) => `${item.dataset.label}: ${formatMoney(item.parsed.y)}`,
  };
  options.scales = {
    x: axis({
      type: 'linear',
      min: 0,
      title: { display: true, text: 'Years', font: textFont, color: color('pencil') },
      ticks: { font: numberFont, precision: 0 },
    }),
    y: axis({ min: 0, ticks: { font: numberFont, callback: (value) => formatMoneyShort(value) } }),
  };

  const line = (label, data, stroke, extra = {}) => ({
    label, data, borderColor: color(stroke), backgroundColor: color(stroke), ...extra,
  });

  return draw(canvas, {
    type: 'line',
    data: {
      datasets: [
        line('As you pay now', balancePoints(now, nowPerYear, balance), 'pencil', { borderDash: [6, 4] }),
        line(planHeading, balancePoints(plan, planPerYear, balance), 'stamp'),
      ],
    },
    options,
  });
}

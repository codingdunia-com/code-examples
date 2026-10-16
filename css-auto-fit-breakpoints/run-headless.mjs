// Measures what repeat(auto-fit | auto-fill, minmax(Npx, 1fr)) actually does,
// by asking Chromium for the resolved track list and each item's box instead
// of computing it on paper.
//
// Three questions, all answered from getComputedStyle / getBoundingClientRect:
//   1. At which exact container width does the column count change?
//   2. How wide is a lone item (or two, or five) under auto-fit vs auto-fill?
//   3. What happens to a 280px minimum when the container is narrower than 280px?
//
// Nothing here is timed, so the result does not depend on how busy the machine
// is. The script asserts the shape of the answer and exits 1 if it moves.
import { chromium } from 'playwright';
import os from 'node:os';

const MIN = 280;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<!doctype html><meta charset="utf-8"><body style="margin:0"><div id="host"></div>');

const env = {
  chromium: browser.version(),
  userAgent: await page.evaluate(() => navigator.userAgent),
  node: process.version,
  cpu: `${os.cpus()[0].model} (${os.cpus().length} cores)`,
  date: new Date().toISOString().slice(0, 10),
};

// Build a grid inside #host and return what the layout engine decided.
async function probe({ mode, items, width, gap, minmax = `${MIN}px` }) {
  return page.evaluate(({ mode, items, width, gap, minmax }) => {
    const host = document.getElementById('host');
    host.innerHTML = '';
    const grid = document.createElement('div');
    grid.style.cssText =
      `width:${width}px;display:grid;gap:${gap}px;` +
      `grid-template-columns:repeat(${mode}, minmax(${minmax}, 1fr));`;
    for (let i = 0; i < items; i++) {
      const c = document.createElement('div');
      c.style.cssText = 'height:20px';
      grid.appendChild(c);
    }
    host.appendChild(grid);
    const tracks = getComputedStyle(grid).gridTemplateColumns.split(' ').map(parseFloat);
    const first = grid.children[0].getBoundingClientRect();
    return {
      tracks,
      visibleTracks: tracks.filter((t) => t > 0.5).length,
      firstItemWidth: Math.round(first.width * 100) / 100,
      scrollWidth: grid.scrollWidth,
      clientWidth: grid.clientWidth,
    };
  }, { mode, items, width, gap, minmax });
}

// 1. Where does the column count change? Sweep width one pixel at a time.
async function sweep(gap) {
  const jumps = {};
  let prev = 0;
  for (let w = 200; w <= 1600; w++) {
    const r = await probe({ mode: 'auto-fit', items: 12, width: w, gap });
    if (r.visibleTracks !== prev) {
      jumps[r.visibleTracks] = w;
      prev = r.visibleTracks;
    }
  }
  return jumps;
}

const gaps = [0, 16, 24, 32];
const breakpoints = {};
for (const gap of gaps) {
  breakpoints[gap] = await sweep(gap);
}

// 1b. How far does one card jump across a breakpoint? One pixel of container
//     width, gap 24, twelve items: width of the first card just before and at
//     each column-count change.
const sawtooth = [];
for (const n of [2, 3, 4]) {
  const at = breakpoints[24][n];
  const before = await probe({ mode: 'auto-fit', items: 12, width: at - 1, gap: 24 });
  const after = await probe({ mode: 'auto-fit', items: 12, width: at, gap: 24 });
  sawtooth.push({
    columns: n,
    containerBefore: at - 1,
    cardBefore: before.firstItemWidth,
    containerAfter: at,
    cardAfter: after.firstItemWidth,
  });
}

// 2. Lone items under auto-fit vs auto-fill.
const widths = [600, 900, 1200];
const counts = [1, 2, 3, 5];
const loneItems = [];
for (const width of widths) {
  for (const items of counts) {
    const fit = await probe({ mode: 'auto-fit', items, width, gap: 24 });
    const fill = await probe({ mode: 'auto-fill', items, width, gap: 24 });
    loneItems.push({
      width,
      items,
      fitItem: fit.firstItemWidth,
      fillItem: fill.firstItemWidth,
      fitTracks: fit.tracks.length,
      fillTracks: fill.tracks.length,
      fitVisible: fit.visibleTracks,
    });
  }
}

// 3. A container narrower than the minimum.
const narrow = [];
for (const width of [320, 280, 240, 200]) {
  const raw = await probe({ mode: 'auto-fit', items: 3, width, gap: 24 });
  const guarded = await probe({ mode: 'auto-fit', items: 3, width, gap: 24, minmax: `min(${MIN}px, 100%)` });
  narrow.push({
    width,
    rawItem: raw.firstItemWidth,
    rawOverflow: raw.scrollWidth - raw.clientWidth,
    guardedItem: guarded.firstItemWidth,
    guardedOverflow: guarded.scrollWidth - guarded.clientWidth,
  });
}

// 4. The same grid in a real page, with and without a classic scrollbar.
//    Headless Chromium's own scrollbars are overlay ones (like a macOS
//    trackpad or a phone): they take no layout space. Windows, Linux and a
//    macOS mouse show a classic bar that takes 15px. Headless cannot be made
//    to draw a native one, so the classic case is stood in for by
//    ::-webkit-scrollbar { width: 15px }, which reserves exactly that space.
//    The "viewport" is an iframe, because an iframe's width is its viewport
//    as far as layout and media queries are concerned.
const PAGE_PADDING = 24;
const pageHtml = (css) => `<style>${css}</style>
<body style="margin:0"><main style="padding:0 ${PAGE_PADDING}px">
<div id="g" style="display:grid;gap:24px;grid-template-columns:repeat(auto-fit,minmax(${MIN}px,1fr))">
${'<div style="height:20px"></div>'.repeat(12)}</div>
<div style="height:3000px"></div></main>`;

const pageB = await (await chromium.launch({ ignoreDefaultArgs: ['--hide-scrollbars'] }))
  .newContext({ viewport: null }).then((c) => c.newPage());
await pageB.setContent('<body style="margin:0"><iframe id="f" style="border:0;width:400px;height:700px"></iframe>');

async function viewportJumps(css) {
  await pageB.evaluate((html) => new Promise((res) => {
    const f = document.getElementById('f');
    f.onload = res;
    f.srcdoc = html;
  }), pageHtml(css));
  return pageB.evaluate(({ from, to }) => {
    const f = document.getElementById('f');
    const doc = f.contentDocument;
    const jumps = {};
    let prev = 0;
    let bar = 0;
    for (let w = from; w <= to; w++) {
      f.style.width = `${w}px`;
      const tracks = getComputedStyle(doc.getElementById('g')).gridTemplateColumns
        .split(' ').map(parseFloat).filter((t) => t > 0.5).length;
      bar = f.contentWindow.innerWidth - doc.documentElement.clientWidth;
      if (tracks !== prev) {
        jumps[tracks] = w;
        prev = tracks;
      }
    }
    return { scrollbarWidth: bar, jumps };
  }, { from: 300, to: 1700 });
}
const overlay = await viewportJumps('');
const classic = await viewportJumps('::-webkit-scrollbar { width: 15px; }');
await pageB.context().browser().close();

await browser.close();

const report = { env, min: MIN, pagePadding: PAGE_PADDING, breakpoints, sawtooth, loneItems, narrow, overlay, classic };
console.log(JSON.stringify(report, null, 2));
console.log('');

// --- assertions ------------------------------------------------------------
const checks = [];
// Formula: n columns first fit at width n*MIN + (n-1)*gap.
for (const gap of gaps) {
  for (const n of [2, 3, 4]) {
    const expected = n * MIN + (n - 1) * gap;
    const got = breakpoints[gap][n];
    checks.push([`gap ${gap}: ${n} columns start at ${expected}px (got ${got})`, got === expected]);
  }
}
// A lone item: auto-fit stretches it to the container, auto-fill does not.
const lone = loneItems.find((r) => r.width === 1200 && r.items === 1);
checks.push(['auto-fit: one item fills a 1200px container', Math.abs(lone.fitItem - 1200) < 1]);
checks.push(['auto-fill: one item stays a column wide', lone.fillItem < 400]);
checks.push(['auto-fit leaves empty tracks at 0px, not removed', lone.fitTracks > lone.fitVisible]);
// The unguarded minimum overflows once the container drops below it.
const n240 = narrow.find((r) => r.width === 240);
checks.push(['unguarded minmax(280px, 1fr) overflows a 240px container', n240.rawOverflow > 0]);
checks.push(['min(280px, 100%) does not overflow', n240.guardedOverflow <= 0]);

// A classic scrollbar shifts every viewport breakpoint by its own width.
checks.push(['overlay scrollbar takes no layout space', overlay.scrollbarWidth === 0]);
checks.push(['classic scrollbar takes layout space', classic.scrollbarWidth > 0]);
for (const n of [2, 3, 4]) {
  checks.push([
    `${n} columns start ${classic.scrollbarWidth}px later with a classic scrollbar`,
    classic.jumps[n] - overlay.jumps[n] === classic.scrollbarWidth,
  ]);
  checks.push([
    `overlay: ${n} columns start at container breakpoint + 2 * padding`,
    overlay.jumps[n] === breakpoints[24][n] + 2 * PAGE_PADDING,
  ]);
}

for (const row of sawtooth) {
  checks.push([
    `going to ${row.columns} columns: one more pixel shrinks the card from ${row.cardBefore}px to ${row.cardAfter}px`,
    row.cardBefore > row.cardAfter + 50,
  ]);
}

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`);
  if (!ok) failed++;
}
if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed.`);
  process.exit(1);
}
console.log('\nAll assertions passed.');

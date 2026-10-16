// Two measurements about container queries, both taken in headless Chromium.
//
// A. What container-type does to a container's own width (deterministic).
//    container-type: inline-size applies inline-size containment, which means
//    the element reports NO intrinsic width. In a block or a 1fr track that is
//    invisible. In any context that sizes the box from its content (a flex item
//    with auto width, an inline-block, a float, an absolutely positioned box)
//    the container collapses to 0px wide. Measured with getBoundingClientRect.
//
// B. What a resize costs (relative). The same 4-column-to-2-column grid of N
//    cards is resized between a 1200px and a 780px viewport (an iframe, so the
//    iframe's width is the viewport for media queries and for layout), and the
//    time to apply the width and force style + layout is recorded. Variants:
//
//      none            no query at all (the layout cost of the resize itself)
//      media           @media (max-width: 1000px) switches the card layout
//      perCard         every card wrapped in its own container, @container query
//      perCardNoQuery  the same N containers, but no @container rule
//      single          ONE container (the grid), @container query on the cards
//
//    All variants are sampled interleaved (one resize pair of each in turn), so
//    a load spike hits every variant instead of whichever happened to run then.
//    Timings move with machine load; the ratios are the result.
//
// The script also checks that media, perCard and single produce the SAME layout
// at both widths. A speed comparison between two things that render differently
// would be meaningless.
import { chromium } from 'playwright';
import os from 'node:os';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 600 } });

const env = {
  chromium: browser.version(),
  node: process.version,
  cpu: `${os.cpus()[0].model} (${os.cpus().length} cores)`,
  date: new Date().toISOString().slice(0, 10),
};

// ---------------------------------------------------------------- part A ----
const CONTEXTS = {
  'block child': ['<div>', '</div>', ''],
  'grid 1fr column': ['<div style="display:grid;grid-template-columns:1fr">', '</div>', ''],
  'flex item, flex: 1': ['<div style="display:flex">', '</div>', 'flex:1;'],
  'table cell': ['<div style="display:table"><div style="display:table-row">', '</div></div>', 'display:table-cell;'],
  'grid auto column': ['<div style="display:grid;grid-template-columns:auto auto">', '<div>other</div></div>', ''],
  'flex item, auto width': ['<div style="display:flex">', '</div>', ''],
  'inline-block': ['<div>', '</div>', 'display:inline-block;'],
  'float': ['<div>', '</div>', 'float:left;'],
  'position: absolute': ['<div style="position:relative">', '</div>', 'position:absolute;'],
};
const collapse = {};
for (const [name, [pre, post, style]] of Object.entries(CONTEXTS)) {
  collapse[name] = {};
  for (const type of ['normal', 'inline-size']) {
    await page.setContent(
      `<body style="margin:0">${pre}<div id="t" style="${style}container-type:${type}">` +
      `<article><h3 style="margin:0">A card title</h3><p style="margin:0">Some text that is a sentence long.</p></article></div>${post}`);
    collapse[name][type] = await page.evaluate(() => {
      const r = document.getElementById('t').getBoundingClientRect();
      return { width: Math.round(r.width), height: Math.round(r.height) };
    });
  }
}

// ---------------------------------------------------------------- part B ----
const BASE = `
  body{margin:0;font:14px/1.4 system-ui,sans-serif}
  .grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));padding:16px}
  .card{border:1px solid #888;padding:12px}
  .card h3{margin:0 0 6px;font-size:16px} .card p{margin:0} .card .meta{display:flex;gap:6px}`;
const HORIZONTAL = `.card{display:grid;grid-template-columns:80px 1fr;gap:12px} .card h3{font-size:18px} .card .meta{flex-direction:column}`;
const VARIANTS = {
  none: [BASE, false],
  media: [`${BASE} @media (max-width:1000px){${HORIZONTAL}}`, false],
  perCard: [`${BASE} .wrap{container-type:inline-size} @container (max-width:3000px) and (min-width:320px){${HORIZONTAL}}`, true],
  perCardNoQuery: [`${BASE} .wrap{container-type:inline-size}`, true],
  single: [`${BASE} .grid{container-type:inline-size} @container (max-width:1000px){${HORIZONTAL}}`, false],
};
const KEYS = Object.keys(VARIANTS);

function documentFor([css, wrap], n) {
  const cards = Array.from({ length: n }, (_, i) => {
    const card = `<article class="card"><h3>Card ${i}</h3><p>Some text here that wraps around a bit in narrow cards.</p><div class="meta"><span>a</span><span>b</span></div></article>`;
    return wrap ? `<div class="wrap">${card}</div>` : card;
  }).join('');
  return `<style>${css}</style><div class="grid">${cards}</div>`;
}

const SIZES = [300, 1000, 3000];
const SAMPLES = 21;
const WARMUP = 2;
const median = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const round = (x) => Math.round(x * 100) / 100;

const cost = {};
const geometry = {};
for (const n of SIZES) {
  await page.setContent('<body style="margin:0">' + KEYS.map((k) =>
    `<iframe id="${k}" style="border:0;width:1200px;height:800px;position:absolute;visibility:hidden"></iframe>`).join(''));
  for (const k of KEYS) {
    await page.evaluate(([id, html]) => new Promise((resolve) => {
      const f = document.getElementById(id);
      f.onload = resolve;
      f.srcdoc = html;
    }), [k, documentFor(VARIANTS[k], n)]);
  }
  const raw = await page.evaluate(({ keys, samples, warmup }) => {
    const out = Object.fromEntries(keys.map((k) => [k, { to780: [], to1200: [] }]));
    for (const k of keys) document.getElementById(k).contentDocument.body.offsetHeight;
    for (let s = 0; s < samples + warmup; s++) {
      for (const k of keys) {
        const f = document.getElementById(k);
        const d = f.contentDocument;
        for (const [w, slot] of [[780, 'to780'], [1200, 'to1200']]) {
          const t = performance.now();
          f.style.width = `${w}px`;
          d.body.offsetHeight;
          const dt = performance.now() - t;
          if (s >= warmup) out[k][slot].push(dt);
        }
      }
    }
    return out;
  }, { keys: KEYS, samples: SAMPLES, warmup: WARMUP });

  cost[n] = {};
  for (const k of KEYS) {
    cost[n][k] = {
      to780: round(median(raw[k].to780)),
      to1200: round(median(raw[k].to1200)),
    };
    cost[n][k].pair = round(cost[n][k].to780 + cost[n][k].to1200);
  }
  for (const k of KEYS) {
    cost[n][k].vsMedia = round(cost[n][k].pair / cost[n].media.pair);
  }

  // Same layout? First and last card, title and card box, at both widths.
  geometry[n] = await page.evaluate((keys) => {
    const snap = {};
    for (const k of keys) {
      const f = document.getElementById(k);
      snap[k] = [];
      for (const w of [780, 1200]) {
        f.style.width = `${w}px`;
        const d = f.contentDocument;
        const cards = d.querySelectorAll('.card');
        for (const c of [cards[0], cards[cards.length - 1]]) {
          for (const el of [c, c.querySelector('h3')]) {
            const r = el.getBoundingClientRect();
            snap[k].push([w, Math.round(r.width * 10) / 10, Math.round(r.height * 10) / 10]);
          }
        }
      }
    }
    return snap;
  }, ['media', 'perCard', 'single', 'none']);
}
await browser.close();

console.log(JSON.stringify({ env, collapse, samples: SAMPLES, costMs: cost }, null, 2));
console.log('');

// ------------------------------------------------------------ assertions ----
const w = (ctx, type) => collapse[ctx][type].width;
const checks = [
  ['a container as a block child keeps its width', w('block child', 'inline-size') === w('block child', 'normal')],
  ['a container in a 1fr track keeps its width', w('grid 1fr column', 'inline-size') === w('grid 1fr column', 'normal')],
  ['a container with flex: 1 keeps its width', w('flex item, flex: 1', 'inline-size') === w('flex item, flex: 1', 'normal')],
  ['a container as an auto-width flex item collapses to 0px', w('flex item, auto width', 'inline-size') === 0 && w('flex item, auto width', 'normal') > 0],
  ['a container as an inline-block collapses to 0px', w('inline-block', 'inline-size') === 0],
  ['a floated container collapses to 0px', w('float', 'inline-size') === 0],
  ['an absolutely positioned container collapses to 0px', w('position: absolute', 'inline-size') === 0],
  ['a container in an auto grid column loses width', w('grid auto column', 'inline-size') < w('grid auto column', 'normal')],
];
for (const n of SIZES) {
  const same = ['perCard', 'single'].every((k) => JSON.stringify(geometry[n][k]) === JSON.stringify(geometry[n].media));
  checks.push([`${n} cards: media, per-card and single-container render the same layout`, same]);
  checks.push([`${n} cards: the resize really costs more with a layout switch than without one`, cost[n].media.pair > cost[n].none.pair]);
  checks.push([`${n} cards: per-card containers stay within 2x of media queries (${cost[n].perCard.vsMedia}x)`, cost[n].perCard.vsMedia < 2]);
  checks.push([`${n} cards: one container stays within 2x of media queries (${cost[n].single.vsMedia}x)`, cost[n].single.vsMedia < 2]);
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

// What does it cost to change one checkbox when the page has a :has() rule that
// depends on it?
//
// The question is not "is :has() slow" (the answer to that is "depends on the
// selector"), it is "how many elements does Chromium have to restyle, and how
// does the time grow with the number of siblings". So there are two readings:
//
//   elements : the elementCount Chromium reports on its UpdateLayoutTree trace
//              event, i.e. how many elements the style engine recomputed. This
//              is a count, not a timing, so it does not move with machine load.
//   ms       : median wall time of "toggle + force style and layout", inside
//              the page. This DOES move with load; read ratios, not values.
//
// Selectors under test (all give the same visual result for the element they
// target, so they are interchangeable in a design and only differ in cost):
//
//   self    .card:has(input:checked)                  descendant of the subject
//   plus    .card:has(+ .card input:checked)          "the item before the checked one"
//   tilde   .card:has(~ .card input:checked)          "every item before the checked one"
//
// and, for plus and tilde, the JavaScript a team would write instead: add a
// class to the same elements and let CSS match on that.
//
// Worst case is measured on purpose: the LAST card in the list is toggled, so
// the selector has the most preceding siblings to deal with.
import { chromium } from 'playwright';
import os from 'node:os';

const SIZES = [250, 500, 1000, 2000, 4000];
const ITERATIONS = 9;
const WARMUP = 2;

const SELECTORS = {
  self: '.card:has(input:checked){background-color:#fdd}',
  plus: '.card:has(+ .card input:checked){background-color:#fdd}',
  tilde: '.card:has(~ .card input:checked){background-color:#fdd}',
  // JS-driven equivalents: the rule matches a class that script maintains.
  selfClass: '.card.on{background-color:#fdd}',
  plusClass: '.card.on{background-color:#fdd}',
  tildeClass: '.card.on{background-color:#fdd}',
};

function pageHtml(css, n) {
  const cards = Array.from({ length: n }, (_, i) =>
    `<li class="card" id="c${i}"><label><input type="checkbox"> <span>Item ${i}</span></label></li>`).join('');
  return `<!doctype html><style>${css}</style><body><ul id="l">${cards}</ul>`;
}

// Runs inside the page. `kind` decides what "toggle" means for each variant.
function runToggles({ kind, last, iterations, warmup }) {
  const input = document.querySelector(`#c${last} input`);
  const cards = document.querySelectorAll('.card');
  const toggle = () => {
    if (kind === 'self' || kind === 'plus' || kind === 'tilde') {
      input.checked = !input.checked;
    } else if (kind === 'selfClass') {
      cards[last].classList.toggle('on');
    } else if (kind === 'plusClass') {
      cards[last - 1].classList.toggle('on');
    } else {
      for (let i = 0; i < last; i++) {
        cards[i].classList.toggle('on');
      }
    }
  };
  document.body.offsetHeight;
  // The cheap cases finish below the timer's resolution (100 microseconds), so
  // they are repeated and averaged. The expensive ones run once per sample.
  const reps = kind === 'self' || kind === 'selfClass' || kind === 'plusClass' ? 50 : 1;
  const times = [];
  for (let k = 0; k < iterations + warmup; k++) {
    const t = performance.now();
    for (let j = 0; j < reps; j++) {
      toggle();
      document.body.offsetHeight;
    }
    times.push((performance.now() - t) / reps);
  }
  times.splice(0, warmup);
  times.sort((a, b) => a - b);
  return times[Math.floor(times.length / 2)];
}

const median = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const round = (x) => Math.round(x * 100) / 100;

const browser = await chromium.launch();
const page = await browser.newPage();

const env = {
  chromium: browser.version(),
  node: process.version,
  cpu: `${os.cpus()[0].model} (${os.cpus().length} cores)`,
  date: new Date().toISOString().slice(0, 10),
};

const results = {};
for (const [kind, css] of Object.entries(SELECTORS)) {
  results[kind] = {};
  for (const n of SIZES) {
    const args = { kind, last: n - 1, iterations: ITERATIONS, warmup: WARMUP };

    // Pass 1, no tracing: wall time.
    await page.setContent(pageHtml(css, n));
    const ms = await page.evaluate(runToggles, args);

    // Pass 2, tracing: how many elements were restyled per toggle.
    await page.setContent(pageHtml(css, n));
    await browser.startTracing(page, { categories: ['devtools.timeline'] });
    await page.evaluate(runToggles, args);
    const trace = JSON.parse((await browser.stopTracing()).toString());
    const counts = trace.traceEvents
      .filter((e) => e.name === 'UpdateLayoutTree' && e.ph === 'X' && e.args?.elementCount !== undefined)
      .map((e) => e.args.elementCount);
    // The first event is the initial full style pass; drop it.
    results[kind][n] = { ms: Math.round(ms * 1000) / 1000, elements: median(counts.slice(1)) };
  }
}
// Where in the list the checkbox sits decides how much of it :has(+ ...) touches.
const positions = {};
const N_POS = 4000;
for (const [label, idx] of [['first', 0], ['middle', N_POS / 2], ['last', N_POS - 1]]) {
  await page.setContent(pageHtml(SELECTORS.plus, N_POS));
  await browser.startTracing(page, { categories: ['devtools.timeline'] });
  await page.evaluate(runToggles, { kind: 'plus', last: idx, iterations: ITERATIONS, warmup: WARMUP });
  const trace = JSON.parse((await browser.stopTracing()).toString());
  const counts = trace.traceEvents
    .filter((e) => e.name === 'UpdateLayoutTree' && e.ph === 'X' && e.args?.elementCount !== undefined)
    .map((e) => e.args.elementCount);
  positions[label] = median(counts.slice(1));
}
await browser.close();

console.log(JSON.stringify({ env, iterations: ITERATIONS, results, positionOfToggledCard: { cards: N_POS, elementsRestyled: positions } }, null, 2));
console.log('');

const last = SIZES[SIZES.length - 1];
const first = SIZES[0];
const r = results;
const growth = (k) => r[k][last].ms / r[k][1000].ms;
console.log(`growth from 1000 to ${last} cards (4x the siblings):`);
for (const k of Object.keys(SELECTORS)) {
  console.log(`  ${k.padEnd(10)} ${round(growth(k))}x`);
}
console.log('');

const checks = [
  ['self: restyles 2 elements whatever the list size', SIZES.every((n) => r.self[n].elements === 2)],
  ['selfClass: restyles 1 element whatever the list size', SIZES.every((n) => r.selfClass[n].elements === 1)],
  ['plus: restyles every preceding card (elements ~ list size)',
    SIZES.every((n) => Math.abs(r.plus[n].elements - n) <= 2)],
  ['plusClass: restyles 1 element', SIZES.every((n) => r.plusClass[n].elements === 1)],
  ['tilde: restyles every preceding card (elements ~ list size)',
    SIZES.every((n) => Math.abs(r.tilde[n].elements - n) <= 2)],
  ['tilde: time grows faster than the list (4x siblings costs more than 8x)', growth('tilde') > 8],
  [`tilde is at least 5x slower than the class loop at ${last} cards`, r.tilde[last].ms > 5 * r.tildeClass[last].ms],
  [`plus stays within 10x of the class version at ${last} cards`, r.plus[last].ms < 10 * Math.max(r.plusClass[last].ms, 1)],
];
checks.push([
  'plus: toggling the first card restyles 1 element, the middle ~half, the last all',
  positions.first <= 2 && Math.abs(positions.middle - N_POS / 2) <= 3 && Math.abs(positions.last - N_POS) <= 3,
]);

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

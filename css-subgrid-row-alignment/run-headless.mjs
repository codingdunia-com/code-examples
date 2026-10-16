// Builds the same twelve cards four ways and asks Chromium where every title,
// body and footer actually landed:
//
//   subgrid : card spans 3 parent rows and uses grid-template-rows: subgrid
//   subgridExplicit : the same, with auto / 1fr / auto declared on the parent too
//   nested  : card is its own grid, rows auto / 1fr / auto
//   flex    : card is a flex column, footer pinned with margin-top: auto
//   fixed   : flex column plus a min-height guessed for the title (3 lines)
//             and the body (4 lines), calibrated once at a 940px container
//
// "Aligned" is judged with getBoundingClientRect, not by eye: for every visual
// row of cards, how far apart (max - min, in px) are the cards' body tops and
// footer tops? The container is then swept from 300px to 1300px in 5px steps,
// so the answer is "how much of the width range works", not "does it work at
// the width I happened to open".
//
// Nothing is timed, so the result does not depend on machine load.
import { chromium } from 'playwright';
import os from 'node:os';

const TITLES = [
  'Solar',
  'Heat pumps and how they size to a house',
  'Batteries',
  'Why a smart meter changes the maths of every tariff you were offered last year',
  'Inverters',
  'EV charging',
  'Insulation first',
  'Windows',
  'Ventilation heat recovery for older terraced houses',
  'Tariffs',
  'Monitoring',
  'Permits',
];
const SENTENCE = 'Each card has a body of a different length so the rows disagree. ';
const BODIES = TITLES.map((_, i) => SENTENCE.repeat(1 + ((i * 5) % 4)));

const GRID = `.grid { display:grid; gap:24px; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); }`;
const VARIANTS = {
  subgrid: `${GRID}
    .card { display:grid; grid-row:span 3; grid-template-rows:subgrid; row-gap:12px; }`,
  // The article's own code puts auto / 1fr / auto on the parent as well.
  subgridExplicit: `${GRID}
    .grid { grid-template-rows:auto 1fr auto; }
    .card { display:grid; grid-row:span 3; grid-template-rows:subgrid; row-gap:12px; }`,
  nested: `${GRID}
    .card { display:grid; grid-template-rows:auto 1fr auto; row-gap:12px; }`,
  flex: `${GRID}
    .card { display:flex; flex-direction:column; gap:12px; }
    .card footer { margin-top:auto; }`,
  fixed: `${GRID}
    .card { display:flex; flex-direction:column; gap:12px; }
    .card footer { margin-top:auto; }
    .card h3 { min-height:calc(3 * 1.3em); }
    .card p { min-height:calc(4 * 1.4em); }`,
};

function pageHtml(css) {
  const cards = TITLES.map((t, i) =>
    `<article class="card"><h3>${t}</h3><p>${BODIES[i]}</p><footer>Read more</footer></article>`).join('');
  return `<!doctype html><meta charset="utf-8"><style>
    body { margin:0; font:16px/1.4 system-ui, sans-serif; }
    .card { border:1px solid #888; padding:16px; }
    h3, p, footer { margin:0; } h3 { font-size:20px; line-height:1.3; }
    ${css}
  </style><body><div class="grid" id="g">${cards}</div>`;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1300, height: 900 } });

const env = {
  chromium: browser.version(),
  node: process.version,
  cpu: `${os.cpus()[0].model} (${os.cpus().length} cores)`,
  date: new Date().toISOString().slice(0, 10),
};

// Runs inside the page: lay the grid out at each width, report per-width stats.
function sweepInPage({ widths }) {
  const g = document.getElementById('g');
  const spread = (xs) => Math.round((Math.max(...xs) - Math.min(...xs)) * 100) / 100;
  return widths.map((width) => {
    g.style.width = `${width}px`;
    const rows = new Map();
    for (const c of g.children) {
      const top = Math.round(c.getBoundingClientRect().top);
      if (!rows.has(top)) rows.set(top, []);
      rows.get(top).push(c);
    }
    let bodyTop = 0;
    let footTop = 0;
    let titleToBody = null;
    for (const members of rows.values()) {
      const edge = (sel, e) => members.map((m) => m.querySelector(sel).getBoundingClientRect()[e]);
      bodyTop = Math.max(bodyTop, spread(edge('p', 'top')));
      footTop = Math.max(footTop, spread(edge('footer', 'top')));
    }
    const first = g.children[0];
    titleToBody = Math.round(
      (first.querySelector('p').getBoundingClientRect().top -
        first.querySelector('h3').getBoundingClientRect().bottom) * 100) / 100;
    return {
      width,
      columns: getComputedStyle(g).gridTemplateColumns.split(' ').length,
      rows: rows.size,
      bodyTopSpread: bodyTop,
      footerTopSpread: footTop,
      gridHeight: Math.round(g.getBoundingClientRect().height * 100) / 100,
      titleToBody,
    };
  });
}

const widths = [];
for (let w = 300; w <= 1300; w += 5) widths.push(w);

const sweeps = {};
for (const variant of Object.keys(VARIANTS)) {
  await page.setContent(pageHtml(VARIANTS[variant]));
  sweeps[variant] = await page.evaluate(sweepInPage, { widths });
}

// The gap subgrid inherits when the card does not set its own row-gap.
await page.setContent(pageHtml(VARIANTS.subgrid.replace('row-gap:12px;', '')));
const inherited = (await page.evaluate(sweepInPage, { widths: [940] }))[0];
await browser.close();

const aligned = (r) => r.bodyTopSpread === 0 && r.footerTopSpread === 0;
const summary = {};
for (const [variant, rows] of Object.entries(sweeps)) {
  const multi = rows.filter((r) => r.columns > 1);
  summary[variant] = {
    widthsTested: rows.length,
    alignedWidths: rows.filter(aligned).length,
    // widths where one column is trivially aligned are excluded from this ratio
    alignedWhenMultiColumn: multi.filter(aligned).length,
    multiColumnWidths: multi.length,
    worstBodyTopSpread: Math.max(...rows.map((r) => r.bodyTopSpread)),
    worstFooterTopSpread: Math.max(...rows.map((r) => r.footerTopSpread)),
  };
}
// Height paid for the alignment: subgrid grid height minus nested grid height.
const extra = sweeps.subgrid.map((r, i) => r.gridHeight - sweeps.nested[i].gridHeight);
const extraMulti = extra.filter((_, i) => sweeps.subgrid[i].columns > 1);
const mean = (xs) => Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100;

const table = [1240, 940, 620, 300].map((w) => {
  const row = { containerWidth: w };
  for (const variant of Object.keys(VARIANTS)) {
    const r = sweeps[variant].find((x) => x.width === (w === 1240 ? 1240 : w));
    row[variant] = { columns: r.columns, bodyTop: r.bodyTopSpread, footerTop: r.footerTopSpread, gridHeight: r.gridHeight };
  }
  return row;
});

const report = {
  env,
  table,
  summary,
  heightPaidForAlignment: {
    meanExtraPxMultiColumn: mean(extraMulti),
    maxExtraPx: Math.max(...extra),
    minExtraPx: Math.min(...extra),
    minExtraPxMultiColumn: Math.round(Math.min(...extraMulti) * 100) / 100,
    multiColumnWidthsWhereSubgridIsTaller: extraMulti.filter((x) => x > 0).length,
    multiColumnWidths: extraMulti.length,
  },
  subgridGapWithoutOverride: { titleToBodyPx: inherited.titleToBody, parentRowGap: 24, cardRowGapWhenSet: 12,
    titleToBodyWhenSet: sweeps.subgrid.find((r) => r.width === 940).titleToBody },
};
console.log(JSON.stringify(report, null, 2));
console.log('');

const checks = [
  ['subgrid: body tops and footer tops aligned at every width', summary.subgrid.alignedWidths === widths.length],
  ['subgrid with explicit parent rows: aligned at every width too', summary.subgridExplicit.alignedWidths === widths.length],
  ['nested grid: body tops are NOT aligned once cards sit side by side',
    summary.nested.alignedWhenMultiColumn < summary.nested.multiColumnWidths],
  ['flex + margin-top:auto pins footers but not body tops',
    summary.flex.worstFooterTopSpread === 0 && summary.flex.worstBodyTopSpread > 0],
  ['a calibrated min-height guess fails at some widths',
    summary.fixed.alignedWhenMultiColumn < summary.fixed.multiColumnWidths],
  ['subgrid never makes the grid shorter than the nested version', Math.min(...extra) >= 0],
  ['subgrid is taller than nested at every multi-column width (alignment is not free)', extraMulti.every((x) => x > 0)],
  ['an unset subgrid row-gap inherits the parent gap', inherited.titleToBody === 24],
];
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

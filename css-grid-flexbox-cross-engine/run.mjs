// Grid vs flexbox, measured in Chromium, Firefox and WebKit (Playwright 1.62.1),
// twice each in fresh browsers.
//
// Three groups: (1) what a long word or a wide image does to equal columns,
// (2) what each wrapping layout does on the last row and across 121 container
// widths, (3) how long a layout pass takes for 500 / 2000 / 8000 items.
//
// Groups 1 and 2 are layout, so they are asserted exactly. Group 3 is a timing,
// so it is only checked for sanity and printed as medians with ranges: the same
// rule scroll-driven-animation-cost follows.
import { collect, ENGINES, CFG } from './collect.mjs';

const data = await collect(2);
const names = ENGINES.map(([n]) => n);
const checks = [];
const check = (label, ok) => checks.push([label, ok]);
const pass = (n, i = 0) => data[n].passes[i];
const labels = pass('chromium').labels;
const label = (list, id) => list.find((x) => x.id === id).label;
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const mean = (xs) => Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100;

// ---- layout is repeatable --------------------------------------------------
for (const n of names) {
  const strip = (d) => JSON.stringify({ s: d.sizing, l: d.lastRow, w: d.sweep });
  check(`${n}: sizing / last-row / sweep identical across two fresh browsers`, strip(pass(n, 0)) === strip(pass(n, 1)));
}

// ---- group 1: sizing -------------------------------------------------------
for (const n of names) {
  const s = pass(n).sizing;
  for (const kind of ['word', 'image']) {
    const f = s[kind]['flex-1'];
    const g = s[kind]['grid-1fr'];
    check(`${n}/${kind}: flex: 1 and grid 1fr produce the same three widths (within 0.01 px)`,
      near(f.a, g.a, 0.01) && near(f.mid, g.mid, 0.01) && near(f.c, g.c, 0.01) && near(f.overflow, g.overflow, 0.01));
    check(`${n}/${kind}: flex: 1 blows the layout out (container overflow ${f.overflow} px)`, f.overflow > 100);
    const m = s[kind]['flex-1-minw0'];
    const mg = s[kind]['grid-minmax0'];
    check(`${n}/${kind}: min-width: 0 and minmax(0,1fr) give three equal 200 px tracks`,
      near(m.a, 200, 0.01) && near(m.mid, 200, 0.01) && near(mg.mid, 200, 0.01));
    check(`${n}/${kind}: ...but the content still overflows by more than 200 px (${m.overflow} px)`, m.overflow > 200 && mg.overflow > 200);
    check(`${n}/${kind}: overflow: hidden removes the overflow in flex and grid`,
      s[kind]['flex-1-ovh'].overflow === 0 && s[kind]['grid-1fr-ovh'].overflow === 0);
  }
  check(`${n}/word: overflow-wrap: break-word leaves the blowout in place`,
    s.word['flex-1-break-word'].overflow > 100 && s.word['grid-1fr-break-word'].overflow > 100);
  check(`${n}/word: overflow-wrap: anywhere fixes it with no min-width: 0`,
    s.word['flex-1-anywhere'].overflow === 0 && s.word['grid-1fr-anywhere'].overflow === 0
    && near(s.word['flex-1-anywhere'].mid, 200, 0.01));
  check(`${n}/image: max-width: 100% fixes the wide image, flex and grid alike`,
    s.imageMax['flex-1'].overflow === 0 && s.imageMax['grid-1fr'].overflow === 0);
  check(`${n}/image: with max-width: 100% and flex: 1 1 auto the middle item is NOT equal-width (${s.imageMax['flex-auto'].mid} px)`,
    s.imageMax['flex-auto'].mid > 300);
}
// Engines agree on the sizing numbers to within font-metric noise.
for (const kind of ['word', 'image', 'imageMax']) {
  for (const id of Object.keys(pass('chromium').sizing[kind])) {
    const ref = pass('chromium').sizing[kind][id];
    for (const n of names.slice(1)) {
      const c = pass(n).sizing[kind][id];
      check(`${kind}/${id}: ${n} within 4 px of Chromium on every width and the overflow`,
        ['a', 'mid', 'c', 'overflow'].every((k) => near(ref[k], c[k], 4)));
    }
  }
}

// ---- group 2: last row and column counts ----------------------------------
for (const n of names) {
  const l = pass(n).lastRow;
  check(`${n}: at 700 px, 8 items fall into 3 rows of 3 / 3 / 2 in all four layouts`,
    Object.values(l).every((v) => v.columns === 3 && v.rows === 3));
  check(`${n}: flex-wrap with flex-grow stretches the last row to ${l['flex-wrap-grow'].lastRowWidths.join(' + ')} px`,
    l['flex-wrap-grow'].lastRowWidths.every((w) => near(w, 342, 0.5)));
  check(`${n}: grid auto-fill keeps the last row at the column width (${l['grid-auto-fill'].lastRowWidths.join(' + ')} px)`,
    l['grid-auto-fill'].lastRowWidths.every((w) => near(w, 222.67, 0.1)));
  check(`${n}: auto-fit equals auto-fill when the last row is partly filled`,
    JSON.stringify(l['grid-auto-fit'].lastRowWidths) === JSON.stringify(l['grid-auto-fill'].lastRowWidths));
  const sw = pass(n).sweep;
  const colMiss = sw.filter((r) => r['flex-wrap-grow'].columns !== r['grid-auto-fill'].columns
    || r['flex-wrap-fixed'].columns !== r['grid-auto-fill'].columns);
  check(`${n}: column count is identical for flex-wrap and grid auto-fill at all ${sw.length} widths (${CFG.sweep.from}-${CFG.sweep.to} px)`, colMiss.length === 0);
  const wMiss = sw.filter((r) => !near(r['flex-wrap-grow'].itemWidth, r['grid-auto-fill'].itemWidth, 0.1));
  check(`${n}: first-row item width is identical for flex-grow wrap and auto-fill at all ${sw.length} widths`, wMiss.length === 0);
}

// ---- group 3: cost, sanity only -------------------------------------------
const costRows = {};
for (const n of names) {
  costRows[n] = {};
  for (const size of CFG.cost.sizes) {
    costRows[n][size] = {};
    for (const v of labels.COST) {
      const meds = [0, 1].map((i) => pass(n, i).cost[size][v.id].median);
      const mins = [0, 1].map((i) => pass(n, i).cost[size][v.id].min);
      costRows[n][size][v.id] = { median: mean(meds), a: meds[0], b: meds[1], min: Math.min(...mins) };
      check(`${n}: ${size} items / ${v.id} produced a positive, finite timing`, Number.isFinite(meds[0]) && meds[0] > 0 && meds[1] > 0);
    }
  }
}

// ---- report ---------------------------------------------------------------
console.log('Engines: ' + names.map((n) => `${n} ${data[n].version}`).join(' | '));
console.log(`Unbroken word is ${names.map((n) => `${pass(n).wordWidth} px in ${n}`).join(', ')} at 16px monospace; the container is 600 px.\n`);

const kinds = [['word', 'Long unbreakable word in the middle item'], ['image', 'Unsized 1200x600 image in the middle item'], ['imageMax', 'Same image with max-width: 100%']];
for (const [kind, title] of kinds) {
  console.log(`### ${title} (Chromium; widths: left / middle / right, then container overflow)`);
  console.log('| Layout | left / middle / right px | container overflow px |');
  console.log('| --- | --- | ---: |');
  for (const id of Object.keys(pass('chromium').sizing[kind])) {
    const c = pass('chromium').sizing[kind][id];
    console.log(`| ${label(labels.SIZING, id)} | ${c.a} / ${c.mid} / ${c.c} | ${c.overflow} |`);
  }
  console.log('');
}

console.log('### Last row at 700 px, 8 items, 16 px gap (Chromium)');
for (const v of labels.GRIDS) {
  const l = pass('chromium').lastRow[v.id];
  console.log(`  ${v.label}: ${l.columns} columns, first-row width ${l.firstRowWidth}, last row ${l.lastRowWidths.join(' + ')}`);
}

console.log('\n### Layout pass cost, ms per forced layout (mean of the two passes, each pass shown in brackets; shared CPU, read ratios not absolutes)');
for (const n of names) {
  console.log(`\n${n} ${data[n].version}`);
  console.log('| Layout | ' + CFG.cost.sizes.map((s) => `${s} items`).join(' | ') + ' |');
  console.log('| --- | ' + CFG.cost.sizes.map(() => '---:').join(' | ') + ' |');
  for (const v of labels.COST) {
    console.log(`| ${v.label} | ` + CFG.cost.sizes.map((s) => {
      const c = costRows[n][s][v.id];
      return `${c.median} (${c.a} / ${c.b})`;
    }).join(' | ') + ' |');
  }
  const big = CFG.cost.sizes[CFG.cost.sizes.length - 1];
  const r1 = costRows[n][big]['grid-auto-fill'].median / costRows[n][big]['flex-wrap'].median;
  const r2 = costRows[n][big]['grid-row'].median / costRows[n][big]['flex-row'].median;
  console.log(`grid auto-fill / flex-wrap at ${big} items: x${r1.toFixed(2)};  grid one row / flex one row: x${r2.toFixed(2)}`);
  check(`${n}: grid/flex layout-cost ratios are within a sane band (0.2-20): ${r1.toFixed(2)}, ${r2.toFixed(2)}`, r1 > 0.2 && r1 < 20 && r2 > 0.2 && r2 < 20);
}

console.log('');
let failed = 0;
for (const [l, ok] of checks) {
  if (!ok) { failed++; console.log(`FAIL ${l}`); }
}
console.log(`${checks.length - failed}/${checks.length} assertions passed.`);
if (failed > 0) { process.exit(1); }

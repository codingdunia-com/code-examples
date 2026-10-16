// Measures 12 centering techniques in Chromium, Firefox and WebKit (Playwright
// 1.62.1), twice each in fresh browsers, then asserts the shape of the answer.
//
// Layout is deterministic, so unlike a timing benchmark the numbers must not move
// between passes or machines. Assertions are therefore exact (0.5 px tolerance
// for sub-pixel rounding), and a failure means a browser release changed.
import { collect, ENGINES } from './collect.mjs';
import { TECHNIQUES, SCENARIOS } from './techniques.mjs';

const TOL = 0.5;
const names = ENGINES.map(([n]) => n);
const data = await collect(2);

const checks = [];
const check = (label, ok) => checks.push([label, ok]);
const cell = (eng, t, s, pass = 0) => data[eng].passes[pass][t][s];
const near = (a, b, tol = TOL) => Math.abs(a - b) <= tol;

// 1. Repeatability: pass 2 in a fresh browser must equal pass 1 exactly.
for (const n of names) {
  const same = JSON.stringify(data[n].passes[0]) === JSON.stringify(data[n].passes[1]);
  check(`${n}: two passes in fresh browsers are identical`, same);
}

// The scroll container must keep its full 400x300 client box, i.e. no scrollbar
// gutter, or every "center" below would be measured against a smaller box.
for (const n of names) {
  const sizes = new Set(TECHNIQUES.flatMap((t) => SCENARIOS.map((s) => `${cell(n, t.id, s.id).clientW}x${cell(n, t.id, s.id).clientH}`)));
  check(`${n}: client box is 400x300 in every case (no scrollbar gutter)`, sizes.size === 1 && sizes.has('400x300'));
}

// 2. Every technique centers the small box. Only the line-height trick may be a
//    pixel or so off vertically, because it centers on the font, not on the box.
for (const t of TECHNIQUES) {
  for (const n of names) {
    const c = cell(n, t.id, 'small');
    const yTol = t.id === 'text-align-line-height' ? 1.5 : TOL;
    check(`${n}: ${t.id} centers a 200x100 box (dx=${c.dx}, dy=${c.dy})`, near(c.dx, 0) && near(c.dy, 0, yTol));
  }
}

// 3. What each technique does to a box that does not fit.
const LOSES_BOTH = ['flex-center', 'grid-place-items-fixed', 'grid-place-content', 'abs-transform'];
const SAFE = [
  'flex-safe-center', 'flex-margin-auto', 'grid-place-items', 'grid-safe-fixed',
  'grid-margin-auto', 'abs-align-self', 'text-align-line-height',
];
for (const n of names) {
  for (const id of LOSES_BOTH) {
    const c = cell(n, id, 'both');
    check(`${n}: ${id} loses 100 px at the top and 100 px at the left`, near(c.lostTop, 100) && near(c.lostLeft, 100));
  }
  for (const id of SAFE) {
    const c = cell(n, id, 'both');
    check(`${n}: ${id} loses nothing`, c.lostTop === 0 && c.lostLeft === 0 && c.lostBottom === 0 && c.lostRight === 0);
  }
  const m = (s) => cell(n, 'abs-inset-margin', s);
  check(`${n}: inset:0 + margin:auto is safe horizontally (too wide: lostLeft ${m('wide').lostLeft})`, m('wide').lostLeft === 0);
  check(`${n}: inset:0 + margin:auto is NOT safe vertically (too tall: lostTop ${m('tall').lostTop})`, near(m('tall').lostTop, 100));
}

// 4. Nothing is ever lost at the bottom or right at max scroll.
for (const n of names) {
  const worst = Math.max(...TECHNIQUES.flatMap((t) => SCENARIOS.map((s) => {
    const c = cell(n, t.id, s.id);
    return Math.max(c.lostBottom, c.lostRight);
  })));
  check(`${n}: nothing is cut off at the bottom/right edge at maximum scroll`, worst === 0);
}

// 5. Do the engines agree? Positions: must. Scroll extent: report.
const positionDisagreements = [];
const extentDisagreements = [];
for (const t of TECHNIQUES) {
  for (const s of SCENARIOS) {
    const ref = cell('chromium', t.id, s.id);
    for (const n of names.slice(1)) {
      const c = cell(n, t.id, s.id);
      const dPos = ['left', 'top', 'lostTop', 'lostLeft'].filter((k) => !near(ref[k], c[k], 1.5));
      if (dPos.length) {
        positionDisagreements.push(`${t.id}/${s.id}: ${n} differs on ${dPos.join(',')}`);
      }
      if (ref.scrollW !== c.scrollW || ref.scrollH !== c.scrollH) {
        extentDisagreements.push({
          t: t.id, s: s.id, n,
          ref: `${ref.scrollW}x${ref.scrollH}`, got: `${c.scrollW}x${c.scrollH}`,
          maxRef: `${ref.maxScrollX},${ref.maxScrollY}`, maxGot: `${c.maxScrollX},${c.maxScrollY}`,
        });
      }
      if (ref.maxScrollX !== c.maxScrollX || ref.maxScrollY !== c.maxScrollY) {
        positionDisagreements.push(`${t.id}/${s.id}: ${n} real scroll limit ${c.maxScrollX},${c.maxScrollY} vs ${ref.maxScrollX},${ref.maxScrollY}`);
      }
    }
  }
}
check('box positions and real scroll limits agree across all three engines', positionDisagreements.length === 0);

// ---- report -------------------------------------------------------------
console.log('Engines: ' + names.map((n) => `${n} ${data[n].version}`).join(' | '));
console.log('Box: 400x300 scroll container, overflow:auto. Child sizes: ' + SCENARIOS.map((s) => s.label).join('; '));
console.log('');

const f = (n) => (n === 0 ? '0' : String(n));
console.log('| Technique | 200x100 centered? | 600x500: px lost top / left | 600x100: left | 200x500: top |');
console.log('| --- | --- | --- | ---: | ---: |');
for (const t of TECHNIQUES) {
  const c = cell('chromium', t.id, 'small');
  const centered = near(c.dx, 0) && near(c.dy, 0) ? 'yes' : `no (dy ${c.dy})`;
  const b = cell('chromium', t.id, 'both');
  const w = cell('chromium', t.id, 'wide');
  const k = cell('chromium', t.id, 'tall');
  console.log(`| ${t.label} | ${centered} | ${f(b.lostTop)} / ${f(b.lostLeft)} | ${f(w.lostLeft)} | ${f(k.lostTop)} |`);
}
console.log('\n(values from Chromium; check "positions agree" below for the other two engines)\n');

console.log('Vertical error of the line-height trick on a 200x100 box, per engine:');
for (const n of names) {
  console.log(`  ${n}: ${cell(n, 'text-align-line-height', 'small').dy} px`);
}

console.log('\nScroll extent (scrollWidth x scrollHeight) that differs from Chromium:');
if (extentDisagreements.length === 0) {
  console.log('  none');
}
for (const d of extentDisagreements) {
  console.log(`  ${d.t} / ${d.s}: chromium scrollWidth x scrollHeight ${d.ref}, ${d.n} ${d.got}; real max scroll (x,y) chromium ${d.maxRef}, ${d.n} ${d.maxGot}`);
}
if (positionDisagreements.length) {
  console.log('\nPosition disagreements:');
  positionDisagreements.forEach((l) => console.log('  ' + l));
}

console.log('');
let failed = 0;
for (const [label, ok] of checks) {
  if (!ok) {
    failed++;
    console.log(`FAIL ${label}`);
  }
}
console.log(`${checks.length - failed}/${checks.length} assertions passed.`);
if (failed > 0) {
  process.exit(1);
}

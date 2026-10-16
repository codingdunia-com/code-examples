// Does the browser pay for nesting? The same stylesheet, written nested (native) and
// flattened (what Sass and lightningcss ship), parsed and applied by headless Chromium.
//
//   parse  = new CSSStyleSheet().replaceSync(css)
//   apply  = adopt the sheet, then force style + layout (document.body.offsetHeight)
//
// A fresh page per sample, variants interleaved, and a checksum of every element's computed
// padding and colour so a variant that parsed to something different cannot post a time.
//
// Three parts:
//   1. the generated stylesheet from compile-bench.mjs, nested vs two flattened versions
//   2. which nesting PATTERN is responsible, one pattern at a time (nested vs hand-flattened)
//   3. how the expensive pattern scales with the number of components
import os from 'node:os';
import assert from 'node:assert/strict';
import * as sass from 'sass';
import { transform } from 'lightningcss';
import { chromium } from 'playwright';
import { generateSource } from './generate.mjs';

const quick = process.argv.includes('--quick');
const sizes = quick ? [1000] : [1000, 5000];
const SAMPLES = quick ? 5 : 11;
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const ms = (x) => (x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2));

const browser = await chromium.launch();
console.log('chromium ' + browser.version() + ' | ' + os.cpus()[0].model + ' (' + os.cpus().length + ' cores) | ' + new Date().toISOString().slice(0, 10));
console.log('load average at start: ' + os.loadavg().map((x) => x.toFixed(1)).join(' / ') + '\n');

const measure = async (css, n) => {
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  await page.setContent('<!doctype html><html><body></body></html>');
  const out = await page.evaluate(({ css, n }) => {
    const frag = document.createDocumentFragment();
    for (let i = 0; i < n; i++) {
      const c = document.createElement('div');
      c.className = 'c' + i + (i % 3 === 0 ? ' featured' : '');
      const t = document.createElement('span');
      t.className = 'title';
      t.textContent = 'item ' + i;
      c.appendChild(t);
      frag.appendChild(c);
    }
    document.body.appendChild(frag);
    void document.body.offsetHeight; // lay out once with no styles so apply measures only the sheet
    const t0 = performance.now();
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(css);
    const t1 = performance.now();
    document.adoptedStyleSheets = [sheet];
    void document.body.offsetHeight;
    const t2 = performance.now();
    let sum = 0;
    const kids = document.body.children;
    for (let i = 0; i < kids.length; i += 7) {
      const cs = getComputedStyle(kids[i]);
      const ts = getComputedStyle(kids[i].firstChild);
      sum += parseFloat(cs.paddingTop) * 31 + parseFloat(cs.borderTopWidth) * 7 + parseFloat(ts.fontSize) + cs.color.length;
    }
    return { parse: t1 - t0, apply: t2 - t1, rules: sheet.cssRules.length, checksum: Math.round(sum * 1000) };
  }, { css, n });
  await page.close();
  return out;
};

for (const n of sizes) {
  const src = generateSource(n);
  const variants = {
    'nested, as written': src,
    'flattened by sass': sass.compileString(src).css,
    'flattened by lightningcss': transform({ filename: 'a.css', code: Buffer.from(src), targets: { chrome: 100 << 16 } }).code.toString(),
  };
  const names = Object.keys(variants);
  for (const nm of names) { await measure(variants[nm], n); } // warm-up, discarded
  const parse = Object.fromEntries(names.map((k) => [k, []]));
  const apply = Object.fromEntries(names.map((k) => [k, []]));
  const meta = {};
  for (let r = 0; r < SAMPLES; r++) {
    for (let k = 0; k < names.length; k++) {
      const nm = names[(k + r) % names.length];
      const o = await measure(variants[nm], n);
      parse[nm].push(o.parse);
      apply[nm].push(o.apply);
      meta[nm] = { rules: o.rules, checksum: o.checksum };
    }
  }
  console.log('## ' + n.toLocaleString('en-US') + ' components, ' + (2 * n).toLocaleString('en-US') + ' elements, ' + SAMPLES + ' samples, fresh page each');
  console.log('variant | top-level rules | KB | parse ms median (min) | apply ms median (min)');
  for (const nm of names) {
    console.log([nm, meta[nm].rules, (Buffer.byteLength(variants[nm]) / 1024).toFixed(0), ms(median(parse[nm])) + ' (' + ms(Math.min(...parse[nm])) + ')', ms(median(apply[nm])) + ' (' + ms(Math.min(...apply[nm])) + ')'].join(' | '));
  }
  console.log('');
  const sums = new Set(names.map((nm) => meta[nm].checksum));
  assert.equal(sums.size, 1, 'every variant must produce the same computed styles, got checksums ' + [...sums].join(', '));
  assert.equal(meta['nested, as written'].rules, n, 'nested source keeps one top-level rule per component');
  assert.ok(meta['flattened by sass'].rules > 2 * n, 'flattened output has many more top-level rules');
}
console.log('All variants produced identical computed styles.\n');

// ---------------- part 2: which pattern is it? ----------------
const wrap = (n, body) => Array.from({ length: n }, (_, i) => `.c${i} {\n  padding: ${4 + (i % 12)}px;\n${body(i)}\n}`).join('\n');
const flatten = (n, rules) => Array.from({ length: n }, (_, i) => `.c${i} { padding: ${4 + (i % 12)}px; }\n` + rules.map((r) => r(i)).join('\n')).join('\n');
const patterns = {
  '& .title': {
    nested: (n) => wrap(n, (i) => `  & .title { font-size: 1.${i % 9}rem; }`),
    flat: (n) => flatten(n, [(i) => `.c${i} .title { font-size: 1.${i % 9}rem; }`]),
  },
  '&.featured': {
    nested: (n) => wrap(n, () => '  &.featured { border: 2px solid red; }'),
    flat: (n) => flatten(n, [(i) => `.c${i}.featured { border: 2px solid red; }`]),
  },
  '&:focus-visible': {
    nested: (n) => wrap(n, () => '  &:focus-visible { outline: 2px solid red; }'),
    flat: (n) => flatten(n, [(i) => `.c${i}:focus-visible { outline: 2px solid red; }`]),
  },
  '@media { & .title }': {
    nested: (n) => wrap(n, (i) => `  @media (min-width: 40rem) { padding: ${8 + (i % 12)}px; & .title { font-size: 1.${i % 9}rem; } }`),
    flat: (n) => flatten(n, [(i) => `@media (min-width: 40rem) { .c${i} { padding: ${8 + (i % 12)}px; } .c${i} .title { font-size: 1.${i % 9}rem; } }`]),
  },
  '& .title { &.active }': {
    nested: (n) => wrap(n, (i) => `  & .title { font-size: 1.${i % 9}rem; &.active { font-weight: 700; } }`),
    flat: (n) => flatten(n, [(i) => `.c${i} .title { font-size: 1.${i % 9}rem; }`, (i) => `.c${i} .title.active { font-weight: 700; }`]),
  },
  '& .title { & b }': {
    nested: (n) => wrap(n, (i) => `  & .title { font-size: 1.${i % 9}rem; & b { font-weight: 700; } }`),
    flat: (n) => flatten(n, [(i) => `.c${i} .title { font-size: 1.${i % 9}rem; }`, (i) => `.c${i} .title b { font-weight: 700; }`]),
  },
  '& .title:hover (written flat, depth 2)': {
    nested: (n) => wrap(n, (i) => `  & .title { font-size: 1.${i % 9}rem; }\n  & .title:hover { text-decoration: underline; }`),
    flat: (n) => flatten(n, [(i) => `.c${i} .title { font-size: 1.${i % 9}rem; }`, (i) => `.c${i} .title:hover { text-decoration: underline; }`]),
  },
  '& .title { &:first-child }': {
    nested: (n) => wrap(n, (i) => `  & .title { font-size: 1.${i % 9}rem; &:first-child { margin: 0; } }`),
    flat: (n) => flatten(n, [(i) => `.c${i} .title { font-size: 1.${i % 9}rem; }`, (i) => `.c${i} .title:first-child { margin: 0; }`]),
  },
  '& .title { &::after }': {
    nested: (n) => wrap(n, (i) => `  & .title { font-size: 1.${i % 9}rem; &::after { content: '.'; } }`),
    flat: (n) => flatten(n, [(i) => `.c${i} .title { font-size: 1.${i % 9}rem; }`, (i) => `.c${i} .title::after { content: '.'; }`]),
  },
  '& .title { &:hover }': {
    nested: (n) => wrap(n, (i) => `  & .title { font-size: 1.${i % 9}rem; &:hover { text-decoration: underline; } }`),
    flat: (n) => flatten(n, [(i) => `.c${i} .title { font-size: 1.${i % 9}rem; }`, (i) => `.c${i} .title:hover { text-decoration: underline; }`]),
  },
};
const rounds = quick ? 3 : 7;
const N2 = 1000;
console.log('## part 2: one pattern at a time, ' + N2.toLocaleString('en-US') + ' components, apply ms median (min), ' + rounds + ' samples');
console.log('pattern | nested | hand-flattened | ratio');
const p2 = {};
for (const [name, p] of Object.entries(patterns)) {
  const nestedCss = p.nested(N2);
  const flatCss = p.flat(N2);
  await measure(nestedCss, N2);
  const a = [];
  const b = [];
  let ca;
  let cb;
  for (let r = 0; r < rounds; r++) {
    // alternate who goes first so neither always runs on a freshly idle machine
    const first = r % 2 === 0 ? nestedCss : flatCss;
    const second = r % 2 === 0 ? flatCss : nestedCss;
    const o1 = await measure(first, N2);
    const o2 = await measure(second, N2);
    const nestedRun = r % 2 === 0 ? o1 : o2;
    const flatRun = r % 2 === 0 ? o2 : o1;
    a.push(nestedRun.apply);
    b.push(flatRun.apply);
    ca = nestedRun.checksum;
    cb = flatRun.checksum;
  }
  assert.equal(ca, cb, name + ': nested and flattened must compute the same styles');
  p2[name] = { nested: median(a), flat: median(b) };
  console.log([name, ms(median(a)) + ' (' + ms(Math.min(...a)) + ')', ms(median(b)) + ' (' + ms(Math.min(...b)) + ')', (median(a) / median(b)).toFixed(1) + 'x'].join(' | '));
}
for (const name of ['& .title', '&.featured', '&:focus-visible', '& .title:hover (written flat, depth 2)']) {
  assert.ok(p2[name].nested / p2[name].flat < 2, name + ' should cost about the same nested or flattened');
}
assert.ok(p2['& .title { &:hover }'].nested / p2['& .title { &:hover }'].flat > 3, 'a nested pseudo-class under a nested descendant should be several times slower than its flattened twin');
console.log('');

// ---------------- part 3: scaling of the expensive pattern ----------------
const sweep = quick ? [250, 500, 1000] : [250, 500, 1000, 2000, 4000];
console.log('## part 3: "& .title { &:hover }" as the number of components grows, apply ms median');
console.log('components | nested | hand-flattened | ratio');
const p3 = {};
for (const n of sweep) {
  const a = [];
  const b = [];
  for (let r = 0; r < (n >= 2000 ? 3 : rounds); r++) {
    a.push((await measure(patterns['& .title { &:hover }'].nested(n), n)).apply);
    b.push((await measure(patterns['& .title { &:hover }'].flat(n), n)).apply);
  }
  p3[n] = { nested: median(a), flat: median(b) };
  console.log([n.toLocaleString('en-US'), ms(median(a)), ms(median(b)), (median(a) / median(b)).toFixed(1) + 'x'].join(' | '));
}
const k = sweep.length;
assert.ok(p3[sweep[k - 1]].nested / p3[sweep[k - 2]].nested > 2.5, 'doubling the components should more than double the nested cost (it grows faster than linearly)');
await browser.close();
console.log('\nAll assertions passed.');

// Where does native CSS nesting resolve differently from Sass? Each case is ONE css text,
// fed unchanged to four routes, and the answer is read back from headless Chromium with
// getComputedStyle. Nothing here is reasoned from the spec: the browser is the oracle.
//
//   native           the text injected as written
//   sass             sass.compileString (the current release), then injected
//   sass 1.91.0      the last release that hoists declarations above nested rules
//   lightningcss     transform with an old target (forces nesting to be lowered), then injected
//   postcss-nesting  postcss + postcss-nesting, then injected
//
// Needs a Chromium: `npx playwright install chromium` once.
import assert from 'node:assert/strict';
import * as sass from 'sass';
import * as sassOld from 'sass-1-91';
import { transform } from 'lightningcss';
import postcss from 'postcss';
import nesting from 'postcss-nesting';
import { chromium } from 'playwright';

const warnings = [];
const routes = {
  native: async (css) => css,
  sass: async (css) => sass.compileString(css, { logger: { warn: (m) => { warnings.push(m.split('\n')[0]); }, debug() {} } }).css,
  'sass 1.91.0': async (css) => sassOld.compileString(css, { logger: { warn() {}, debug() {} } }).css,
  lightningcss: async (css) => transform({ filename: 'a.css', code: Buffer.from(css), targets: { chrome: 100 << 16 } }).code.toString(),
  'postcss-nesting': async (css) => (await postcss([nesting()]).process(css, { from: undefined })).css,
};

const cases = [
  {
    id: 'bem-suffix',
    title: 'Sass-style suffix: &__title',
    css: `.card { color: black; &__title { color: red; } }`,
    html: `<p class="card__title" id="t">x</p>`,
    prop: 'color',
  },
  {
    id: 'selector-list-specificity',
    title: 'Selector list with an ID, then nested & p',
    css: `.card, #featured { & p { color: green; } }\n.card p.note { color: red; }`,
    html: `<div class="card"><p class="note" id="t">x</p></div>`,
    prop: 'color',
  },
  {
    id: 'declaration-after-nested-rule',
    title: 'Declaration written after a nested rule',
    css: `.box { color: red; & { color: green; } color: blue; }`,
    html: `<p class="box" id="t">x</p>`,
    prop: 'color',
  },
  {
    id: 'bare-type-selector',
    title: 'Bare type selector, no &: .card { a { } }',
    css: `.card { a { color: red; } }`,
    html: `<div class="card"><a id="t" href="#">x</a></div>`,
    prop: 'color',
  },
  {
    id: 'bare-class-selector',
    title: 'Bare class selector, no &: .card { .title { } }',
    css: `.card { .title { color: red; } }`,
    html: `<div class="card"><p class="title" id="t">x</p></div>`,
    prop: 'color',
  },
  {
    id: 'parent-reference-after',
    title: 'Parent reference at the end: .dark &',
    css: `.panel { color: black; .dark & { color: red; } }`,
    html: `<div class="dark"><p class="panel" id="t">x</p></div>`,
    prop: 'color',
  },
  {
    id: 'nested-media',
    title: 'Nested @media inside a rule',
    css: `.m { color: black; @media (min-width: 600px) { color: red; } }`,
    html: `<p class="m" id="t">x</p>`,
    prop: 'color',
  },
];

const browser = await chromium.launch();
const ver = (s) => s.info.split('\t')[1];
console.log('chromium ' + browser.version() + ' | sass ' + ver(sass) + ' and ' + ver(sassOld) + ' | lightningcss + postcss-nesting as pinned in package.json | ' + new Date().toISOString().slice(0, 10) + '\n');

const results = {};
for (const c of cases) {
  results[c.id] = {};
  for (const [route, fn] of Object.entries(routes)) {
    let css;
    try { css = await fn(c.css); } catch (e) { results[c.id][route] = 'tool error: ' + String(e.message).split('\n')[0].slice(0, 70); continue; }
    const page = await browser.newPage({ viewport: { width: 1000, height: 600 } });
    await page.setContent(`<!doctype html><html><head><style>${css}</style></head><body style="color:black">${c.html}</body></html>`);
    results[c.id][route] = await page.evaluate((prop) => getComputedStyle(document.getElementById('t'))[prop], c.prop);
    await page.close();
  }
}
// ---- capability probes: what the browser does with Sass-only and new-CSS constructs --------
const probes = {
  mixin: { css: '@mixin --m { color: rgb(255, 0, 0); } .t { @apply --m; }', expect: (r) => r.color === 'rgb(0, 0, 0)', says: '@mixin/@apply: not applied' },
  function: { css: '@function --dbl(--x) { result: calc(var(--x) * 2); } .t { width: --dbl(4px); }', expect: (r) => r.width === '8px', says: '@function: applied (width 8px)' },
  each: { css: '@each $a in 1 2 { .t { color: red; } }', expect: (r) => r.rules === 0 && r.color === 'rgb(0, 0, 0)', says: '@each: ignored, no rule produced' },
};
const probeResults = {};
for (const [name, pr] of Object.entries(probes)) {
  const page = await browser.newPage({ viewport: { width: 1000, height: 600 } });
  await page.setContent(`<!doctype html><html><head><style>${pr.css}</style></head><body style="color:black"><p class="t" id="t">x</p></body></html>`);
  probeResults[name] = await page.evaluate(() => {
    const cs = getComputedStyle(document.getElementById('t'));
    return { color: cs.color, width: cs.width, rules: document.styleSheets[0].cssRules.length };
  });
  await page.close();
}
await browser.close();

const names = { 'rgb(255, 0, 0)': 'red', 'rgb(0, 128, 0)': 'green', 'rgb(0, 0, 255)': 'blue', 'rgb(0, 0, 0)': 'black' };
const nice = (v) => names[v] ?? v;
console.log('case | ' + Object.keys(routes).join(' | '));
for (const c of cases) {
  const r = results[c.id];
  console.log([c.title, ...Object.keys(routes).map((k) => nice(r[k]))].join(' | '));
}
console.log('\nSass warnings seen: ' + (warnings.length ? '\n  ' + [...new Set(warnings)].join('\n  ') : 'none'));

// ---- assertions: the claims the article makes --------------------------------
const R = (id, route) => nice(results[id][route]);
// 1. the suffix form works in Sass and does nothing natively
assert.equal(R('bem-suffix', 'sass'), 'red');
assert.equal(R('bem-suffix', 'native'), 'black');
// 2. native nesting wraps the parent list in :is(), so the ID's specificity applies to .card as well
assert.equal(R('selector-list-specificity', 'native'), 'green');
assert.equal(R('selector-list-specificity', 'sass'), 'red');
// 3. native keeps source order across a nested rule; Sass hoists the declaration above it
assert.equal(R('declaration-after-nested-rule', 'native'), 'blue');
assert.equal(R('declaration-after-nested-rule', 'sass'), 'blue', 'current Sass keeps source order');
assert.equal(R('declaration-after-nested-rule', 'sass 1.91.0'), 'green', 'Sass 1.91.0 still hoists');
// 3b. lightningcss and postcss-nesting do not understand &__title and do not say so
for (const [name, fn] of [['lightningcss', routes.lightningcss], ['postcss-nesting', routes['postcss-nesting']]]) {
  const out = await fn(cases[0].css);
  console.log('\n' + name + ' output for ' + cases[0].css + '\n  ' + out.replace(/\s+/g, ' ').trim());
  assert.ok(/__title\.card/.test(out), name + ' should emit the dead compound selector __title.card');
}
// 4. a bare type or class selector needs no & in current Chromium
assert.equal(R('bare-type-selector', 'native'), 'red');
assert.equal(R('bare-class-selector', 'native'), 'red');
// 5. the rest agree
for (const id of ['bare-type-selector', 'bare-class-selector', 'parent-reference-after', 'nested-media']) {
  for (const route of Object.keys(routes)) { assert.equal(R(id, route), 'red', id + ' via ' + route); }
}
// 6. what stays Sass-only, and one thing that is no longer
console.log('\ncapability probes in this Chromium:');
for (const [name, pr] of Object.entries(probes)) {
  console.log('  ' + pr.says + ' -> ' + (pr.expect(probeResults[name]) ? 'as expected' : 'CHANGED: ' + JSON.stringify(probeResults[name])));
  assert.ok(pr.expect(probeResults[name]), pr.says + ' no longer holds in this browser; the article needs an update');
}
console.log('\nAll assertions passed.');

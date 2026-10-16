// Compile time and shipped size for the same nested stylesheet through four routes:
//   native             the source as written, shipped untouched (nesting stays nested)
//   native, minified   lightningcss minify with a modern target, so nesting is NOT lowered
//   sass               sass.compileString (the `sass` npm package, dart-sass compiled to JS)
//   lightningcss       transform with an old browser target, which forces nesting to be lowered
//   postcss-nesting    postcss + postcss-nesting
//
//   node compile-bench.mjs [--quick]
import os from 'node:os';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';
import * as sass from 'sass';
import { transform } from 'lightningcss';
import postcss from 'postcss';
import nesting from 'postcss-nesting';
import { generateSource, RULES_PER_COMPONENT, BLOCKS_PER_COMPONENT } from './generate.mjs';

const quick = process.argv.includes('--quick');
const sizes = quick ? [100, 1000] : [100, 1000, 5000];
const ROUNDS = quick ? 3 : 7;

const pkgVersion = async (name) => JSON.parse((await import('node:fs')).readFileSync(new URL('./node_modules/' + name + '/package.json', import.meta.url), 'utf8')).version;
console.log('node ' + process.version + ' | ' + os.cpus()[0].model + ' (' + os.cpus().length + ' cores) | ' + new Date().toISOString().slice(0, 10));
const versions = {};
for (const n of ['sass', 'lightningcss', 'postcss', 'postcss-nesting']) { versions[n] = await pkgVersion(n); }
console.log('sass ' + versions.sass + ' | lightningcss ' + versions.lightningcss + ' | postcss ' + versions.postcss + ' | postcss-nesting ' + versions['postcss-nesting']);
console.log('load average at start: ' + os.loadavg().map((x) => x.toFixed(1)).join(' / ') + '\n');

const OLD = { chrome: 100 << 16 }; // Chrome 100 has no nesting, so lightningcss must lower it
const NEW = { chrome: 130 << 16 };
const dec = (b) => b.toString();

const routes = {
  'native (as written)': async (src) => src,
  'native, minified (lightningcss)': async (src) => dec(transform({ filename: 'a.css', code: Buffer.from(src), minify: true, targets: NEW }).code),
  'sass, expanded': async (src) => sass.compileString(src, { style: 'expanded' }).css,
  'sass, compressed': async (src) => sass.compileString(src, { style: 'compressed' }).css,
  'lightningcss, nesting lowered': async (src) => dec(transform({ filename: 'a.css', code: Buffer.from(src), minify: false, targets: OLD }).code),
  'lightningcss, lowered + minified': async (src) => dec(transform({ filename: 'a.css', code: Buffer.from(src), minify: true, targets: OLD }).code),
  'postcss-nesting': async (src) => (await postcss([nesting()]).process(src, { from: undefined })).css,
};
const names = Object.keys(routes);
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const kb = (b) => (b / 1024).toFixed(1);
const ms = (x) => (x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2));

const all = {};
for (const n of sizes) {
  const src = generateSource(n);
  const out = {};
  const times = Object.fromEntries(names.map((nm) => [nm, []]));
  for (const nm of names) { out[nm] = await routes[nm](src); } // warm-up and output capture
  for (let r = 0; r < ROUNDS; r++) {
    for (let k = 0; k < names.length; k++) {
      const nm = names[(k + r) % names.length];
      const t = performance.now();
      await routes[nm](src);
      times[nm].push(performance.now() - t);
    }
  }
  // Structural sanity: every lowering route must have produced the flattened rule count.
  const flatRules = (css) => (css.match(/\{/g) || []).length;
  assert.equal(src.includes('& .title'), true);
  for (const nm of ['sass, expanded', 'lightningcss, nesting lowered', 'postcss-nesting']) {
    assert.ok(!/&/.test(out[nm]), nm + ' left an & in its output');
    assert.equal(flatRules(out[nm]), n * BLOCKS_PER_COMPONENT, nm + ' produced an unexpected number of blocks');
  }
  assert.ok(/&/.test(out['native (as written)']), 'native route must still contain &');
  all[n] = Object.fromEntries(names.map((nm) => [nm, {
    raw: Buffer.byteLength(out[nm]),
    gzip: zlib.gzipSync(out[nm], { level: 9 }).length,
    br: zlib.brotliCompressSync(out[nm], { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9 } }).length,
    med: median(times[nm]),
    min: Math.min(...times[nm]),
  }]));

  console.log('## ' + n.toLocaleString('en-US') + ' components (' + (n * RULES_PER_COMPONENT).toLocaleString('en-US') + ' flattened rules), source ' + kb(Buffer.byteLength(src)) + ' KB, ' + ROUNDS + ' rounds interleaved');
  console.log('route | compile ms median (min) | raw KB | gzip KB | brotli-9 KB');
  for (const nm of names) {
    const r = all[n][nm];
    console.log([nm, nm === 'native (as written)' ? '0 (no step)' : ms(r.med) + ' (' + ms(r.min) + ')', kb(r.raw), kb(r.gzip), kb(r.br)].join(' | '));
  }
  console.log('');
}

// Directional assertions: rules, not exact numbers.
for (const n of sizes) {
  const a = all[n];
  assert.ok(a['native, minified (lightningcss)'].raw < a['sass, compressed'].raw, 'minified nested CSS should be smaller than minified flattened CSS');
  assert.ok(a['native, minified (lightningcss)'].gzip < a['sass, compressed'].gzip, 'nested CSS should also win after gzip');
  assert.ok(a['native, minified (lightningcss)'].br < a['sass, compressed'].br, 'nested CSS should also win after brotli');
  assert.ok(a['sass, expanded'].med > a['lightningcss, nesting lowered'].med, 'lightningcss should compile faster than sass');
}
const big = all[sizes[sizes.length - 1]];
const sassMs = big['sass, expanded'].med;
console.log('At ' + sizes[sizes.length - 1] + ' components: lightningcss compiles ' + (sassMs / big['lightningcss, nesting lowered'].med).toFixed(1) + 'x faster than sass; postcss-nesting takes ' + (big['postcss-nesting'].med / sassMs).toFixed(2) + 'x as long as sass.');
const pct = (a, b) => ((1 - a / b) * 100).toFixed(0) + '%';
const nat = big['native, minified (lightningcss)'];
const cmp = big['sass, compressed'];
console.log('Minified with nesting kept vs Sass compressed: ' + pct(nat.raw, cmp.raw) + ' smaller raw, ' + pct(nat.gzip, cmp.gzip) + ' smaller gzip, ' + pct(nat.br, cmp.br) + ' smaller brotli.');

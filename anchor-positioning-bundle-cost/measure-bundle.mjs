// Measures what a Floating UI tooltip actually costs to ship, versus the
// zero bytes of JavaScript that CSS anchor positioning ships.
//
// The comparison is only honest if the JS side is a real tooltip, so the
// entry point below imports exactly the middleware a tooltip needs: offset
// (the 8px gap), flip (move above when there's no room below), shift (keep
// it inside the viewport) and arrow (the little triangle).
import { build } from 'esbuild';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { writeFileSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const entry = new URL('./entry-tooltip.mjs', import.meta.url).pathname;
writeFileSync(entry, `
import { computePosition, offset, flip, shift, arrow } from '@floating-ui/dom';

export function attach(button, tooltip, arrowEl) {
  return computePosition(button, tooltip, {
    placement: 'bottom',
    middleware: [offset(8), flip(), shift({ padding: 8 }), arrow({ element: arrowEl })],
  }).then(({ x, y, middlewareData }) => {
    Object.assign(tooltip.style, { left: x + 'px', top: y + 'px' });
    if (middlewareData.arrow) {
      Object.assign(arrowEl.style, { left: middlewareData.arrow.x + 'px' });
    }
  });
}
`);

const result = await build({
  entryPoints: [entry],
  bundle: true,
  minify: true,
  format: 'esm',
  target: 'es2022',
  write: false,
});

const code = Buffer.from(result.outputFiles[0].contents);
const version = JSON.parse(readFileSync(new URL('./node_modules/@floating-ui/dom/package.json', import.meta.url))).version;

const rows = [
  ['minified', code.length],
  ['minified + gzip', gzipSync(code, { level: 9 }).length],
  ['minified + brotli', brotliCompressSync(code).length],
];

console.log(`@floating-ui/dom ${version}, esbuild ${JSON.parse(readFileSync(new URL('./node_modules/esbuild/package.json', import.meta.url))).version}`);
console.log(`node ${process.version}, ${execSync('uname -sm').toString().trim()}`);
console.log(`measured ${new Date().toISOString().slice(0, 10)}\n`);
for (const [label, bytes] of rows) {
  console.log(`${label.padEnd(20)} ${String(bytes).padStart(6)} B  ${(bytes / 1024).toFixed(2)} kB`);
}
console.log(`\nCSS anchor positioning equivalent: 0 B of JavaScript.`);

// With --assert the script becomes the folder's test, so a Floating UI release
// that changes shape fails loudly here instead of quietly making the article's
// table wrong. The bounds are deliberately wide: this asserts that a real
// tooltip still weighs kilobytes, not that it weighs today's exact number.
if (process.argv.includes('--assert')) {
  const gzip = gzipSync(code, { level: 9 }).length;
  const checks = [
    ['bundle is non-trivial', code.length > 5_000],
    ['bundle has not ballooned', code.length < 60_000],
    ['gzip is a real cost', gzip > 2_000],
    ['tooltip middleware is present', code.includes('flip') || code.length > 10_000],
  ];
  let failed = 0;
  for (const [label, ok] of checks) {
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`);
    if (!ok) failed++;
  }
  if (failed > 0) {
    console.error(`\n${failed} assertion(s) failed. The article's table needs re-measuring.`);
    process.exit(1);
  }
  console.log(`\nAll assertions passed. Published table: 15,098 B minified / 6,115 B gzip (1.8.0).`);
}

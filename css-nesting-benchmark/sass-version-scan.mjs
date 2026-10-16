// Which Sass releases hoist a declaration written after a nested rule, and which keep source
// order like the browser does? Installs each release into a temp directory (needs network)
// and compiles `.box { color: red; & { color: green; } color: blue; }`.
//
//   node sass-version-scan.mjs
//
// Not part of `npm test`, because it downloads fifteen packages.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const versions = ['1.69.5', '1.77.6', '1.79.6', '1.89.0', '1.90.0', '1.91.0', '1.92.0', '1.92.1', '1.93.3', '1.96.0', '1.99.0', '1.101.7', '1.103.1', '1.105.0', '1.105.2'];
const SRC = '.box { color: red; & { color: green; } color: blue; }';
const dir = mkdtempSync(join(tmpdir(), 'sass-scan-'));
const rows = [];
for (const v of versions) {
  const prefix = join(dir, v);
  execFileSync('npm', ['install', '--silent', '--no-audit', '--no-fund', '--prefix', prefix, 'sass@' + v], { stdio: 'ignore' });
  const sass = createRequire(join(prefix, 'x.js'))('sass');
  const css = sass.compileString(SRC, { logger: { warn() {}, debug() {} } }).css.replace(/\s+/g, ' ').trim();
  const hoists = css.startsWith('.box { color: red; color: blue; }');
  rows.push({ v, hoists, css });
  console.log(v.padEnd(8) + (hoists ? 'hoists   ' : 'in order ') + css);
}
rmSync(dir, { recursive: true, force: true });

const firstInOrder = rows.findIndex((r) => !r.hoists);
assert.ok(firstInOrder > 0, 'expected old releases to hoist');
assert.ok(rows.slice(firstInOrder).every((r) => !r.hoists), 'once a release keeps source order, every later one should too');
console.log('\nFirst release that keeps source order among those tried: ' + rows[firstInOrder].v + ' (last one that hoists: ' + rows[firstInOrder - 1].v + ')');

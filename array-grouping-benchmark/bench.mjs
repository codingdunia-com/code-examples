// Object.groupBy and Map.groupBy against the alternatives, on the same data.
//
//   node --expose-gc bench.mjs            full run: semantics, timing, retained heap
//   node --expose-gc bench.mjs --quick    smaller sizes, fewer rounds
//
// Timing: for each size the implementations run in interleaved rounds (A B C D A B
// C D ...) so a load spike hits all of them instead of whichever was running. Each
// figure is the median of the rounds; the min is printed next to it so you can see
// how noisy the machine was.
//
// Memory: each implementation runs in its own child process so one cannot inherit
// the other's heap. Figure = heapUsed after gc with the result still alive, minus
// heapUsed after gc before the call, i.e. what the grouped result retains.
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import _ from 'lodash';

const quick = process.argv.includes('--quick');

const impls = {
  'Object.groupBy': (a, f) => Object.groupBy(a, f),
  'Map.groupBy': (a, f) => Map.groupBy(a, f),
  'reduce, {} + if': (a, f) => a.reduce((acc, x, i) => {
    const k = f(x, i);
    if (!acc[k]) { acc[k] = []; }
    acc[k].push(x);
    return acc;
  }, {}),
  'reduce, null-proto + ??=': (a, f) => a.reduce((acc, x, i) => {
    (acc[f(x, i)] ??= []).push(x);
    return acc;
  }, Object.create(null)),
  'reduce, Map': (a, f) => a.reduce((acc, x, i) => {
    const k = f(x, i);
    const g = acc.get(k);
    if (g) { g.push(x); } else { acc.set(k, [x]); }
    return acc;
  }, new Map()),
  'for loop, null-proto': (a, f) => {
    const out = Object.create(null);
    for (let i = 0; i < a.length; i++) {
      const k = f(a[i], i);
      const g = out[k];
      if (g) { g.push(a[i]); } else { out[k] = [a[i]]; }
    }
    return out;
  },
  'for loop, Map': (a, f) => {
    const out = new Map();
    for (let i = 0; i < a.length; i++) {
      const k = f(a[i], i);
      const g = out.get(k);
      if (g) { g.push(a[i]); } else { out.set(k, [a[i]]); }
    }
    return out;
  },
  'lodash groupBy': (a, f) => _.groupBy(a, f),
};

const makeData = (n, groups) =>
  Array.from({ length: n }, (_, i) => ({ id: i, category: 'cat-' + ((i * 7919) % groups), price: i % 997 }));

const keyFn = (r) => r.category;

// Normalise any result to { key: length } so implementations can be compared.
const shape = (res) => {
  const entries = res instanceof Map ? [...res.entries()] : Object.entries(res);
  return Object.fromEntries(entries.map(([k, v]) => [k, v.length]));
};

// ---- child mode: retained heap of one implementation ------------------------------
if (process.argv[2] === '--mem') {
  const [, , , name, nStr, gStr] = process.argv;
  const data = makeData(Number(nStr), Number(gStr));
  global.gc();
  global.gc();
  const before = process.memoryUsage().heapUsed;
  const result = impls[name](data, keyFn);
  global.gc();
  global.gc();
  const after = process.memoryUsage().heapUsed;
  process.stdout.write(JSON.stringify({ retained: after - before, keep: Object.keys(result).length >= 0 }));
  process.exit(0);
}

// ---- child mode: time every implementation on one (N, keys) cell ---------------------
// Each cell gets a fresh process. Run in one long process, a cell inherits whatever
// V8 learned about the earlier ones (hidden-class transitions, inline-cache state), and
// in a first version of this file one cell showed reduce({}) 8-12x slower than the rest,
// which turned out to be caused by the harness itself (see the README).
if (process.argv[2] === '--cell') {
  const [, , , nStr, gStr, roundsStr, pickStr] = process.argv;
  const n = Number(nStr);
  const picks = pickStr === 'all' ? Object.keys(impls) : pickStr.split('|');
  const data = makeData(n, Number(gStr));
  const t0 = performance.now();
  impls['Object.groupBy'](data, keyFn);
  const reps = Math.max(1, Math.ceil(4 / Math.max(performance.now() - t0, 0.001)));
  for (const name of picks) { for (let i = 0; i < 3; i++) { impls[name](data, keyFn); } }
  const samples = Object.fromEntries(picks.map((nm) => [nm, []]));
  for (let r = 0; r < Number(roundsStr); r++) {
    for (let k = 0; k < picks.length; k++) {
      const name = picks[(k + r) % picks.length];
      const t = performance.now();
      for (let i = 0; i < reps; i++) { impls[name](data, keyFn); }
      samples[name].push((performance.now() - t) / reps);
    }
  }
  // Correctness check goes AFTER the timing on purpose. Building a plain object with the
  // same 1,000 keys first (which Object.fromEntries in shape() does) changes how a later
  // reduce({}) over those keys runs, by roughly 8x. See the README.
  const ref = shape(impls['for loop, Map'](data, keyFn));
  for (const name of picks) { assert.deepEqual(shape(impls[name](data, keyFn)), ref, name + ' disagrees with the reference grouping'); }
  const srt = (xs) => [...xs].sort((a, b) => a - b);
  process.stdout.write(JSON.stringify(Object.fromEntries(picks.map((nm) => [nm, { med: srt(samples[nm])[Math.floor(samples[nm].length / 2)], min: srt(samples[nm])[0] }]))));
  process.exit(0);
}

console.log('node ' + process.version + ' | v8 ' + process.versions.v8 + ' | ' + os.cpus()[0].model + ' (' + os.cpus().length + ' cores) | ' + new Date().toISOString().slice(0, 10));
console.log('load average at start: ' + os.loadavg().map((x) => x.toFixed(1)).join(' / ') + '\n');

await import('./semantics.mjs');
console.log('');

const names = Object.keys(impls);
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const fmt = (ms) => (ms >= 100 ? ms.toFixed(0) : ms >= 10 ? ms.toFixed(1) : ms >= 1 ? ms.toFixed(2) : ms.toFixed(3));

const sizes = quick ? [1_000, 100_000] : [1_000, 10_000, 100_000, 1_000_000];
const shapes = [
  { label: 'few big groups (10 keys)', groups: () => 10 },
  { label: 'many small groups (N/10 keys)', groups: (n) => n / 10 },
];

const runCell = (n, groups, rounds, picks) => {
  const out = spawnSync(process.execPath, ['--expose-gc', new URL(import.meta.url).pathname, '--cell', String(n), String(groups), String(rounds), picks], { encoding: 'utf8' });
  if (out.status !== 0) { throw new Error(out.stderr); }
  return JSON.parse(out.stdout);
};

const timing = {};
for (const sh of shapes) {
  console.log('## ' + sh.label + ' - median ms per call (min in brackets)');
  console.log(['N', ...names].join(' | '));
  for (const n of sizes) {
    const g = sh.groups(n);
    const rounds = quick ? 5 : n >= 1_000_000 ? 9 : 15;
    timing[sh.label + '|' + n] = runCell(n, g, rounds, 'all');
    console.log([n.toLocaleString('en-US'), ...names.map((nm) => fmt(timing[sh.label + '|' + n][nm].med) + ' (' + fmt(timing[sh.label + '|' + n][nm].min) + ')')].join(' | '));
  }
  console.log('');
}

// ratio view: how much slower than the plain for loop writing into a null-prototype object
console.log('## ratio against "for loop, null-proto" (median / median; above 1 = slower)');
console.log(['case', ...names].join(' | '));
for (const key of Object.keys(timing)) {
  const base = timing[key]['for loop, null-proto'].med;
  console.log([key, ...names.map((nm) => (timing[key][nm].med / base).toFixed(2) + 'x')].join(' | '));
}
console.log('');

// ---- cardinality sweep: where does the classic reduce({}) pattern fall off a cliff? ----
{
  const n = 100_000;
  const picks = ['Object.groupBy', 'reduce, {} + if', 'reduce, null-proto + ??=', 'for loop, null-proto', 'lodash groupBy'];
  const ks = quick ? [10, 1_000, 10_000] : [10, 100, 300, 1_000, 3_000, 10_000, 30_000];
  console.log('## number of distinct keys, N=' + n.toLocaleString('en-US') + ' - median ms per call (min in brackets)');
  console.log(['keys', ...picks].join(' | '));
  const sweepTiming = {};
  for (const k of ks) {
    const res = runCell(n, k, quick ? 5 : 15, picks.join('|'));
    sweepTiming[k] = res;
    console.log([k.toLocaleString('en-US'), ...picks.map((nm) => fmt(sweepTiming[k][nm].med) + ' (' + fmt(sweepTiming[k][nm].min) + ')')].join(' | '));
  }
  console.log('');
}

if (typeof global.gc === 'function') {
  const n = quick ? 100_000 : 1_000_000;
  for (const sh of shapes) {
    const g = sh.groups(n);
    console.log('## retained heap of the result, N=' + n.toLocaleString('en-US') + ', ' + sh.label + ' (MB, child process each)');
    for (const name of names) {
      const out = spawnSync(process.execPath, ['--expose-gc', new URL(import.meta.url).pathname, '--mem', name, String(n), String(g)], { encoding: 'utf8' });
      if (out.status !== 0) { throw new Error(out.stderr); }
      console.log('  ' + name.padEnd(26) + (JSON.parse(out.stdout).retained / 1048576).toFixed(2));
    }
    console.log('');
  }
} else {
  console.log('(run with --expose-gc to include the retained-heap section)');
}

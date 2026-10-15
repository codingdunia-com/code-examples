#!/usr/bin/env node
// Time the same generated suite under Vitest 4.1.11 and Vitest 5.0.3, on your machine.
//
//   npm run bench                    # 7 rounds
//   node bench.mjs --rounds 3
//
// The suite is 240 tests that use vi.fn, vi.mock with a factory and fake timers. It is
// generated twice: 60 files with 4 tests each, and 10 files with 24 tests each. Each
// round times every runner once, interleaved, so background load hits both versions alike.
//
// "cold" deletes node_modules/.vite and .vitest first. "warm" runs right after a priming run.
// Numbers are wall clock for the whole process, Node startup included. Nothing is hard-coded.

import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { cpus, loadavg, totalmem } from 'node:os';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SIDES = ['v4', 'v5'];

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1 || process.argv[index + 1] === undefined) {
    return fallback;
  }
  return process.argv[index + 1];
}

const rounds = Number(arg('rounds', '7'));

function vitestBin(side) {
  return join(ROOT, side, 'node_modules', 'vitest', 'vitest.mjs');
}

function version(side) {
  return JSON.parse(readFileSync(join(ROOT, side, 'node_modules', 'vitest', 'package.json'), 'utf8')).version;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[middle];
  }
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

// 60 modules, 240 tests. perFile = 1 gives 60 test files, perFile = 6 gives 10.
function generate(dir, perFile) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, 'src'), { recursive: true });
  mkdirSync(join(dir, 'test'), { recursive: true });
  writeFileSync(join(dir, 'vitest.config.mjs'), "export default { test: { include: ['test/**/*.test.ts'] } }\n");
  writeFileSync(join(dir, 'src', 'clock.ts'), 'export const now = () => Date.now()\n');

  for (let i = 0; i < 60; i++) {
    writeFileSync(
      join(dir, 'src', `mod${i}.ts`),
      [
        `export const scale = (v: number) => v * ${i + 2}`,
        'export const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)',
        `export const later = (cb: (n: number) => void) => { setTimeout(() => cb(${i}), 1000) }`,
        '',
      ].join('\n'),
    );
  }

  for (let first = 0; first < 60; first += perFile) {
    let head = "import { afterEach, describe, expect, it, vi } from 'vitest'\nimport { now } from '../src/clock'\n";
    let body = '';
    for (let i = first; i < first + perFile; i++) {
      head += `import { scale as scale${i}, sum as sum${i}, later as later${i} } from '../src/mod${i}'\n`;
      body += `
describe('mod${i}', () => {
  afterEach(() => { vi.useRealTimers() })

  it('scales', () => { expect(scale${i}(3)).toBe(${3 * (i + 2)}) })
  it('sums', () => { expect(sum${i}([1, 2, 3])).toBe(6) })
  it('calls a mock', () => {
    const spy = vi.fn((n: number) => n + 1)
    expect([1, 2, 3].map(spy)).toEqual([2, 3, 4])
    expect(spy).toHaveBeenCalledTimes(3)
    expect(now()).toBe(7)
  })
  it('fires a fake timer', () => {
    vi.useFakeTimers()
    const cb = vi.fn()
    later${i}(cb)
    vi.advanceTimersByTime(1000)
    expect(cb).toHaveBeenCalledWith(${i})
  })
})
`;
    }
    head += "\nvi.mock('../src/clock', () => ({ now: vi.fn(() => 7) }))\n";
    writeFileSync(join(dir, 'test', `group${first}.test.ts`), head + body);
  }
}

const layouts = [
  { id: '60x4', perFile: 1, label: '60 files, default pool', flags: [] },
  { id: '10x24', perFile: 6, label: '10 files, default pool', flags: [] },
  { id: '60x4-vm', perFile: 1, label: '60 files, --pool=vmThreads', flags: ['--pool=vmThreads'] },
];

for (const side of SIDES) {
  if (!existsSync(vitestBin(side))) {
    console.error(`Missing ${side}/node_modules. Run "npm run setup" first.`);
    process.exit(1);
  }
}

const dirs = {};
for (const side of SIDES) {
  for (const layout of layouts) {
    const dir = join(ROOT, side, `bench-${layout.id}`);
    generate(dir, layout.perFile);
    dirs[`${side}:${layout.id}`] = dir;
  }
}

function timeOnce(side, layout, cold) {
  const dir = dirs[`${side}:${layout.id}`];
  if (cold) {
    rmSync(join(ROOT, side, 'node_modules', '.vite'), { recursive: true, force: true });
    rmSync(join(dir, '.vitest'), { recursive: true, force: true });
  }
  const started = process.hrtime.bigint();
  const result = spawnSync(process.execPath, [vitestBin(side), 'run', ...layout.flags], { cwd: dir, encoding: 'utf8' });
  const ms = Number(process.hrtime.bigint() - started) / 1e6;
  const out = `${result.stdout}${result.stderr}`;
  const tests = /Tests\s+(\d+) passed \((\d+)\)/.exec(out);
  if (result.status !== 0 || !tests || tests[1] !== '240') {
    console.error(`${side} ${layout.id} did not pass all 240 tests:\n${out.slice(-600)}`);
    process.exit(1);
  }
  return ms;
}

const samples = {};
for (const side of SIDES) {
  for (const layout of layouts) {
    samples[`${side}:${layout.id}:cold`] = [];
    samples[`${side}:${layout.id}:warm`] = [];
  }
}

// One untimed priming run per runner, then interleaved rounds.
for (const side of SIDES) {
  for (const layout of layouts) {
    timeOnce(side, layout, true);
  }
}
const loadBefore = loadavg()[0];
for (let round = 0; round < rounds; round++) {
  for (const layout of layouts) {
    for (const side of SIDES) {
      samples[`${side}:${layout.id}:cold`].push(timeOnce(side, layout, true));
      samples[`${side}:${layout.id}:warm`].push(timeOnce(side, layout, false));
    }
  }
}
const loadAfter = loadavg()[0];

const cpu = cpus();
console.log(`Node ${process.version}, ${cpu[0].model}, ${cpu.length} cores, ${(totalmem() / 1024 ** 3).toFixed(0)} GB, ${new Date().toISOString().slice(0, 10)}`);
console.log(`One-minute load average: ${loadBefore.toFixed(1)} before, ${loadAfter.toFixed(1)} after (${rounds} rounds)`);
console.log(`Vitest ${version('v4')} against ${version('v5')}, 240 tests, medians in seconds\n`);
console.log('| layout | start | Vitest 4 | Vitest 5 | v5 vs v4 |');
console.log('| --- | --- | ---: | ---: | ---: |');
for (const layout of layouts) {
  for (const state of ['cold', 'warm']) {
    const a = median(samples[`v4:${layout.id}:${state}`]) / 1000;
    const b = median(samples[`v5:${layout.id}:${state}`]) / 1000;
    const change = ((b - a) / a) * 100;
    console.log(`| ${layout.label} | ${state} | ${a.toFixed(2)} | ${b.toFixed(2)} | ${change >= 0 ? '+' : ''}${change.toFixed(0)}% |`);
  }
}

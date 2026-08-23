#!/usr/bin/env node
// Type-check the same generated project with TypeScript 6.0.3 and TypeScript 7.0.2
// and print the speedup, on your machine.
//
//   npm install
//   node bench.mjs                       # 100 / 400 / 1000 modules, 5 runs each
//   node bench.mjs --sizes 200 --runs 3
//
// Every number this prints comes from the run you just did. Nothing is hard-coded.

import { spawnSync } from 'node:child_process';
import { cpus, totalmem } from 'node:os';
import { existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

import { generateProject } from './generate.mjs';

const TSC_7 = 'node_modules/typescript/bin/tsc';
const TSC_6 = 'node_modules/typescript-6/bin/tsc';

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1 || process.argv[index + 1] === undefined) {
    return fallback;
  }
  return process.argv[index + 1];
}

const runs = Number(arg('runs', '5'));
const sizes = String(arg('sizes', '100,400,1000'))
  .split(',')
  .map((n) => Number(n.trim()))
  .filter((n) => Number.isFinite(n) && n > 0);

for (const bin of [TSC_6, TSC_7]) {
  if (!existsSync(bin)) {
    console.error(`Missing ${bin}. Run "npm install" first.`);
    process.exit(1);
  }
}

function version(bin) {
  const out = spawnSync(process.execPath, [bin, '--version'], { encoding: 'utf8' });
  return `${out.stdout}`.trim().replace('Version ', '');
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[middle];
  }
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function timeCheck(bin, projectDir) {
  const started = process.hrtime.bigint();
  const result = spawnSync(process.execPath, [bin, '-p', projectDir], { encoding: 'utf8' });
  const elapsed = Number(process.hrtime.bigint() - started) / 1e6;
  return { ms: elapsed, status: result.status ?? 0, output: `${result.stdout}${result.stderr}`.trim() };
}

const cpuModel = cpus()[0]?.model ?? 'unknown CPU';
console.log(`node    ${process.version}`);
console.log(`cpu     ${cpuModel} (${cpus().length} cores, ${Math.round(totalmem() / 1024 ** 3)} GB)`);
console.log(`tsc 6   ${version(TSC_6)}`);
console.log(`tsc 7   ${version(TSC_7)}`);
console.log(`date    ${new Date().toISOString().slice(0, 10)}`);
console.log(`runs    ${runs} per compiler per size, median reported\n`);

const rows = [];
let failed = false;

for (const size of sizes) {
  const projectDir = join(tmpdir(), `cd-ts7-bench-${size}`);
  generateProject(projectDir, size);

  const timings = { six: [], seven: [] };
  let errorsSix = null;
  let errorsSeven = null;

  // One untimed warm-up per compiler so the OS file cache is not part of the result.
  timeCheck(TSC_6, projectDir);
  timeCheck(TSC_7, projectDir);

  for (let i = 0; i < runs; i += 1) {
    const six = timeCheck(TSC_6, projectDir);
    const seven = timeCheck(TSC_7, projectDir);
    timings.six.push(six.ms);
    timings.seven.push(seven.ms);
    errorsSix = six.status;
    errorsSeven = seven.status;
    if (six.status !== 0 || seven.status !== 0) {
      console.error(`Generated project failed to type-check, which makes the timing meaningless.`);
      console.error(six.output || seven.output);
      failed = true;
    }
  }

  rmSync(projectDir, { recursive: true, force: true });

  const sixMedian = median(timings.six);
  const sevenMedian = median(timings.seven);
  rows.push({
    size,
    six: sixMedian,
    seven: sevenMedian,
    speedup: sixMedian / sevenMedian,
    raw: timings,
    clean: errorsSix === 0 && errorsSeven === 0,
  });
}

if (failed) {
  process.exit(1);
}

const pad = (value, width) => String(value).padStart(width);

console.log('| modules | TS 6 median | TS 7 median | speedup |');
console.log('| ------: | ----------: | ----------: | ------: |');
for (const row of rows) {
  console.log(
    `| ${pad(row.size, 7)} | ${pad(`${row.six.toFixed(0)} ms`, 11)} | ${pad(`${row.seven.toFixed(0)} ms`, 11)} | ${pad(`${row.speedup.toFixed(1)}x`, 7)} |`,
  );
}

console.log('\nraw run log, milliseconds per full check:');
for (const row of rows) {
  console.log(`  ${pad(row.size, 5)} ts6  ${row.raw.six.map((ms) => pad(ms.toFixed(0), 5)).join(' ')}`);
  console.log(`  ${pad(row.size, 5)} ts7  ${row.raw.seven.map((ms) => pad(ms.toFixed(0), 5)).join(' ')}`);
}

console.log('\nBoth compilers reported the same error count on every size:');
console.log(rows.every((row) => row.clean) ? '  yes, zero errors throughout' : '  no, see the output above');

#!/usr/bin/env node
// SWC against Babel, twice: raw transform of N generated TSX files, then a webpack 5
// production build with babel-loader and with swc-loader.
//
//   npm install
//   node bench.mjs                              # 400 files, 3 reps x 6 rounds, 3 builds per loader
//   node bench.mjs --files 800 --reps 5 --builds 5
//   node bench.mjs --npx                        # time webpack through "npx" like the article did
//   node bench.mjs --skip-webpack               # transform table only
//   node bench.mjs --json results.json          # also write the raw numbers
//
// Every number this prints comes from the run you just did. Nothing is hard-coded.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { cpus, platform, arch, release, totalmem } from 'node:os';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { generateProject } from './generate.mjs';

const here = dirname(fileURLToPath(import.meta.url));

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1 || process.argv[index + 1] === undefined || process.argv[index + 1].startsWith('--')) {
    return fallback;
  }
  return process.argv[index + 1];
}

function flag(name) {
  return process.argv.includes(`--${name}`);
}

const fileCount = Number(arg('files', '400'));
const reps = Number(arg('reps', '3'));
const rounds = Number(arg('rounds', '6'));
const builds = Number(arg('builds', '3'));
const useNpx = flag('npx');
const skipWebpack = flag('skip-webpack');
const jsonOut = arg('json', null);

if (rounds < 2) {
  console.error('--rounds must be at least 2: round 1 is the cold run, the rest are warm.');
  process.exit(1);
}

const required = [
  'node_modules/@swc/core',
  'node_modules/@babel/core',
  'node_modules/esbuild',
  'node_modules/webpack',
  'node_modules/babel-loader',
  'node_modules/swc-loader',
  'node_modules/webpack-cli',
];
for (const path of required) {
  if (!existsSync(join(here, path))) {
    console.error(`Missing ${path}. Run "npm install" first.`);
    process.exit(1);
  }
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[middle];
  }
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function installed(name) {
  return JSON.parse(readFileSync(join(here, 'node_modules', name, 'package.json'), 'utf8')).version;
}

const cpuModel = cpus()[0]?.model ?? 'unknown CPU';
console.log(`node      ${process.version}`);
console.log(`machine   ${cpuModel} (${cpus().length} cores, ${Math.round(totalmem() / 1024 ** 3)} GB), ${platform()} ${arch()} ${release()}`);
console.log(`date      ${new Date().toISOString().slice(0, 10)}`);
for (const name of [
  '@swc/core',
  '@babel/core',
  '@babel/preset-env',
  '@babel/preset-react',
  '@babel/preset-typescript',
  'esbuild',
  'webpack',
  'webpack-cli',
  'babel-loader',
  'swc-loader',
  'react',
  'react-dom',
]) {
  console.log(`${name.padEnd(25)} ${installed(name)}`);
}

const projectDir = join(here, '.generated', 'project');
generateProject(projectDir, fileCount);
let totalBytes = 0;
for (let i = 0; i < fileCount; i += 1) {
  totalBytes += statSync(join(projectDir, 'components', `C${i}.tsx`)).size;
}
console.log(`\nproject   ${fileCount} generated .tsx files, ${Math.round(totalBytes / fileCount)} bytes on average, in ${projectDir}`);
console.log(`plan      transform: ${reps} fresh processes x ${rounds} rounds (round 1 cold, the rest warm)`);
if (!skipWebpack) {
  console.log(`          webpack:   ${builds} production builds per loader, cache: false, wall clock${useNpx ? ' including npx startup' : ', node webpack-cli'}\n`);
}

// ---- Part 1: raw transform ---------------------------------------------------------

const tools = [
  { id: 'swc', label: `@swc/core ${installed('@swc/core')} (TSX, automatic runtime, es2022)` },
  { id: 'esbuild', label: `esbuild ${installed('esbuild')} transformSync, one call per file` },
  { id: 'babel-no-env', label: `Babel ${installed('@babel/core')}, React + TypeScript presets only` },
  { id: 'babel-env', label: `Babel ${installed('@babel/core')}, with preset-env (node 22 targets)` },
];

const transformResults = [];

for (const tool of tools) {
  const repRuns = [];
  for (let rep = 0; rep < reps; rep += 1) {
    const child = spawnSync(process.execPath, [join(here, 'transform-worker.mjs'), tool.id, projectDir, String(rounds)], {
      cwd: here,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    if (child.status !== 0) {
      console.error(`${tool.id} failed:\n${child.stderr}`);
      process.exit(1);
    }
    const parsed = JSON.parse(child.stdout.trim().split('\n').pop());
    if (parsed.files !== fileCount || !(parsed.outputBytes > 0)) {
      console.error(`${tool.id} transformed ${parsed.files} files and produced ${parsed.outputBytes} bytes, which makes the timing meaningless.`);
      process.exit(1);
    }
    repRuns.push(parsed);
  }

  const cold = repRuns.map((run) => run.timings[0]);
  const warmMedians = repRuns.map((run) => median(run.timings.slice(1)));
  transformResults.push({
    ...tool,
    cold,
    warmMedians,
    warmMedian: median(warmMedians),
    outputBytes: repRuns[0].outputBytes,
    raw: repRuns.map((run) => run.timings),
  });
}

const fmt = (ms) => (ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${ms.toFixed(0)} ms`);
const range = (values) => `${fmt(Math.min(...values))} to ${fmt(Math.max(...values))}`;

console.log(`## Raw transform of ${fileCount} files\n`);
console.log('| Transformer | Warm median (median of reps) | Warm median, range over reps | Cold first round, range | Output bytes |');
console.log('| --- | ---: | ---: | ---: | ---: |');
for (const row of transformResults) {
  console.log(`| ${row.label} | ${fmt(row.warmMedian)} | ${range(row.warmMedians)} | ${range(row.cold)} | ${row.outputBytes} |`);
}

const swcRow = transformResults.find((row) => row.id === 'swc');
console.log('\nSlowdown against @swc/core (warm median of reps):');
for (const row of transformResults) {
  if (row.id !== 'swc') {
    console.log(`  ${row.id.padEnd(19)} ${(row.warmMedian / swcRow.warmMedian).toFixed(1)}x`);
  }
}

console.log('\nraw rounds, milliseconds (one line per fresh process, round 1 first):');
for (const row of transformResults) {
  for (const timings of row.raw) {
    console.log(`  ${row.id.padEnd(19)} ${timings.map((ms) => ms.toFixed(0).padStart(5)).join(' ')}`);
  }
}

// ---- Part 2: webpack ---------------------------------------------------------------

const webpackResults = [];

if (!skipWebpack) {
  const cli = join(here, 'node_modules', 'webpack-cli', 'bin', 'cli.js');
  const config = join(here, 'webpack.config.mjs');

  for (const loaderName of ['babel', 'swc']) {
    const times = [];
    let bundleBytes = 0;
    for (let run = 0; run < builds; run += 1) {
      const outDir = join(here, '.generated', `out-${loaderName}`);
      rmSync(outDir, { recursive: true, force: true });
      const command = useNpx ? 'npx' : process.execPath;
      const commandArgs = useNpx ? ['--no-install', 'webpack', '--config', config] : [cli, '--config', config];
      const started = process.hrtime.bigint();
      const child = spawnSync(command, commandArgs, {
        cwd: here,
        encoding: 'utf8',
        env: { ...process.env, LOADER: loaderName, PROJECT_DIR: projectDir, OUT_DIR: outDir },
        maxBuffer: 64 * 1024 * 1024,
      });
      const elapsed = Number(process.hrtime.bigint() - started) / 1e6;
      const bundle = join(outDir, 'main.js');
      if (child.status !== 0 || !existsSync(bundle)) {
        console.error(`webpack with ${loaderName}-loader failed:\n${child.stdout}\n${child.stderr}`);
        process.exit(1);
      }
      bundleBytes = statSync(bundle).size;
      times.push(elapsed);
    }
    webpackResults.push({ loaderName, times, median: median(times), bundleBytes });
  }

  const babelRow = webpackResults.find((row) => row.loaderName === 'babel');
  const swcWebpack = webpackResults.find((row) => row.loaderName === 'swc');

  console.log(`\n## webpack ${installed('webpack')} production build of the same ${fileCount} files\n`);
  console.log('| Loader | Median | Min | Max | Bundle bytes | Every run |');
  console.log('| --- | ---: | ---: | ---: | ---: | --- |');
  for (const row of webpackResults) {
    const label = row.loaderName === 'babel' ? `babel-loader ${installed('babel-loader')} (React, TypeScript, preset-env to Chrome 120)` : `swc-loader ${installed('swc-loader')} (TSX, automatic runtime, es2022)`;
    console.log(
      `| ${label} | ${row.median.toFixed(0)} ms | ${Math.min(...row.times).toFixed(0)} ms | ${Math.max(...row.times).toFixed(0)} ms | ${row.bundleBytes} | ${row.times.map((ms) => ms.toFixed(0)).join(', ')} |`,
    );
  }
  console.log(`\nbuild speedup, babel-loader over swc-loader (median): ${(babelRow.median / swcWebpack.median).toFixed(2)}x`);
  console.log(`time saved by the swap (median): ${((babelRow.median - swcWebpack.median) / 1000).toFixed(2)} s`);
}

if (jsonOut) {
  writeFileSync(
    jsonOut,
    `${JSON.stringify(
      {
        node: process.version,
        cpu: cpuModel,
        cores: cpus().length,
        date: new Date().toISOString(),
        fileCount,
        reps,
        rounds,
        builds,
        transform: transformResults,
        webpack: webpackResults,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`\nraw numbers written to ${jsonOut}`);
}

rmSync(join(here, '.generated'), { recursive: true, force: true });

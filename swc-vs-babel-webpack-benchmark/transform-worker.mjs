// One transformer, every file, N rounds, one process. Prints a JSON line with the
// per-round timings. bench.mjs spawns this once per tool per repetition, so each
// repetition starts a fresh process and round 1 is a genuine cold run.
//
//   node transform-worker.mjs <tool> <dir> <rounds>
//   tools: swc | esbuild | babel-no-env | babel-env
//
// Files are read into memory before the first round, so disk reads are not part of
// any number. Each round transforms every file once, in a plain for loop, using the
// synchronous API of each tool.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const [tool, dir, roundsArg] = process.argv.slice(2);
const rounds = Number(roundsArg);
const componentsDir = join(dir, 'components');
const files = readdirSync(componentsDir)
  .filter((name) => name.endsWith('.tsx'))
  .sort()
  .map((name) => ({ path: join(componentsDir, name), code: readFileSync(join(componentsDir, name), 'utf8') }));

const require = createRequire(import.meta.url);

function makeRunner() {
  if (tool === 'swc') {
    const swc = require('@swc/core');
    return (file) =>
      swc.transformSync(file.code, {
        filename: file.path,
        swcrc: false,
        configFile: false,
        jsc: {
          parser: { syntax: 'typescript', tsx: true },
          transform: { react: { runtime: 'automatic' } },
          target: 'es2022',
        },
      }).code;
  }

  if (tool === 'esbuild') {
    const esbuild = require('esbuild');
    return (file) =>
      esbuild.transformSync(file.code, {
        loader: 'tsx',
        jsx: 'automatic',
        target: 'es2022',
        sourcefile: file.path,
      }).code;
  }

  if (tool === 'babel-no-env' || tool === 'babel-env') {
    const babel = require('@babel/core');
    const presets = [
      [require.resolve('@babel/preset-react'), { runtime: 'automatic' }],
      require.resolve('@babel/preset-typescript'),
    ];
    if (tool === 'babel-env') {
      presets.unshift([require.resolve('@babel/preset-env'), { targets: { node: '22' } }]);
    }
    return (file) =>
      babel.transformSync(file.code, {
        filename: file.path,
        babelrc: false,
        configFile: false,
        presets,
      }).code;
  }

  throw new Error(`unknown tool "${tool}"`);
}

const run = makeRunner();
const timings = [];
let outputBytes = 0;

for (let round = 0; round < rounds; round += 1) {
  let bytes = 0;
  const started = performance.now();
  for (const file of files) {
    bytes += run(file).length;
  }
  timings.push(performance.now() - started);
  outputBytes = bytes;
}

console.log(JSON.stringify({ tool, files: files.length, timings, outputBytes }));

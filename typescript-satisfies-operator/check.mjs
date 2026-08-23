#!/usr/bin/env node
// Compiles every file in src/ on its own and asserts the exact outcome the
// satisfies guide claims: which ones must compile, which must fail, and with
// which diagnostic.
//
//   npm install && npm test

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import process from 'node:process';

const TSC = 'node_modules/typescript/bin/tsc';

if (!existsSync(TSC)) {
  console.error(`Missing ${TSC}. Run "npm install" first.`);
  process.exit(1);
}

const FLAGS = [
  '--noEmit',
  '--ignoreConfig',
  '--strict',
  '--target',
  'es2022',
  '--module',
  'esnext',
  '--moduleResolution',
  'bundler',
];

function compile(file) {
  const result = spawnSync(process.execPath, [TSC, ...FLAGS, `src/${file}`], { encoding: 'utf8' });
  const output = `${result.stdout}${result.stderr}`.trim();
  return {
    status: result.status ?? 0,
    output,
    codes: [...new Set([...output.matchAll(/error (TS\d+)/g)].map((m) => m[1]))].sort(),
  };
}

const cases = [
  {
    file: 'annotation-widens.ts',
    expect: 'TS2345',
    why: 'an annotation validates the shape but widens method to the declared union',
  },
  {
    file: 'no-annotation.ts',
    expect: null,
    why: 'no annotation means no validation, so the "methdo" typo compiles clean',
  },
  {
    file: 'satisfies-preserves.ts',
    expect: null,
    why: 'satisfies validates and still leaves method as the literal GET',
  },
  {
    file: 'satisfies-catches-typo.ts',
    expect: 'TS2561',
    why: 'the typo Option B swallowed is caught at the declaration',
  },
  {
    file: 'as-const-satisfies.ts',
    expect: null,
    why: 'as const satisfies keeps colors and spacing as readonly literals',
  },
  {
    file: 'command-registry.ts',
    expect: null,
    why: 'keyof typeof over a satisfies-checked object gives build | deploy',
  },
  {
    file: 'command-registry-unknown-key.ts',
    expect: 'TS2322',
    why: 'a command name outside that union is rejected',
  },
];

console.log(`typescript ${spawnSync(process.execPath, [TSC, '--version'], { encoding: 'utf8' }).stdout.trim().replace('Version ', '')}, node ${process.version}, ${new Date().toISOString().slice(0, 10)}\n`);

let failures = 0;

for (const testCase of cases) {
  const result = compile(testCase.file);
  const ok =
    testCase.expect === null
      ? result.status === 0
      : result.status !== 0 && result.codes.includes(testCase.expect);
  if (!ok) {
    failures += 1;
  }
  const got = testCase.expect === null ? 'compiles clean' : `fails with ${testCase.expect}`;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${testCase.file} ${got}`);
  console.log(`      ${testCase.why}`);
  if (result.output !== '') {
    console.log(`      | ${result.output.split('\n')[0]}`);
  }
  console.log('');
}

if (failures > 0) {
  console.error(`${failures} case(s) did not behave as documented.`);
  process.exit(1);
}
console.log('Every claim in the guide holds on this compiler.');

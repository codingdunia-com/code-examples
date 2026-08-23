#!/usr/bin/env node
// Runs the same tsconfig through TypeScript 6.0.3 and TypeScript 7.0.2 and prints
// what each compiler says about the options TypeScript 7 removed.
//
//   npm install && npm test
//
// Exits non-zero if the compilers stop behaving the way the article describes.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import process from 'node:process';

const TSC_7 = 'node_modules/typescript/bin/tsc';
const TSC_6 = 'node_modules/typescript-6/bin/tsc';

for (const bin of [TSC_6, TSC_7]) {
  if (!existsSync(bin)) {
    console.error(`Missing ${bin}. Run "npm install" first.`);
    process.exit(1);
  }
}

function run(bin, args) {
  const result = spawnSync(process.execPath, [bin, ...args], { encoding: 'utf8' });
  const output = `${result.stdout}${result.stderr}`.trim();
  const codes = [...output.matchAll(/error (TS\d+)/g)].map((m) => m[1]);
  return { status: result.status ?? 0, output, codes: [...new Set(codes)].sort() };
}

function version(bin) {
  return run(bin, ['--version']).output.replace('Version ', '');
}

const cases = [
  {
    name: 'TS 6 on the legacy tsconfig',
    run: () => run(TSC_6, ['-p', 'legacy']),
    expect: (r) => r.status !== 0 && r.codes.includes('TS5107'),
    describe: 'reports TS5107 for every option that TS 7 removes, and fails the build',
  },
  {
    name: 'TS 6 with ignoreDeprecations 6.0',
    run: () => run(TSC_6, ['-p', 'legacy', '--ignoreDeprecations', '6.0']),
    expect: (r) => r.status === 0,
    describe: 'passes, which is the escape hatch that lets you stage the cleanup',
  },
  {
    name: 'TS 7 on the legacy tsconfig',
    run: () => run(TSC_7, ['-p', 'legacy']),
    expect: (r) => r.status !== 0 && r.codes.includes('TS5108'),
    describe: 'reports TS5108 "has been removed" and has no escape hatch',
  },
  {
    name: 'TS 7 on the fixed tsconfig',
    run: () => run(TSC_7, ['-p', 'fixed']),
    expect: (r) => r.status === 0,
    describe: 'passes on the config from the migration guide',
  },
];

console.log(`tsc 6: ${version(TSC_6)}    tsc 7: ${version(TSC_7)}    node ${process.version}`);
console.log(`date:  ${new Date().toISOString().slice(0, 10)}\n`);

let failures = 0;

for (const testCase of cases) {
  const result = testCase.run();
  const ok = testCase.expect(result);
  if (!ok) {
    failures += 1;
  }
  const codes = result.codes.length > 0 ? result.codes.join(', ') : 'none';
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${testCase.name}`);
  console.log(`      exit ${result.status}, diagnostics: ${codes}`);
  console.log(`      expected: ${testCase.describe}`);
  if (result.output !== '') {
    for (const line of result.output.split('\n')) {
      console.log(`        | ${line}`);
    }
  }
  console.log('');
}

if (failures > 0) {
  console.error(`${failures} case(s) did not behave as documented.`);
  process.exit(1);
}

console.log('All four cases behaved as the article describes.');

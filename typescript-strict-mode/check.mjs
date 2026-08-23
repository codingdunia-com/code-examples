#!/usr/bin/env node
// Every flag the strict-mode guide describes, as a pair of files: the one that
// compiles without strict and fails with it, and the fix that passes.
//
//   npm install && npm test
//
// The script asserts the exact diagnostic code, so it fails loudly if a compiler
// release changes what any of these flags reports.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import process from 'node:process';

const TSC = 'node_modules/typescript/bin/tsc';

if (!existsSync(TSC)) {
  console.error(`Missing ${TSC}. Run "npm install" first.`);
  process.exit(1);
}

const BASE = ['--noEmit', '--ignoreConfig', '--target', 'es2022', '--module', 'esnext', '--moduleResolution', 'bundler'];

function compile(file, flags) {
  const result = spawnSync(process.execPath, [TSC, ...BASE, ...flags, file], { encoding: 'utf8' });
  const output = `${result.stdout}${result.stderr}`.trim();
  return {
    status: result.status ?? 0,
    output,
    codes: [...new Set([...output.matchAll(/error (TS\d+)/g)].map((m) => m[1]))].sort(),
  };
}

const cases = [
  { flag: 'strictNullChecks', file: 'null-check', on: ['--strict'], code: 'TS18047' },
  { flag: 'noImplicitAny', file: 'implicit-any', on: ['--strict'], code: 'TS7006' },
  { flag: 'noUncheckedIndexedAccess', file: 'unchecked-index', on: ['--strict', '--noUncheckedIndexedAccess'], code: 'TS18048' },
  { flag: 'useUnknownInCatchVariables', file: 'unknown-catch', on: ['--strict'], code: 'TS18046' },
];

console.log(`typescript ${spawnSync(process.execPath, [TSC, '--version'], { encoding: 'utf8' }).stdout.trim().replace('Version ', '')}, node ${process.version}, ${new Date().toISOString().slice(0, 10)}\n`);

let failures = 0;

for (const testCase of cases) {
  const loose = compile(`before/${testCase.file}.ts`, ['--strict', 'false']);
  const strict = compile(`before/${testCase.file}.ts`, testCase.on);
  const fixed = compile(`after/${testCase.file}.ts`, testCase.on);

  const ok =
    loose.status === 0 &&
    strict.status !== 0 &&
    strict.codes.includes(testCase.code) &&
    fixed.status === 0;

  if (!ok) {
    failures += 1;
  }

  console.log(`${ok ? 'PASS' : 'FAIL'}  ${testCase.flag}`);
  console.log(`      before/${testCase.file}.ts without strict: ${loose.status === 0 ? 'compiles' : `unexpected ${loose.codes.join(', ')}`}`);
  console.log(`      before/${testCase.file}.ts with ${testCase.on.join(' ')}: ${strict.codes.join(', ') || 'no error, expected ' + testCase.code}`);
  console.log(`      after/${testCase.file}.ts with ${testCase.on.join(' ')}: ${fixed.status === 0 ? 'compiles' : fixed.output}`);
  console.log('');
}

const wholeProject = spawnSync(process.execPath, [TSC, '-p', '.'], { encoding: 'utf8' });
const projectOk = (wholeProject.status ?? 0) === 0;
if (!projectOk) {
  failures += 1;
}
console.log(`${projectOk ? 'PASS' : 'FAIL'}  the whole after/ folder checks clean under the strictest tsconfig`);
console.log(`      tsc -p . exit ${wholeProject.status}`);

console.log('');
if (failures > 0) {
  console.error(`${failures} case(s) did not behave as documented.`);
  process.exit(1);
}
console.log('Every flag in the guide behaves exactly as described.');

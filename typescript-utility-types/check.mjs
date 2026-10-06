#!/usr/bin/env node
// Two halves. First the whole src/ tree compiles and then actually runs, with
// assertions on what Partial, Required, Pick, Omit, Record, Exclude, Extract,
// Parameters, ReturnType, Awaited and Readonly produce at runtime. Then every file in must-fail/ is compiled on its own and
// has to fail with the diagnostic the guide says it should.
//
//   npm install && npm test

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import process from 'node:process';

const TSC = 'node_modules/typescript/bin/tsc';

if (!existsSync(TSC)) {
  console.error(`Missing ${TSC}. Run "npm install" first.`);
  process.exit(1);
}

function run(args) {
  const result = spawnSync(process.execPath, args, { encoding: 'utf8' });
  const output = `${result.stdout}${result.stderr}`.trim();
  return {
    status: result.status ?? 0,
    output,
    codes: [...new Set([...output.matchAll(/error (TS\d+)/g)].map((m) => m[1]))].sort(),
  };
}

console.log(`typescript ${run([TSC, '--version']).output.replace('Version ', '')}, node ${process.version}, ${new Date().toISOString().slice(0, 10)}\n`);

let failures = 0;

const build = run([TSC, '-p', '.']);
const buildOk = build.status === 0;
if (!buildOk) {
  failures += 1;
}
console.log(`${buildOk ? 'PASS' : 'FAIL'}  src/ compiles under strict TypeScript 7`);
if (!buildOk) {
  console.log(build.output);
}

if (buildOk) {
  const executed = run(['dist/main.js']);
  const runOk = executed.status === 0;
  if (!runOk) {
    failures += 1;
  }
  console.log(`${runOk ? 'PASS' : 'FAIL'}  the compiled output runs and its assertions hold`);
  console.log(executed.output);
}

console.log('');

const expected = {
  'record-missing-key.ts': { code: 'TS2741', why: 'Record forces a message for every member of HttpStatus' },
  'omit-leaks.ts': { code: 'TS2339', why: 'Omit removes the key rather than hiding it' },
  'exclude-null.ts': { code: 'TS2322', why: 'Exclude<MaybeString, null | undefined> is string and only string' },
  'pick-extra-key.ts': { code: 'TS2353', why: 'Pick narrows the surface, so stock is not on a ProductCard' },
  'awaited-promise.ts': { code: 'TS2339', why: 'ReturnType of an async function is the Promise, so .name is not there until Awaited unwraps it' },
  'readonly-assign.ts': { code: 'TS2540', why: 'Readonly<Config> rejects writes at compile time' },
};

const FLAGS = ['--noEmit', '--ignoreConfig', '--strict', '--target', 'es2022', '--module', 'esnext', '--moduleResolution', 'bundler'];

for (const file of readdirSync('must-fail').sort()) {
  const rule = expected[file];
  if (rule === undefined) {
    console.log(`FAIL  must-fail/${file} has no expectation recorded in check.mjs`);
    failures += 1;
    continue;
  }
  const result = run([TSC, ...FLAGS, `must-fail/${file}`]);
  const ok = result.status !== 0 && result.codes.includes(rule.code);
  if (!ok) {
    failures += 1;
  }
  console.log(`${ok ? 'PASS' : 'FAIL'}  must-fail/${file} fails with ${rule.code}`);
  console.log(`      ${rule.why}`);
  if (result.output !== '') {
    console.log(`      | ${result.output.split('\n')[0]}`);
  }
}

console.log('');
if (failures > 0) {
  console.error(`${failures} check(s) failed.`);
  process.exit(1);
}
console.log('Every utility type in the guide behaves as documented, at compile time and at runtime.');

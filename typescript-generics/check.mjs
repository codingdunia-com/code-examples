#!/usr/bin/env node
// Two halves, same shape as the other TypeScript folders here. First src/
// compiles under strict TypeScript 7 and then runs, asserting what each generic
// in the guide actually produces. Then every file in must-fail/ is compiled on
// its own and has to fail with the exact diagnostic the guide implies.
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
  console.log(`      | ${build.output.split('\n')[0]}`);
}

if (buildOk) {
  const exec = spawnSync(process.execPath, ['dist/main.js'], { encoding: 'utf8' });
  const runOk = (exec.status ?? 0) === 0;
  if (!runOk) {
    failures += 1;
  }
  console.log(`${runOk ? 'PASS' : 'FAIL'}  src/ runs and every generic assertion holds`);
  const line = `${exec.stdout}${exec.stderr}`.trim().split('\n')[0];
  if (line !== undefined && line !== '') {
    console.log(`      | ${line}`);
  }
}

console.log('');

const expected = {
  'constraint-missing.ts': { code: 'TS2339', why: 'without extends HasId the body cannot reach .id' },
  'constraint-violation.ts': { code: 'TS2322', why: 'a number does not satisfy HasId, so the call is rejected' },
  'mapped-readonly.ts': { code: 'TS2540', why: 'the mapped type really does add readonly to every key' },
  'no-infer-mismatch.ts': { code: 'TS2345', why: "NoInfer keeps 'green' from widening T, which is the whole point of it" },
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
console.log('Every generic in the guide behaves as documented, at compile time and at runtime.');

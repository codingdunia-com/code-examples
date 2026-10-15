#!/usr/bin/env node
// Run the same test files under Vitest 4.1.11 and Vitest 5.0.3 and assert what changed.
//
//   npm test            # installs both sides, then runs this file
//   node check.mjs      # if you have already run `npm run setup`
//
// Both sides use the same Vite (8.3.4), so a difference below is Vitest, not Vite.
// Nothing here is hard-coded output: every row comes from the run you just did, and the
// script exits 1 when a result no longer matches what the article says.

import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SIDES = ['v4', 'v5'];

function vitestBin(side) {
  return join(ROOT, side, 'node_modules', 'vitest', 'vitest.mjs');
}

for (const side of SIDES) {
  if (!existsSync(vitestBin(side))) {
    console.error(`Missing ${side}/node_modules. Run "npm run setup" first.`);
    process.exit(1);
  }
}

function version(side) {
  return JSON.parse(readFileSync(join(ROOT, side, 'node_modules', 'vitest', 'package.json'), 'utf8')).version;
}

function prepare(side) {
  const work = join(ROOT, side, 'work');
  rmSync(work, { recursive: true, force: true });
  mkdirSync(work, { recursive: true });
  cpSync(join(ROOT, 'fixtures', 'cases'), join(work, 'cases'), { recursive: true });
  cpSync(join(ROOT, 'fixtures', 'vitest.config.mjs'), join(work, 'vitest.config.mjs'));
  cpSync(join(ROOT, 'fixtures', 'parent-config'), join(work, 'parent-config'), { recursive: true });
  return work;
}

// Run one vitest process and return what the JSON reporter saw.
function run(side, cwd, args, outName) {
  const outFile = join(ROOT, side, 'work', `${outName}.json`);
  const result = spawnSync(
    process.execPath,
    [vitestBin(side), 'run', ...args, '--reporter=json', `--outputFile=${outFile}`],
    { cwd, encoding: 'utf8' },
  );
  const text = `${result.stdout}${result.stderr}`;
  let report = null;
  if (existsSync(outFile)) {
    report = JSON.parse(readFileSync(outFile, 'utf8'));
  }
  return {
    exit: result.status,
    passed: report ? report.numPassedTests : 0,
    failed: report ? report.numFailedTests : 0,
    pending: report ? report.numPendingTests : 0,
    // A file that failed to load has no tests at all, so count it as failed too.
    suitesFailed: report ? report.numFailedTestSuites : 0,
    text,
  };
}

const cases = [
  {
    id: 'clear-mocks',
    label: 'mock call counts across tests',
    args: ['cases/clear-mocks.test.ts'],
    expect: { v4: 'pass', v5: 'fail' },
  },
  {
    id: 'hoisted-in-describe',
    label: 'vi.mock inside describe',
    args: ['cases/hoisted-in-describe.test.ts'],
    expect: { v4: 'pass', v5: 'fail' },
    extra: (side, r) => {
      if (side === 'v4' && !/not at the top level/.test(r.text)) {
        return 'v4 should have printed a top-level warning';
      }
      return null;
    },
  },
  {
    id: 'sequential',
    label: 'describe.sequential',
    args: ['cases/sequential.test.ts'],
    expect: { v4: 'pass', v5: 'fail' },
  },
  {
    id: 'unawaited-resolves-passing',
    label: 'unawaited resolves, assertion true',
    args: ['cases/unawaited-resolves-passing.test.ts'],
    expect: { v4: 'pass', v5: 'fail' },
  },
  {
    id: 'unawaited-resolves-failing',
    label: 'unawaited resolves, assertion false',
    args: ['cases/unawaited-resolves-failing.test.ts'],
    expect: { v4: 'fail', v5: 'fail' },
  },
  {
    id: 'unawaited-file-snapshot',
    label: 'unawaited toMatchFileSnapshot',
    args: ['cases/unawaited-file-snapshot.test.ts'],
    expect: { v4: 'pass', v5: 'fail' },
  },
  {
    id: 'to-throw-empty-string',
    label: "toThrow('') on a throwing function",
    args: ['cases/to-throw-empty-string.test.ts'],
    expect: { v4: 'fail', v5: 'pass' },
  },
  {
    id: 'name-pattern-space',
    label: '-t "cart adds an item"',
    args: ['cases/names.test.ts', '-t', 'cart adds an item'],
    expect: { v4: 'ran 1', v5: 'ran 0' },
  },
  {
    id: 'name-pattern-arrow',
    label: '-t "cart > adds an item"',
    args: ['cases/names.test.ts', '-t', 'cart > adds an item'],
    expect: { v4: 'ran 0', v5: 'ran 1' },
  },
  {
    id: 'parent-config',
    label: 'globals from a parent directory config',
    cwd: (work) => join(work, 'parent-config', 'sub'),
    args: [],
    expect: { v4: 'pass', v5: 'fail' },
  },
];

function verdict(c, side, r) {
  const want = c.expect[side];
  if (want === 'ran 1' || want === 'ran 0') {
    const ran = r.passed + r.failed;
    return { ok: `ran ${ran}` === want, got: `ran ${ran}` };
  }
  const got = r.exit === 0 ? 'pass' : 'fail';
  return { ok: got === want, got };
}

const results = {};
for (const side of SIDES) {
  const work = prepare(side);
  results[side] = {};
  for (const c of cases) {
    const cwd = c.cwd ? c.cwd(work) : work;
    results[side][c.id] = run(side, cwd, c.args, c.id);
  }
}

let problems = 0;
console.log(`\nVitest ${version('v4')} against Vitest ${version('v5')}, same tests, default config, Node ${process.version}\n`);
console.log('| case | v4 | v5 | as documented |');
console.log('| --- | --- | --- | --- |');
for (const c of cases) {
  const v4 = verdict(c, 'v4', results.v4[c.id]);
  const v5 = verdict(c, 'v5', results.v5[c.id]);
  const notes = [c.extra?.('v4', results.v4[c.id]), c.extra?.('v5', results.v5[c.id])].filter(Boolean);
  const ok = v4.ok && v5.ok && notes.length === 0;
  if (!ok) {
    problems += 1;
  }
  console.log(`| ${c.label} | ${v4.got} | ${v5.got} | ${ok ? 'yes' : 'NO ' + notes.join('; ')} |`);
}

// The JSON reporter moved from stdout to a file.
const jsonFile = join(ROOT, 'v5', 'work', '.vitest', 'json', 'output.json');
const stdoutRun = {};
for (const side of SIDES) {
  const work = join(ROOT, side, 'work');
  const r = spawnSync(process.execPath, [vitestBin(side), 'run', 'cases/clear-mocks.test.ts', '--reporter=json'], {
    cwd: work,
    encoding: 'utf8',
  });
  stdoutRun[side] = r.stdout.trimStart().startsWith('{');
}
const v5File = existsSync(jsonFile);
console.log(`\nJSON reporter without --outputFile: v4 prints JSON to stdout = ${stdoutRun.v4}; v5 prints JSON to stdout = ${stdoutRun.v5}, writes .vitest/json/output.json = ${v5File}`);
if (!(stdoutRun.v4 === true && stdoutRun.v5 === false && v5File === true)) {
  problems += 1;
}

// Coverage provider and vitest must be the same version. This is the part of a
// Vitest 5 upgrade that package.json hides: "^4.1.0" next to "^5.0.0" installs happily.
function coverageRun(dirName) {
  const dir = join(ROOT, dirName);
  const work = join(dir, 'work-coverage');
  rmSync(work, { recursive: true, force: true });
  cpSync(join(ROOT, 'fixtures', 'coverage-run'), work, { recursive: true });
  const r = spawnSync(process.execPath, [join(dir, 'node_modules', 'vitest', 'vitest.mjs'), 'run', '--coverage'], {
    cwd: work,
    encoding: 'utf8',
  });
  return { exit: r.status, text: `${r.stdout}${r.stderr}` };
}

const matched = coverageRun('v5');
const mixed = coverageRun('v5-mixed');
const matchedClean = matched.exit === 0 && !/mixed versions/.test(matched.text) && !/Unhandled/.test(matched.text);
const mixedWarns = /Running mixed versions is not supported/.test(mixed.text);
const mixedBreaks = /Expected string coverage payload/.test(mixed.text);
console.log(`\nCoverage: vitest 5.0.3 + coverage-v8 5.0.3 clean = ${matchedClean}`);
console.log(`Coverage: vitest 5.0.3 + coverage-v8 4.1.11 warns about mixed versions = ${mixedWarns}, unhandled "Expected string coverage payload" error = ${mixedBreaks}, exit code ${mixed.exit}`);
if (!(matchedClean && mixedWarns && mixedBreaks)) {
  problems += 1;
}

if (problems > 0) {
  console.error(`\n${problems} result(s) did not match the article.`);
  process.exit(1);
}
console.log('\nAll results match the article.');

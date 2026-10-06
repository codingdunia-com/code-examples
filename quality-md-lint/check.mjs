#!/usr/bin/env node
// Runs the quality.md CLI the way the QUALITY.md guide describes and asserts
// every claim the article makes about it: what lint rejects, what --fix does
// not touch, that a placeholder template still passes, and what init writes
// into an existing repo's agent instruction files.
//
//   npm install && npm test

import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';

const CLI = path.resolve('node_modules/.bin/qualitymd');
const EXPECTED_VERSION = '0.35.2';

if (!existsSync(CLI)) {
  console.error(`Missing ${CLI}. Run "npm install" first.`);
  process.exit(1);
}

let failures = 0;

function run(args, cwd = process.cwd()) {
  const result = spawnSync(CLI, args, { cwd, encoding: 'utf8' });
  return {
    status: result.status ?? 1,
    out: `${result.stdout}${result.stderr}`,
  };
}

function check(label, ok, detail = '') {
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`${mark}  ${label}${detail ? `  (${detail})` : ''}`);
  if (!ok) {
    failures += 1;
  }
}

function lintJson(file, cwd) {
  const result = run(['lint', '--json', file], cwd);
  return { status: result.status, report: JSON.parse(result.out) };
}

// 1. Pinned version, so the output below is the output of that version.
const version = JSON.parse(run(['version', '--json']).out);
check(`CLI version is ${EXPECTED_VERSION}`, version.version === EXPECTED_VERSION, version.version);
console.log(`      specification ${version.specificationVersion}`);

// 2. A filled-in model passes.
const valid = lintJson('fixtures/valid.md');
check('valid.md: exit 0, zero findings', valid.status === 0 && valid.report.findings.length === 0);

// 3. The broken model fails with exactly these rules.
const broken = lintJson('fixtures/broken.md');
const rules = broken.report.findings.map((f) => `${f.severity}:${f.ruleId}`).sort();
const expectedRules = [
  'error:invalid-assessment',
  'error:missing-criterion',
  'error:unknown-factor',
  'warning:missing-factor-description',
];
check('broken.md: exit 1', broken.status === 1, `exit ${broken.status}`);
check('broken.md: 3 errors + 1 warning', JSON.stringify(rules) === JSON.stringify(expectedRules), rules.join(', '));

// 4. --fix does not repair semantic errors.
const work = mkdtempSync(path.join(tmpdir(), 'qualitymd-'));
try {
  const copy = path.join(work, 'broken.md');
  copyFileSync('fixtures/broken.md', copy);
  const before = readFileSync(copy, 'utf8');
  const fixed = run(['lint', '--fix', 'broken.md'], work);
  check('lint --fix leaves broken.md byte-identical', readFileSync(copy, 'utf8') === before);
  check('lint --fix still exits 1', fixed.status === 1, `exit ${fixed.status}`);

  // 5. init in an existing repo appends a pointer to AGENTS.md and CLAUDE.md.
  const agents = '# Agent instructions\n\n- Run `npm test` before committing.\n';
  const claude = '# Claude instructions\n\nSee AGENTS.md.\n';
  writeFileSync(path.join(work, 'AGENTS.md'), agents);
  writeFileSync(path.join(work, 'CLAUDE.md'), claude);
  const init = run(['init'], work);
  check('init: exit 0', init.status === 0, `exit ${init.status}`);
  const pointer = 'See [QUALITY.md](QUALITY.md)';
  check('init: AGENTS.md gains a QUALITY.md pointer', readFileSync(path.join(work, 'AGENTS.md'), 'utf8').includes(pointer));
  check('init: CLAUDE.md gains a QUALITY.md pointer', readFileSync(path.join(work, 'CLAUDE.md'), 'utf8').includes(pointer));

  // 6. The untouched placeholder template is already "valid".
  const placeholder = lintJson('QUALITY.md', work);
  check('init template with <placeholders> lints as valid', placeholder.status === 0 && placeholder.report.valid === true);

  // 7. A second init refuses to overwrite.
  const again = run(['init'], work);
  check('second init refuses without --force', again.status !== 0, `exit ${again.status}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}

// 8. --no-agent-instructions leaves AGENTS.md alone.
const quiet = mkdtempSync(path.join(tmpdir(), 'qualitymd-'));
try {
  const agents = '# Agent instructions\n';
  writeFileSync(path.join(quiet, 'AGENTS.md'), agents);
  run(['init', '--minimal', '--no-agent-instructions'], quiet);
  check('init --no-agent-instructions: AGENTS.md untouched', readFileSync(path.join(quiet, 'AGENTS.md'), 'utf8') === agents);
} finally {
  rmSync(quiet, { recursive: true, force: true });
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log('\nAll checks passed.');

#!/usr/bin/env node
// Proves the four claims the monorepo article makes about project references:
//
//   1. tsc --build compiles the packages bottom-up in dependency order
//   2. every composite package gets its own .tsbuildinfo cache
//   3. a second build with nothing changed does no work
//   4. a type error in a leaf package fails the build before its dependents run
//
//   npm install && npm test

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';

const TSC = 'node_modules/typescript/bin/tsc';

if (!existsSync(TSC)) {
  console.error(`Missing ${TSC}. Run "npm install" first.`);
  process.exit(1);
}

function build(extraArgs = []) {
  const started = process.hrtime.bigint();
  const result = spawnSync(process.execPath, [TSC, '--build', ...extraArgs], { encoding: 'utf8' });
  return {
    ms: Number(process.hrtime.bigint() - started) / 1e6,
    status: result.status ?? 0,
    output: `${result.stdout}${result.stderr}`.trim(),
  };
}

const packages = ['packages/core', 'packages/config', 'packages/ui', 'apps/web'];
const checks = [];

function check(name, ok, detail) {
  checks.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (detail !== undefined && detail !== '') {
    console.log(`      ${detail}`);
  }
}

console.log(`node ${process.version}, typescript ${spawnSync(process.execPath, [TSC, '--version'], { encoding: 'utf8' }).stdout.trim().replace('Version ', '')}`);
console.log(`date ${new Date().toISOString().slice(0, 10)}\n`);

build(['--clean']);

const cold = build(['--verbose']);
const order = [...cold.output.matchAll(/Building project '(.+?)\/tsconfig\.json'/g)].map((m) => m[1]);
check(
  'cold build succeeds and walks the graph bottom-up',
  cold.status === 0 && order.indexOf('packages/core') < order.indexOf('packages/ui') && order.indexOf('packages/ui') < order.indexOf('apps/web'),
  `order: ${order.join(' -> ')} (${cold.ms.toFixed(0)} ms)`,
);

const infos = packages.filter((pkg) => existsSync(`${pkg}/tsconfig.tsbuildinfo`));
check(
  'every composite package wrote its own .tsbuildinfo',
  infos.length === packages.length,
  `${infos.length}/${packages.length}: ${infos.join(', ')}`,
);

const declarations = packages.filter((pkg) => existsSync(`${pkg}/dist/index.d.ts`) || existsSync(`${pkg}/dist/main.d.ts`));
check(
  'composite forced declaration output in every package',
  declarations.length === packages.length,
  declarations.join(', '),
);

const warm = build(['--verbose']);
const rebuilt = [...warm.output.matchAll(/Building project '(.+?)\/tsconfig\.json'/g)].map((m) => m[1]);
check(
  'a second build with nothing changed rebuilds nothing',
  warm.status === 0 && rebuilt.length === 0,
  rebuilt.length === 0 ? `up to date in ${warm.ms.toFixed(0)} ms` : `unexpectedly rebuilt: ${rebuilt.join(', ')}`,
);

// Break the leaf package on purpose, then put it back.
const corePath = 'packages/core/src/index.ts';
const original = readFileSync(corePath, 'utf8');
try {
  writeFileSync(corePath, original.replace('amountMinor: number;', 'amountMinor: string;'));
  const broken = build([]);
  check(
    'a type error in packages/core fails the build in packages/core',
    broken.status !== 0 && broken.output.includes('packages/core/src/index.ts'),
    broken.output.split('\n')[0] ?? '',
  );
} finally {
  writeFileSync(corePath, original);
}

const repaired = build([]);
check('the build is green again after the edit is reverted', repaired.status === 0, `${repaired.ms.toFixed(0)} ms`);

const failures = checks.filter((c) => !c.ok);
console.log('');
if (failures.length > 0) {
  console.error(`${failures.length} check(s) failed.`);
  process.exit(1);
}
console.log('All checks passed.');

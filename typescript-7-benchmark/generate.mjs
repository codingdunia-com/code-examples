// Writes a synthetic but type-checker-heavy TypeScript project.
//
// Synthetic on purpose: a benchmark you can only reproduce by having our repo is not
// reproducible. Every module here imports from two earlier ones, so the checker walks
// a real dependency graph instead of N isolated files, and each one carries generics,
// a discriminated union and a mapped type, because plain interfaces make any compiler
// look fast.

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function generateProject(dir, moduleCount) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, 'src'), { recursive: true });

  writeFileSync(
    join(dir, 'tsconfig.json'),
    `${JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          module: 'esnext',
          moduleResolution: 'bundler',
          strict: true,
          skipLibCheck: true,
          noEmit: true,
        },
        include: ['src'],
      },
      null,
      2,
    )}\n`,
  );

  for (let i = 0; i < moduleCount; i += 1) {
    const imports = [];
    if (i >= 1) {
      imports.push(`import type { Entity${i - 1} } from './mod${i - 1}.js';`);
    }
    if (i >= 2) {
      imports.push(`import { transform${i - 2} } from './mod${i - 2}.js';`);
    }

    const parentField = i >= 1 ? `  parent: Entity${i - 1};\n` : '';
    const parentValue = i >= 1 ? '' : '';
    const chainCall = i >= 2 ? `  void transform${i - 2};\n` : '';

    const source = `${imports.join('\n')}${imports.length > 0 ? '\n\n' : ''}export interface Entity${i} {
  kind: 'entity${i}';
  id: string;
  weight: number;
  tags: readonly string[];
${parentField}}

export type Event${i} =
  | { type: 'created'; at: number; payload: Entity${i} }
  | { type: 'updated'; at: number; changes: Partial<Entity${i}> }
  | { type: 'deleted'; at: number; id: string };

export type Lens${i}<T> = {
  readonly [K in keyof T]-?: (value: T[K]) => T[K];
};

export type Deep${i}<T> = T extends object
  ? { [K in keyof T]: Deep${i}<T[K]> }
  : T;

export function transform${i}<T extends { id: string }>(items: readonly T[], lens: (item: T) => T): T[] {
  const seen = new Map<string, T>();
  for (const item of items) {
    seen.set(item.id, lens(item));
  }
  return [...seen.values()];
}

export function reduce${i}(events: readonly Event${i}[]): Record<string, number> {
  const totals: Record<string, number> = {};
${chainCall}  for (const event of events) {
    switch (event.type) {
      case 'created':
        totals[event.payload.id] = event.payload.weight;
        break;
      case 'updated':
        for (const key of Object.keys(event.changes)) {
          totals[key] = (totals[key] ?? 0) + 1;
        }
        break;
      case 'deleted':
        delete totals[event.id];
        break;
      default: {
        const never: never = event;
        throw new Error(String(never));
      }
    }
  }
  return totals;
}
${parentValue}`;

    writeFileSync(join(dir, 'src', `mod${i}.ts`), source);
  }
}

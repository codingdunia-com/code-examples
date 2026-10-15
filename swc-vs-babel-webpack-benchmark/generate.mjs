// Writes N small React + TypeScript components into <dir>/components, plus an entry
// file that imports all of them and exports them as an array.
//
// Every component has the same shape on purpose, and it is the boring middle of a
// real component library: a typed props interface, useState and useMemo, an async
// function, a mapped list with optional chaining, and an onClick handler. Each file
// comes out at roughly 950 bytes. Only the identifier suffix changes between files.

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function componentSource(i) {
  return `import { useMemo, useState } from "react";

export interface Item${i} {
  id: number;
  label: string;
  meta?: { score?: number };
}

export interface Props${i} {
  items: Item${i}[];
  onPick?: (item: Item${i}) => void;
}

async function load${i}(n: number): Promise<Item${i}[]> {
  const res = await fetch("/api/items?n=" + n);
  return (await res.json()) as Item${i}[];
}

export default function Component${i}({ items, onPick }: Props${i}) {
  const [picked, setPicked] = useState<number | null>(null);
  const [extra, setExtra] = useState<Item${i}[]>([]);
  const all = useMemo(() => [...items, ...extra], [items, extra]);

  return (
    <ul className="c${i}">
      {all.map((item) => (
        <li key={item.id} onClick={() => { setPicked(item.id); onPick?.(item); }}>
          {item.label} {item.meta?.score ?? 0}
        </li>
      ))}
      <button onClick={async () => setExtra(await load${i}(5))}>{picked ?? "none"}</button>
    </ul>
  );
}
`;
}

export function generateProject(dir, fileCount) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, 'components'), { recursive: true });

  const imports = [];
  const names = [];
  for (let i = 0; i < fileCount; i += 1) {
    writeFileSync(join(dir, 'components', `C${i}.tsx`), componentSource(i));
    imports.push(`import C${i} from "./components/C${i}.tsx";`);
    names.push(`C${i}`);
  }

  // The entry only imports the components and exports an array. That is what the
  // article's build did too, and it means the minifier has almost nothing to keep.
  writeFileSync(join(dir, 'index.js'), `${imports.join('\n')}\n\nexport default [${names.join(', ')}];\n`);
}

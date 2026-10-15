# 📦 A composite monorepo that builds with tsc --build

The four-package workspace from [TypeScript 7 Monorepo Migration](https://codingdunia.com/blog/typescript-7-monorepo-migration/),
small enough to read in a minute and real enough to build.

```bash
npm install
npm test
```

## 🗂️ Layout

```
tsconfig.base.json        composite: true, incremental: true, shared module settings
tsconfig.json             files: [], references every package, compiles nothing itself
packages/core             money arithmetic, depends on nothing
packages/config           app defaults, depends on nothing
packages/ui               depends on core and config
apps/web                  depends on all three
```

## ✅ What npm test proves

`verify.mjs` runs the build and asserts four things the article claims, rather than
asking you to take them on faith:

| Claim | How it is checked |
| --- | --- |
| build mode walks the graph bottom-up | parses `--verbose` output and asserts core comes before ui, ui before web |
| every composite package caches separately | asserts four `tsconfig.tsbuildinfo` files exist |
| `composite: true` forces declaration output | asserts a `.d.ts` in every `dist/` |
| a clean rebuild does no work | second `--build` must report zero projects rebuilt |

Then it breaks `packages/core` on purpose, asserts the build fails and that the error
points at `packages/core`, and puts the file back.

Measured here: cold build 70 ms, warm build 38 ms, four packages. Small workspace,
so read the ratio rather than the milliseconds.

## 💡 The two lines that cause most of the pain

`composite: true` in every package, and `"files": []` in the root config. Miss the
first and you get `TS6306: Referenced project may not disable emit`. Miss the second
and the root config tries to compile the whole workspace itself, which is the
behaviour project references exist to avoid.

Versions: Node 20.19.5, typescript 7.0.2. Verified 2026-08-23.

# SWC against Babel, raw and inside webpack, on your own machine

The benchmark behind the SWC vs Babel article on codingdunia.com (publishes 2026-10-24).

```bash
npm install
node bench.mjs
```

Needs Node 22 or newer. `npm test` runs a 40-file smoke version that only checks the
harness works; it prints numbers but asserts none of them.

Flags: `--files 400` project size, `--reps 3` fresh processes per transformer,
`--rounds 6` transform passes per process, `--builds 3` webpack builds per loader,
`--npx` time webpack through `npx --no-install webpack` like the article's run did,
`--skip-webpack` transform table only, `--json out.json` write the raw numbers.

## What it measures

**Part 1, raw transform.** `generate.mjs` writes 400 `.tsx` files of about 940 bytes each:
a typed props interface, `useState`, `useMemo`, an async function, a mapped list with
optional chaining and an `onClick` handler. For each transformer `bench.mjs` starts a
fresh Node process (`transform-worker.mjs`) that transforms all 400 files six times in a
row, synchronously, with the sources already read into memory. Round 1 is the cold run,
rounds 2 to 6 are warm and the warm figure is their median. That is repeated in
`--reps` fresh processes, and the table shows the median of those medians, plus the range
across processes so you can see how noisy your machine is.

| Row | Configuration |
| --- | --- |
| `@swc/core` | `transformSync`, TSX, automatic runtime, `target: es2022` |
| `esbuild` | `transformSync`, loader `tsx`, automatic JSX, `target: es2022`, one call per file |
| Babel without preset-env | `@babel/core` `transformSync`, `preset-react` (automatic) + `preset-typescript` |
| Babel with preset-env | the same plus `preset-env` with `targets: { node: "22" }` |

**Part 2, webpack 5 production build.** The same 400 files, an entry that only imports
them and exports an array, `mode: production`, `cache: false`, React external. Two
builds that differ only in the loader rule: `babel-loader` (preset-env to Chrome 120,
preset-react, preset-typescript) and `swc-loader` (TSX, automatic runtime, es2022). Each
build is a fresh `node webpack-cli` process timed by wall clock, so the number includes
Node and webpack startup, and the table lists every single run next to the median.

It fails instead of printing when a transformer produces no output, transforms a
different number of files than it was given, or a webpack build exits non-zero or writes
no bundle, so a "fast" figure cannot come from doing nothing.

## Versions

Pinned in `package.json` and `package-lock.json` to what the article used: `@swc/core`
1.16.18, `@babel/core` 8.0.7 with `preset-env` 8.0.7, `preset-react` 8.0.1 and
`preset-typescript` 8.0.7, `esbuild` 0.28.2, `webpack` 5.111.1, `babel-loader` 10.1.1,
`swc-loader` 0.2.7, `react` and `react-dom` 19.3.1. The article does not name a
`webpack-cli` version; this folder uses 7.2.3.

## What we measured

The article's own run was a 4-vCPU Intel Xeon at 2.8 GHz with 15 GB of RAM, Node 22.22.0,
a shared virtual machine, three repetitions. This folder was added afterwards and first
run on an Apple M1 (8 cores, 16 GB), Node 22.23.3 (22.22.0 was not installed, so the
nearest 22.x), 2026-10-15, 5 fresh processes per transformer and 9 webpack builds per
loader. The Mac is a shared workstation, load average 6 to 10 during the run, so treat
these as a loaded-laptop result, not a quiet-lab one.

Raw transform of 400 files:

| Transformer | M1 warm median | M1 cold first round | Xeon container, warm | Xeon container, cold |
| --- | ---: | ---: | ---: | ---: |
| @swc/core 1.16.18 | 18 ms | 20 to 30 ms | 70 to 78 ms | 76 to 90 ms |
| esbuild 0.28.2, one call per file | 136 ms | 170 to 722 ms | 564 to 683 ms | 616 to 822 ms |
| Babel 8.0.7, no preset-env | 262 ms | 433 to 487 ms | 1318 to 1358 ms | 2.0 to 2.3 s |
| Babel 8.0.7, preset-env (node 22) | 280 ms | 504 to 595 ms | 2458 to 2733 ms | 3.1 to 3.5 s |

Slowdown against SWC, warm: Babel without preset-env 14.2x here (15.8x in an earlier
identical run) against about 17x in the container; Babel with preset-env 15.2x here
(16.5x earlier) against 35x in the container; esbuild 7.3x here against about 8x.

webpack 5.111.1 production build of the same files:

| Loader | M1 median (min to max, 9 builds) | Xeon container, 3 builds |
| --- | ---: | ---: |
| babel-loader 10.1.1 | 1868 ms (1758 to 1998) | 5792 to 6512 ms |
| swc-loader 0.2.7 | 1166 ms (1073 to 1298) | 3143 to 3439 ms |
| ratio | 1.60x, 0.70 s saved | about 1.8x, about 3 s saved |

Two more M1 runs gave 1.59x (0.66 s saved) and, timing through `npx` like the article
did, 1.62x (0.76 s saved).

## What matched and what did not

- **The ordering and the build-level ratio matched.** SWC, then esbuild with per-file
  calls, then Babel. The webpack gap was 1.6x on the M1 against about 1.8x in the
  container, inside the noise of either machine. The raw transforms are roughly 4x to 5x
  faster in absolute terms on the M1 and the webpack builds about 3x, which is mostly the CPU.
- **The Babel preset-env cost did not reproduce.** In the container it doubled Babel's
  time (about 1.3 s to about 2.6 s). Here it added 7 percent, and the output was
  byte-for-byte the same size with and without it (349560 bytes), meaning
  `targets: { node: "22" }` had nothing left to transform. We do not know what the
  container run had configured differently, so the 35x figure rests on one machine and
  one unrecorded setting. The 14x to 17x figure for Babel without preset-env held on both.
- **Absolute time saved by swapping the loader did not carry over.** About 3 seconds in
  the container, about 0.7 seconds here. The ratio travels, the seconds do not.
- **Bundle sizes differ.** The article's near-empty bundles were 217 bytes (Babel) and
  33 bytes (SWC). This harness gets 73 and 69 bytes, because it keeps React external as
  `require()` calls and Babel emits `react/jsx-dev-runtime` while SWC emits
  `react/jsx-runtime`. Both are nearly empty, which is the point of the caveat in the
  article: the minifier has almost nothing to do, and the loaders still transform every
  file.

## Caveats

- Babel's `development` default follows `NODE_ENV`, which is unset here, so Babel emits
  `jsxDEV` calls with source locations while SWC emits plain `jsx`. That is slightly
  more output for Babel. With `NODE_ENV=production` Babel emits `react/jsx-runtime` too
  (checked on a 5-file project); the timings above were taken without it.
- `esbuild.transformSync` per file is the worst way to use esbuild. Its row is there
  because the article reported it, not because it is a fair esbuild benchmark.
- Synthetic files are not your code. Run it, then replace the generator with a copy of
  your own components if you want a number that applies to you.

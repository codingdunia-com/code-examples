# tsc 6 against tsc 7, on your own machine

The benchmark behind [TypeScript 7 Benchmarks: How Much Faster Is tsgo Really?](https://codingdunia.com/blog/tsgo-benchmarks-typescript-7-speed/).

```bash
npm install
node bench.mjs
```

It installs `typescript@6.0.3` and `typescript@7.0.2` side by side, generates a
TypeScript project, type-checks it with both compilers, and prints the table. Node
version, CPU model and date come from your machine, not from ours, because a compiler
benchmark without them is not reproducible by anyone.

Flags: `--sizes 200,800` picks the module counts, `--runs 3` picks how many timed
passes per compiler. Default is 100 / 400 / 1000 modules, 5 runs, median reported,
with one untimed warm-up per compiler so the OS file cache is not part of the result.

## What we measured

Node 20.19.5 on an Apple M1, 8 cores, 2026-08-23:

| modules | TS 6 median | TS 7 median | speedup |
| ------: | ----------: | ----------: | ------: |
|     100 |      483 ms |       74 ms |    6.5x |
|     400 |      810 ms |       99 ms |    8.1x |
|    1000 |     1261 ms |      169 ms |    7.5x |

Both compilers reported zero errors on every size, so both were demonstrably doing
the same work.

## Why this runs faster than the article's own numbers

The article measures three real repos and lands on 4.4x to 5.8x. This script lands
higher, and the difference is the point rather than a contradiction. The generated
project has no third-party dependencies, so there is no declaration-file mountain to
parse. In the article the slowest repo was the smallest one, because it imports
`googleapis` and drags a huge `.d.ts` graph into every check, and that is the part
the Go rewrite speeds up least.

So read this script as the upper end: what the compiler does when nothing but your
own code is in the way. Your repo sits somewhere below it.

## What the generated code contains

Each module imports a type and a function from two earlier modules, so the checker
walks a real dependency graph instead of a pile of isolated files. Every module
carries generics, a discriminated union with an exhaustiveness check, a mapped type
with a modifier, and a recursive conditional type. Plain interfaces make any compiler
look fast, which would make the comparison worthless.

Versions: Node 20.19.5, typescript 6.0.3, typescript 7.0.2. Verified 2026-08-23.

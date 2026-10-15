# Coding Dunia - Code Examples

Runnable code that accompanies articles on [codingdunia.com](https://codingdunia.com).
Every article there states the versions its samples were executed against. These
folders are how you check that claim instead of taking it on trust: clone one, run
`npm test`, and read what the compiler says on your machine.

Nothing here is a snippet dump. A folder exists only when it contains something that
runs or compiles, and most of them assert their own result, so a folder fails loudly
if a future release changes the answer.

## TypeScript 7

- [`typescript-7-deprecations/`](./typescript-7-deprecations/) - the same tsconfig pushed through `typescript@6.0.3` and `typescript@7.0.2`, printing what each compiler says about the options TS 7 removed. From [TypeScript 7 Migration Guide](https://codingdunia.com/blog/typescript-7-migration-guide/) and [TypeScript 6 vs TypeScript 7](https://codingdunia.com/blog/typescript-6-vs-7-differences/)
- [`typescript-7-benchmark/`](./typescript-7-benchmark/) - type-checks a generated project with both compilers and prints the speedup for your CPU. From [TypeScript 7 Benchmarks](https://codingdunia.com/blog/tsgo-benchmarks-typescript-7-speed/)
- [`typescript-7-monorepo/`](./typescript-7-monorepo/) - a four-package composite workspace that builds with `tsc --build`, with the build order, the per-package cache and the failure mode all asserted. From [TypeScript 7 Monorepo Migration](https://codingdunia.com/blog/typescript-7-monorepo-migration/)

## TypeScript language

- [`typescript-strict-mode/`](./typescript-strict-mode/) - each strict flag as a before/after pair, asserting the exact diagnostic code. From [The TypeScript Strict Mode Guide](https://codingdunia.com/blog/typescript-strict-mode-guide/)
- [`typescript-generics/`](./typescript-generics/) - every generic from the guide compiled under strict `typescript@7.0.2` and executed, plus four files that must fail to compile, each asserting its exact diagnostic code. From [TypeScript Generics: Practical Guide for React Developers](https://codingdunia.com/blog/typescript-generics-explained/)
- [`typescript-satisfies-operator/`](./typescript-satisfies-operator/) - the examples that compile and the ones that must not, including the widening case that trips most people up. From The satisfies Operator (publishes 2026-10-08)
- [`typescript-utility-types/`](./typescript-utility-types/) - `Partial`, `Required`, `Pick`, `Omit`, `Record`, `Exclude`, `Extract`, `Parameters`, `ReturnType`, `Awaited` and `Readonly`, compiled and then executed with runtime assertions. From [TypeScript Utility Types Explained](https://codingdunia.com/blog/typescript-utility-types-guide/)

## Tooling and JavaScript

- [`vite-6-environment-api/`](./vite-6-environment-api/) - multi-target Vite 6 config (client/SSR/edge) from [Vite 6 Environment API](https://codingdunia.com/blog/vite-6-environment-api-guide/)
- [`zod-form-validation/`](./zod-form-validation/) - schema-first form validation with Zod and React Hook Form from [Form Validation with Zod and TypeScript](https://codingdunia.com/blog/form-validation-zod-typescript/)
- [`cli-tool-nodejs-typescript/`](./cli-tool-nodejs-typescript/) - a Node.js CLI skeleton (arg parsing, exit codes, native TS execution) from Building a CLI Tool with Node.js and TypeScript (publishes 2026-09-27)
- [`quality-md-lint/`](./quality-md-lint/) - the `qualitymd` 0.35.2 CLI run against a valid and a broken model, asserting what `lint` rejects, what `--fix` leaves alone and what `init` writes into `AGENTS.md`. From [Adding QUALITY.md to an Existing Repo](https://codingdunia.com/blog/quality-md-existing-repo-guide/)
- [`vitest-4-to-5-upgrade/`](./vitest-4-to-5-upgrade/) - ten test files run under `vitest@4.1.11` and `vitest@5.0.3` on the same Vite, asserting which behaviors flip, plus a timed 240-test suite and the `@vitest/coverage-v8` version-mismatch failure. Needs Node 22.12+. From [Vitest 5 Migration Guide](https://codingdunia.com/blog/vitest-5-migration-guide/) (October 8 update)
- [`structured-clone-benchmark/`](./structured-clone-benchmark/) - the benchmark behind [Is structuredClone() Slower Than JSON.parse(JSON.stringify())?](https://codingdunia.com/blog/structured-clone-vs-json-parse-stringify/); run it and it prints the article's table for your machine
- [`iterator-helpers-benchmark/`](./iterator-helpers-benchmark/) - the benchmark behind [JavaScript Iterator Helpers](https://codingdunia.com/blog/javascript-iterator-helpers-guide/); needs Node 22+

- [`swc-vs-babel-webpack-benchmark/`](./swc-vs-babel-webpack-benchmark/) - 400 generated TSX files transformed by `@swc/core`, esbuild and Babel in fresh processes, then built by webpack 5 with `swc-loader` and `babel-loader`; prints medians, ranges and every run. Needs Node 22+. From the SWC vs Babel benchmark article (publishes 2026-10-24)

## CSS, measured rather than asserted

- [`scroll-driven-animation-cost/`](./scroll-driven-animation-cost/) - the same progress bar built twice, once with a `scroll` listener and once with `animation-timeline`, counting main-thread time in the handler. Runs in headless Chromium. From [Building Scroll-Driven Animations With Pure CSS](https://codingdunia.com/blog/scroll-driven-animations-css-guide/). Needs `npx playwright install chromium` once
- [`anchor-positioning-bundle-cost/`](./anchor-positioning-bundle-cost/) - weighs a real Floating UI tooltip (offset, flip, shift, arrow) so "removes a dependency" has a number attached. From [Positioning Tooltips With CSS Anchor Positioning](https://codingdunia.com/blog/css-anchor-positioning-tooltips-popovers/)

## Running everything

Each folder is independent. `npm install && npm test` inside one is the whole story;
the benchmark folders take longer than the rest because they are timing something.

Every folder was run this way before it landed here, on Node 20.19.5 and the compiler
version its README names.

## Reproducing the benchmarks

Five folders here measure something rather than demonstrate an API. Each one prints its
own Node version, CPU and date, so a result you get is comparable to the one we
published instead of being taken on trust. Your numbers will differ from ours, and on
the borderline rows they may well flip. That is worth knowing before you rewrite
anything on the strength of a benchmark, including ours.

## Corrections

Running the code is the point, so when a run disagrees with an article, the article
gets fixed and the correction is noted in the folder. Two so far, both from the
TypeScript 7 sweep on 2026-08-23:

- TypeScript 6 does not merely warn about the options TypeScript 7 removes. It is a
  hard error, `TS5107`, and the build fails unless you set `ignoreDeprecations: "6.0"`.
  See [`typescript-7-deprecations/`](./typescript-7-deprecations/).
- `satisfies` does not preserve a literal type when the satisfied property is typed
  `string`. The contextual type still widens it. You need a narrower target type or
  `as const satisfies`. See [`typescript-satisfies-operator/`](./typescript-satisfies-operator/).

## License

MIT - copy anything here into your own project.

---

## Where this comes from

This repository is a **mirror**. The source of truth is `blogs/coding-dunia/examples/`
in the blog's own repository, beside the articles the code belongs to.

Nothing is published here until it has actually run and passed there. That is a gate in
`publish-examples.ts`, not a flag someone can skip: a mirror that publishes code nobody
ran is worse than no mirror, because it turns a checkable claim back into a promise.

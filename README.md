# 🧪 Coding Dunia - Code Examples

Runnable code that accompanies articles on [codingdunia.com](https://codingdunia.com).
Every article there states the versions its samples were executed against. These
folders are how you check that claim instead of taking it on trust: clone one, run
`npm test`, and read what the compiler says on your machine.

Nothing here is a snippet dump. A folder exists only when it contains something that
runs or compiles, and most of them assert their own result, so a folder fails loudly
if a future release changes the answer.

## 🔷 TypeScript 7

- [`typescript-7-deprecations/`](./typescript-7-deprecations/) - the same tsconfig pushed through `typescript@6.0.3` and `typescript@7.0.2`, printing what each compiler says about the options TS 7 removed. From [TypeScript 7 Migration Guide](https://codingdunia.com/blog/typescript-7-migration-guide/) and [TypeScript 6 vs TypeScript 7](https://codingdunia.com/blog/typescript-6-vs-7-differences/)
- [`typescript-7-benchmark/`](./typescript-7-benchmark/) - type-checks a generated project with both compilers and prints the speedup for your CPU. From [TypeScript 7 Benchmarks](https://codingdunia.com/blog/tsgo-benchmarks-typescript-7-speed/)
- [`typescript-7-monorepo/`](./typescript-7-monorepo/) - a four-package composite workspace that builds with `tsc --build`, with the build order, the per-package cache and the failure mode all asserted. From [TypeScript 7 Monorepo Migration](https://codingdunia.com/blog/typescript-7-monorepo-migration/)

## 📘 TypeScript language

- [`typescript-strict-mode/`](./typescript-strict-mode/) - each strict flag as a before/after pair, asserting the exact diagnostic code. From [The TypeScript Strict Mode Guide](https://codingdunia.com/blog/typescript-strict-mode-guide/)
- [`typescript-generics/`](./typescript-generics/) - every generic from the guide compiled under strict `typescript@7.0.2` and executed, plus four files that must fail to compile, each asserting its exact diagnostic code. From [TypeScript Generics: Practical Guide for React Developers](https://codingdunia.com/blog/typescript-generics-explained/)
- [`typescript-satisfies-operator/`](./typescript-satisfies-operator/) - the examples that compile and the ones that must not, including the widening case that trips most people up. From [The TypeScript satisfies Operator: Config Without Loss](https://codingdunia.com/blog/typescript-satisfies-operator-guide/)
- [`typescript-utility-types/`](./typescript-utility-types/) - `Partial`, `Required`, `Pick`, `Omit`, `Record`, `Exclude`, `Extract`, `Parameters`, `ReturnType`, `Awaited` and `Readonly`, compiled and then executed with runtime assertions. From [TypeScript Utility Types Explained](https://codingdunia.com/blog/typescript-utility-types-guide/)

## 🛠️ Tooling and JavaScript

- [`vite-6-environment-api/`](./vite-6-environment-api/) - multi-target Vite 6 config (client/SSR/edge) from [Vite 6 Environment API](https://codingdunia.com/blog/vite-6-environment-api-guide/)
- [`zod-form-validation/`](./zod-form-validation/) - schema-first form validation with Zod and React Hook Form from [Form Validation with Zod and TypeScript](https://codingdunia.com/blog/form-validation-zod-typescript/)
- [`cli-tool-nodejs-typescript/`](./cli-tool-nodejs-typescript/) - a Node.js CLI skeleton (arg parsing, exit codes, native TS execution) from [Building a CLI Tool in Node.js With TypeScript in 2026](https://codingdunia.com/blog/building-cli-tool-nodejs-typescript/)
- [`quality-md-lint/`](./quality-md-lint/) - the `qualitymd` 0.35.2 CLI run against a valid and a broken model, asserting what `lint` rejects, what `--fix` leaves alone and what `init` writes into `AGENTS.md`. From [Adding QUALITY.md to an Existing Repo](https://codingdunia.com/blog/quality-md-existing-repo-guide/)
- [`vitest-4-to-5-upgrade/`](./vitest-4-to-5-upgrade/) - ten test files run under `vitest@4.1.11` and `vitest@5.0.3` on the same Vite, asserting which behaviors flip, plus a timed 240-test suite and the `@vitest/coverage-v8` version-mismatch failure. Needs Node 22.12+. From [Vitest 5 Migration Guide](https://codingdunia.com/blog/vitest-5-migration-guide/) (October 8 update)
- [`structured-clone-benchmark/`](./structured-clone-benchmark/) - the benchmark behind [Is structuredClone() Slower Than JSON.parse(JSON.stringify())?](https://codingdunia.com/blog/structured-clone-vs-json-parse-stringify/); run it and it prints the article's table for your machine
- [`iterator-helpers-benchmark/`](./iterator-helpers-benchmark/) - the benchmark behind [JavaScript Iterator Helpers](https://codingdunia.com/blog/javascript-iterator-helpers-guide/); needs Node 22+
- [`swc-vs-babel-webpack-benchmark/`](./swc-vs-babel-webpack-benchmark/) - 400 generated TSX files transformed by `@swc/core`, esbuild and Babel in fresh processes, then built by webpack 5 with `swc-loader` and `babel-loader`; prints medians, ranges and every run. Needs Node 22+. From the SWC vs Babel benchmark article
- [`array-grouping-benchmark/`](./array-grouping-benchmark/) - `Object.groupBy` and `Map.groupBy` against `reduce`, loops and lodash: time, retained heap and 19 asserted behaviour differences (a `reduce` into `{}` throws on a group key called `constructor`). Needs Node 22+. From [JavaScript Array Grouping: Object.groupBy Explained](https://codingdunia.com/blog/javascript-array-grouping-new-methods/)
- [`async-await-benchmark/`](./async-await-benchmark/) - 20 requests against a 25 ms local server in a loop, `Promise.all` and a worker pool, a burst of up to 5,000, the cost of one `await`, microtask tick counts, and which async error patterns exit Node with code 1. Needs Node 22+. From [JavaScript Async/Await: Errors, Parallel Calls, Loops](https://codingdunia.com/blog/javascript-async-await-guide/)
- [`react-memo-render-counts/`](./react-memo-render-counts/) - 25 components rendered in jsdom on `react@19.3.1`, counting how many of 1000 rows re-render for nine `memo`/`useCallback`/context patterns, then the same source through `babel-plugin-react-compiler@1.0.0`; also `useMemo` cost by list size, derived state in an effect, and StrictMode callback counts. Needs Node 22.22.2+. From [React Hooks Best Practices: Common Pitfalls to Avoid](https://codingdunia.com/blog/react-hooks-best-practices/)
- [`react-19-hooks-measured/`](./react-19-hooks-measured/) - `useActionState` queueing, `useOptimistic` render sequences, `use()` with a promise made in render, `ref` as a prop, `Activity` versus `display: none` and `useEffectEvent` on `react@19.3.1`, plus which of these APIs each of 18.3.1, 19.0, 19.1, 19.2 and 19.3.1 exports. Needs Node 22.22.2+. From [React 19: Complete Guide to New Features and Migration](https://codingdunia.com/blog/react-19-new-features/)

## 🎨 CSS, measured rather than asserted

- [`scroll-driven-animation-cost/`](./scroll-driven-animation-cost/) - the same progress bar built twice, once with a `scroll` listener and once with `animation-timeline`, counting main-thread time in the handler. Runs in headless Chromium. From [Building Scroll-Driven Animations With Pure CSS](https://codingdunia.com/blog/scroll-driven-animations-css-guide/). Needs `npx playwright install chromium` once
- [`anchor-positioning-bundle-cost/`](./anchor-positioning-bundle-cost/) - weighs a real Floating UI tooltip (offset, flip, shift, arrow) so "removes a dependency" has a number attached. From [Positioning Tooltips With CSS Anchor Positioning](https://codingdunia.com/blog/css-anchor-positioning-tooltips-popovers/)
- [`css-has-invalidation-cost/`](./css-has-invalidation-cost/) - counts how many elements Chromium restyles when one checkbox flips, for `:has()` looking at its own children, at the previous sibling and at every earlier sibling, against the JavaScript class that would do the same job. Runs in headless Chromium. From [CSS :has() Selector: Practical Styling Patterns for 2026](https://codingdunia.com/blog/css-has-selector-practical-patterns/). Needs `npx playwright install chromium` once
- [`css-container-query-cost/`](./css-container-query-cost/) - measures what `container-type: inline-size` does to a container's width in nine layout contexts (it collapses to 0px in four of them) and times a resize with media queries, one container per card and one container per grid. Runs in headless Chromium. From [CSS Container Queries: Build Truly Responsive Components](https://codingdunia.com/blog/css-container-queries/). Needs `npx playwright install chromium` once
- [`css-subgrid-row-alignment/`](./css-subgrid-row-alignment/) - the same twelve cards built with subgrid, a nested grid, a flex column and fixed min-heights, swept across 201 container widths and checked with `getBoundingClientRect` for aligned body and footer tops. Runs in headless Chromium. From [CSS Subgrid Explained: Aligning Nested Grid Layouts](https://codingdunia.com/blog/css-subgrid-guide/). Needs `npx playwright install chromium` once
- [`css-auto-fit-breakpoints/`](./css-auto-fit-breakpoints/) - finds the exact container width at which `repeat(auto-fit, minmax(280px, 1fr))` adds a column, for four gap sizes, plus lone-item widths for auto-fit vs auto-fill and the effect of a classic scrollbar. Runs in headless Chromium. From [Responsive CSS Grid Without Media Queries, Explained](https://codingdunia.com/blog/responsive-css-grid-auto-fit/). Needs `npx playwright install chromium` once
- [`css-nesting-benchmark/`](./css-nesting-benchmark/) - one stylesheet through Sass, lightningcss and postcss-nesting (compile time, gzip and brotli size), then the same CSS in headless Chromium: where native nesting resolves differently from Sass, and the nested `:hover` pattern that makes style recalculation quadratic. Needs `npx playwright install chromium` once. From [CSS Nesting vs Sass in 2026](https://codingdunia.com/blog/css-nesting-2026-native-vs-sass/)
- [`css-centering-cross-engine/`](./css-centering-cross-engine/) - 12 centering techniques against four box sizes in Chromium, Firefox and WebKit, counting how many pixels of an oversized box no scrolling can reach, with 85 assertions. From [How to Center a Div in CSS: Tested in 3 Browser Engines](https://codingdunia.com/blog/css-centering-guide/). Needs `npx playwright install chromium firefox webkit` once
- [`css-grid-flexbox-cross-engine/`](./css-grid-flexbox-cross-engine/) - flex and grid compared on a long word and an unsized image, on last-row behaviour across 121 container widths, and on layout cost for 500 to 8000 items, in three engines with 163 assertions. From [CSS Grid vs Flexbox: How to Choose, Tested in 3 Engines](https://codingdunia.com/blog/css-grid-vs-flexbox/). Needs `npx playwright install chromium firefox webkit` once

## ▶️ Running everything

Each folder is independent. `npm install && npm test` inside one is the whole story;
the benchmark folders take longer than the rest because they are timing something.

Every folder was run this way before it landed here, on Node 20.19.5 (the folders marked
Node 22+ on Node 22.23.3) and the compiler version its README names.

## 📊 Reproducing the benchmarks

Sixteen folders here measure something rather than demonstrate an API. Each one prints its
own Node version, CPU and date, so a result you get is comparable to the one we
published instead of being taken on trust. Your numbers will differ from ours, and on
the borderline rows they may well flip. That is worth knowing before you rewrite
anything on the strength of a benchmark, including ours.

## ✏️ Corrections

Running the code is the point, so when a run disagrees with an article, the article
gets fixed and the correction is noted in the folder. Two so far, both from the
TypeScript 7 sweep on 2026-08-23:

- TypeScript 6 does not merely warn about the options TypeScript 7 removes. It is a
  hard error, `TS5107`, and the build fails unless you set `ignoreDeprecations: "6.0"`.
  See [`typescript-7-deprecations/`](./typescript-7-deprecations/).
- `satisfies` does not preserve a literal type when the satisfied property is typed
  `string`. The contextual type still widens it. You need a narrower target type or
  `as const satisfies`. See [`typescript-satisfies-operator/`](./typescript-satisfies-operator/).

## 📄 License

MIT - copy anything here into your own project.

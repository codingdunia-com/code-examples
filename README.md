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
- [`typescript-satisfies-operator/`](./typescript-satisfies-operator/) - the examples that compile and the ones that must not, including the widening case that trips most people up. From [The satisfies Operator](https://codingdunia.com/blog/typescript-satisfies-operator-guide/)
- [`typescript-utility-types/`](./typescript-utility-types/) - `Partial`, `Required`, `Pick`, `Omit`, `Record`, `Exclude` and `Extract`, compiled and then executed with runtime assertions. From [TypeScript Utility Types Explained](https://codingdunia.com/blog/typescript-utility-types-guide/)

## Tooling and JavaScript

- [`vite-6-environment-api/`](./vite-6-environment-api/) - multi-target Vite 6 config (client/SSR/edge) from [Vite 6 Environment API](https://codingdunia.com/blog/vite-6-environment-api-guide/)
- [`zod-form-validation/`](./zod-form-validation/) - schema-first form validation with Zod and React Hook Form from [Form Validation with Zod and TypeScript](https://codingdunia.com/blog/form-validation-zod-typescript/)
- [`cli-tool-nodejs-typescript/`](./cli-tool-nodejs-typescript/) - a Node.js CLI skeleton (arg parsing, exit codes, native TS execution) from [Building a CLI Tool with Node.js and TypeScript](https://codingdunia.com/blog/building-cli-tool-nodejs-typescript/)
- [`structured-clone-benchmark/`](./structured-clone-benchmark/) - the benchmark behind [Is structuredClone() Slower Than JSON.parse(JSON.stringify())?](https://codingdunia.com/blog/structured-clone-vs-json-parse-stringify/); run it and it prints the article's table for your machine
- [`iterator-helpers-benchmark/`](./iterator-helpers-benchmark/) - the benchmark behind [JavaScript Iterator Helpers](https://codingdunia.com/blog/javascript-iterator-helpers-guide/); needs Node 22+

## Running everything

Each folder is independent. `npm install && npm test` inside one is the whole story;
the benchmark folders take longer than the rest because they are timing something.

Every folder was run this way before it landed here, on Node 20.19.5 and the compiler
version its README names.

## Reproducing the benchmarks

Three folders here time something rather than demonstrate an API. Each one prints its
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

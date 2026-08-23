# Coding Dunia — Code Examples

Runnable snippets that accompany articles on [codingdunia.com](https://codingdunia.com). Each folder mirrors a published guide so you can pull the exact code instead of copy-pasting from the page.

## Examples

- [`vite-6-environment-api/`](./vite-6-environment-api/) — multi-target Vite 6 config (client/SSR/edge) from [Vite 6 Environment API: A Guide to Multi-Target Builds](https://codingdunia.com/blog/vite-6-environment-api-guide/)
- [`zod-form-validation/`](./zod-form-validation/) — schema-first form validation with Zod + React Hook Form from [Form Validation with Zod and TypeScript](https://codingdunia.com/blog/form-validation-zod-typescript/)
- [`cli-tool-nodejs-typescript/`](./cli-tool-nodejs-typescript/) — a Node.js CLI skeleton (arg parsing, exit codes, native TS execution) from [Building a CLI Tool with Node.js and TypeScript](https://codingdunia.com/blog/building-cli-tool-nodejs-typescript/)
- [`structured-clone-benchmark/`](./structured-clone-benchmark/) — the benchmark behind [Is structuredClone() Slower Than JSON.parse(JSON.stringify())?](https://codingdunia.com/blog/structured-clone-vs-json-parse-stringify/); run it and it prints the article's table for your machine
- [`iterator-helpers-benchmark/`](./iterator-helpers-benchmark/) — the benchmark behind [JavaScript Iterator Helpers: A Practical Guide](https://codingdunia.com/blog/javascript-iterator-helpers-guide/); needs Node 22+

## Reproducing the benchmarks

Two folders here are benchmarks rather than sample code. They exist because an
article that quotes numbers should hand you the script that produced them. Each one
prints its own Node version, CPU and date, so a result you get is comparable to the
one we published instead of being taken on trust.

## License

MIT — copy anything here into your own project.

# 🧪 Vitest 4.1.11 against Vitest 5.0.3, same tests

The runnable half of the October 8 update to
[Vitest 5 Migration Guide: What Breaks and How to Fix](https://codingdunia.com/blog/vitest-5-migration-guide/).

```bash
npm test          # installs both sides, runs ten test files under each, asserts the result
npm run bench     # times a generated 240-test suite under each, prints the table
```

`v4/` and `v5/` are two separate installs on the same Vite (8.3.4), so a difference
is Vitest and nothing else. A third install, `v5-mixed/`, pairs Vitest 5.0.3 with
`@vitest/coverage-v8@4.1.11` to show what a forgotten caret range does.

Needs Node 22.12 or newer (Vitest 5 refuses Node 20). Installs use
`--legacy-peer-deps`: on npm 10.9.9 the Vitest 4.1.11 tree crashed Arborist with
`Cannot read properties of null (reading 'edgesOut')` without it, and `v5-mixed`
is a deliberately mismatched pair.

## ✅ What `npm test` asserts

| Case | Vitest 4.1.11 | Vitest 5.0.3 |
| --- | --- | --- |
| mock call counts across tests | pass | fail |
| `vi.mock` inside `describe` | pass, with a warning | fail |
| `describe.sequential` | pass | fail |
| unawaited `resolves`, assertion true | pass | fail |
| unawaited `resolves`, assertion false | fail | fail |
| unawaited `toMatchFileSnapshot` | pass | fail |
| `toThrow('')` on a throwing function | fail | pass |
| `-t "cart adds an item"` | runs 1 test | runs 0 tests |
| `-t "cart > adds an item"` | runs 0 tests | runs 1 test |
| `globals: true` from a parent-directory config | pass | fail |

It also checks that `--reporter=json` without `--outputFile` prints JSON to stdout on
4.1.11 but only writes `.vitest/json/output.json` on 5.0.3, and that the mixed
coverage pair warns and fails while the matched pair runs clean. The script exits 1 if
any row stops matching, so a future Vitest release that changes one of these behaviors
fails the check instead of quietly contradicting the article.

The fifth row is the one that corrected the article: Vitest 4.1.11 already fails an
unawaited assertion that is wrong. What it lets through is the unawaited assertion
that happens to be right.

## 📈 What `npm run bench` measures

Sixty modules and 240 tests that use `vi.fn`, `vi.mock` with a factory and fake
timers, laid out as 60 files of 4 tests and as 10 files of 24, plus the 60-file layout
under `--pool=vmThreads`. Every round times each runner once, interleaved, for the whole
process including Node startup. "Cold" deletes `node_modules/.vite` and `.vitest` first.
Medians of 7 rounds (`--rounds N` changes it). Node version, CPU and the one-minute load
average are printed with the table, because a benchmark without them can't be repeated.

Apple M1, 8 cores, 16 GB, Node 22.23.3, 2026-10-08, load average 7.3 rising to 9.5
(other jobs were running), medians in seconds:

| layout | start | Vitest 4.1.11 | Vitest 5.0.3 | change |
| --- | --- | ---: | ---: | ---: |
| 60 files, default pool | cold | 2.09 | 1.87 | -10% |
| 60 files, default pool | warm | 1.95 | 1.82 | -7% |
| 10 files, default pool | cold | 0.71 | 0.69 | -2% |
| 10 files, default pool | warm | 0.77 | 0.68 | -12% |
| 60 files, `--pool=vmThreads` | cold | 1.11 | 0.95 | -15% |
| 60 files, `--pool=vmThreads` | warm | 1.10 | 1.02 | -7% |

An earlier run at a load of 4 to 6 gave the same direction, every cell between -4% and
-10%. Trust the direction, not any single cell: the suite is tests that do almost
nothing, not a component suite with jsdom and real imports.

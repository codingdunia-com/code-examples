# 🗂️ Object.groupBy and Map.groupBy against the hand-written alternatives

The measurements behind [JavaScript Array Grouping: Object.groupBy Explained](https://codingdunia.com/blog/javascript-array-grouping-new-methods/).

```bash
npm install
npm test          # same as: node --expose-gc bench.mjs
```

**Needs Node 22+** (`Object.groupBy` is in Node 21 and later). `node --expose-gc bench.mjs --quick`
runs two sizes with fewer rounds if you only want to see that it works. A full run takes
about 40 seconds on an M1.

## 📏 What it checks and measures

**1. Semantics (`semantics.mjs`, 19 assertions).** Run first, and the script stops if any
fails. These are the claims the article makes about behaviour, not speed:

- the classic `reduce()` into `{}` **throws** when a group key is `toString`, `constructor`
  or `__proto__`; `Object.groupBy` treats all three as plain data
- `Object.groupBy` merges `1` and `"1"`, and collapses every object key into one group called
  `"[object Object]"`; `Map.groupBy` keeps them apart
- integer-like keys come back in ascending numeric order from `Object.groupBy`, not in
  first-seen order; `Map.groupBy` keeps first-seen order
- `groupBy` visits the holes of a sparse array, `reduce` skips them
- `groupBy` takes any iterable (Set, string, generator), `reduce` takes arrays
- `Map.groupBy` uses SameValueZero (`NaN` is one group, `0` and `-0` are one group)

**2. Time.** Eight implementations on the same data: `Object.groupBy`, `Map.groupBy`, `reduce`
into `{}` with an `if`, `reduce` into `Object.create(null)` with `??=`, `reduce` into a `Map`,
a `for` loop into a null-prototype object, a `for` loop into a `Map`, and lodash 4.18.1
`_.groupBy`. Sizes 1,000 to 1,000,000 items, two key shapes (10 keys, and N/10 keys), plus a
sweep of the number of distinct keys at N=100,000. Every figure is the median of 9 to 15
rounds in which the implementations run interleaved and the starting point rotates, so a load
spike hits all of them. The minimum is printed next to it so you can see how noisy your
machine was. Each (size, key-count) cell runs in its own Node process, and every
implementation must produce the same grouping before its time is accepted.

**3. Retained heap.** Each implementation in its own child process: `heapUsed` after two
`gc()` calls with the result still alive, minus `heapUsed` after two `gc()` calls before the
call. That is what the grouped result holds on to, not a peak.

## 📈 What we measured

Node 22.23.3 (V8 12.4.254.21), Apple M1 with 8 cores **shared with other jobs the whole time**
(load average 16 and 19 at the start of the two runs), 2026-10-16. Two complete,
independent runs. Median ms per call, run 1 / run 2:

| Implementation | 1,000,000 items, 10 keys | 100,000 items, 10,000 keys |
| --- | ---: | ---: |
| `for` loop into a null-prototype object | 15.6 / 20.4 | 2.20 / 2.61 |
| `reduce` into `Object.create(null)` with `??=` | 18.5 / 24.8 | 2.72 / 3.06 |
| lodash `_.groupBy` | 19.2 / 23.8 | 2.68 / 3.34 |
| `for` loop into a `Map` | 17.9 / 22.9 | 3.61 / 4.16 |
| `reduce` into `{}` with an `if` | 25.0 / 27.5 | 3.28 / 3.70 |
| `Map.groupBy` | 25.2 / 28.9 | 3.53 / 4.04 |
| `Object.groupBy` | 25.6 / 28.5 | 4.33 / 5.15 |

The native methods are **not** faster than the code they replace. `Object.groupBy` ran
1.4x to 2.6x slower than a plain loop in every cell of both runs, level with the classic
`reduce` into `{}` when there are few keys and 1.3x to 1.4x slower than it when there are
thousands. `Map.groupBy` matched a hand-written `Map` loop.

Retained heap of the result (deterministic, identical in both runs):

| Implementation | 1M items, 10 keys | 1M items, 100,000 keys |
| --- | ---: | ---: |
| `Object.groupBy` | 7.63 MB | 18.21 MB |
| `Map.groupBy` | 7.63 MB | 15.71 MB |
| `reduce` into `{}` | 8.74 MB | 17.37 MB |
| hand-written `Map` loop | 9.03 MB | 22.58 MB |
| `for` loop into a null-prototype object | 9.03 MB | 18.90 MB |

`Map.groupBy` holds 30% less than the `Map` you would build by hand when there are many small
groups, and `Object.groupBy` holds about 15% less than the loops when there are few big ones. I did not confirm
why; the likely reason is array capacity, since an array grown by `push()` keeps spare room
and the native method builds each group at its final length.

## 🪤 One trap in the harness itself

An earlier version validated every implementation's result with a helper that called
`Object.fromEntries`, before timing, in the same process. In that process the classic
`reduce` into `{}` ran **7x to 12x slower** over roughly 1,000 distinct keys, and so did
lodash (it builds a plain `{}` too). Run alone, with no validation first, the same code was
as fast as everything else. Whatever V8 caches about objects built with those keys, a
benchmark that "just checks the answer first" can change the thing it is timing. The
validation now runs after the timing, and every cell runs in a fresh process. I report it
here because it is the kind of number that would have made `Object.groupBy` look like a
miracle.

Your numbers will differ. The direction should not: a hand loop beats everything, the native
methods sit with `reduce`, and the memory difference holds. V8 is the only engine measured.

# Iterator helpers vs array methods

The benchmark behind [JavaScript Iterator Helpers: A Practical Guide](https://codingdunia.com/blog/javascript-iterator-helpers-guide/).

```bash
node bench.mjs
```

No dependencies. **Needs Node 22+** for iterator helpers. On an older Node the script
throws on `.filter()` over an iterator, which is itself a useful thing to find out.

## What it measures

One million plain objects, three workloads: stop after ten matches, take every match,
and reduce over the whole set. Each figure is a timed batch divided by its iteration
count, best of three batches. It also checks that both approaches return the same
result, so a "faster" number cannot come from doing less work.

Heap growth is measured under `--expose-gc`:

```bash
node --expose-gc bench.mjs
```

## What we measured

Node 22.11.0, V8 12.4, Apple M1, 2026-08-23:

| Workload | Array methods | Iterator helpers |
| --- | ---: | ---: |
| First 10 matches of 1,000,000 | 8.02 ms, +3.4 MB | **0.012 ms, +0.0 MB** |
| All 96,288 matches | **7.99 ms** | 15.64 ms |
| Sum over the whole million | **13.3 ms** | 29.5 ms |

Iterator helpers are not a faster `map` and `filter`. They are a lazier one. Stop
early and you save three orders of magnitude; consume the whole chain and you pay
about 2x for the protocol.

For reference the script also times a hand-written `for..of` with a `break`, which
comes in around 0.0007 ms and beats both.

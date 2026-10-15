# 📋 structuredClone() vs the JSON round trip

The benchmark behind [Is structuredClone() Slower Than JSON.parse(JSON.stringify())?](https://codingdunia.com/blog/structured-clone-vs-json-parse-stringify/).

Run it and you get the article's table printed to your terminal, generated on your
machine rather than copied from ours:

```bash
node bench.mjs
```

No dependencies. Node 17+ (that is when `structuredClone` became global).

## 📏 What it measures

Five payload shapes, from an 8-key config object up to a `Float64Array` of 100,000
items. For each one it warms up, then takes the median of a timed run, then takes the
median of five such runs. That double median matters: a single pass on a laptop picks
up whatever else the machine was doing.

The script prints its own Node version, CPU model and the date, because a clone
benchmark without those is not reproducible by anyone.

## 📈 What we measured

Node 20.19.5 on an Apple M1, 2026-08-23:

| Payload | JSON round trip | structuredClone() |
| --- | ---: | ---: |
| 8-key config object | 0.0012 ms | 0.0013 ms |
| Array of 10,000 records | 7.20 ms | 6.82 ms |
| Array of 10,000 strings, 200 chars each | 2.74 ms | 0.444 ms |
| Array of 100,000 numbers | 5.72 ms | 1.46 ms |
| `Float64Array` of 100,000 items | 7.90 ms | **0.035 ms** |

The last row is the whole point. JSON has to serialise a typed array as an object
with numeric keys; `structuredClone` copies the buffer.

Your numbers will differ, and the row for plain records may well flip: it sits close
enough to parity that the runtime decides it. That is worth knowing before you rewrite
anything on the strength of a benchmark, including this one.

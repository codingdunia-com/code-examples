# Render counts for memo, useCallback, useMemo and derived state

The measurement behind [React Hooks Best Practices: Common Pitfalls to Avoid](https://codingdunia.com/blog/react-hooks-best-practices/).

```bash
npm install
npm test
```

Needs Node 22.22.2+ (jsdom 30 requires it; tested on 22.23.3 and 24.21.0) and no browser: React runs in jsdom. `npm test` runs the
script twice, once with `NODE_ENV=production` (timings, because the development build is
slower and would distort every ratio) and once with `NODE_ENV=development` (StrictMode,
which only double-invokes things in development). It prints the React version, Node
version, CPU and the load average at the start of each phase, then asserts its own results.

Everything is pinned: `react` and `react-dom` 19.3.1, `babel-plugin-react-compiler` 1.0.0.

## What it measures

`components.jsx` holds every component. `run.mjs` compiles that one file twice with Babel,
once as written and once through `babel-plugin-react-compiler`, so the "compiled" rows run
the identical source.

1. A parent re-renders because of unrelated state; 1000 rows sit below it. For nine
   patterns it counts how many rows re-rendered and the median and minimum commit time
   of the update, with bare `<li>` rows and with rows that do about 4 microseconds of
   work each. Patterns: plain rows, `React.memo` with an inline handler, `memo` with
   `useCallback`, `useCallback` without `memo`, `memo` + `useCallback` + an inline
   `style={{}}`, the same with `useMemo` on the style, `memo` + JSX children, and a
   context provider whose value is an inline object versus a `useMemo`'d one.
2. `useMemo` around a string concatenation in 1000 cells, and around `filter` + `sort`
   with `localeCompare` for lists of 10, 100, 1000 and 5000 products.
3. Derived state computed in `useEffect` + `setState` versus in render versus
   `useMemo`: renders per change, DOM commits per change, and whether the first commit
   shows the new query next to the old result (20,000 items).
4. StrictMode (development build): how many times each hook callback runs on mount,
   on one update and on unmount, and what a fetch in an effect does with and without an
   abort cleanup.
5. The two claims about closures the article used to get wrong: what two `setCount`
   calls in one click do, and how often an eagerly evaluated `useState` argument runs.

## What we measured

Node 22.23.3, Apple M1, 2026-10-16. The machine was shared with other jobs (load
average 24-43 on 8 cores), so the absolute milliseconds below are inflated and noisy;
the counts are exact and the ratios were the same direction in all five full runs.

Rows re-rendered per parent update (1000 rows), and minimum update time with bare rows:

| Pattern | Rows re-rendered | Min ms (plain build) | Rows re-rendered, compiled |
| --- | ---: | ---: | ---: |
| Plain rows, inline handler | 1000 | 0.44-0.66 | 0 |
| `memo` rows, inline handler | 1000 | 0.50-0.76 | 0 |
| `useCallback`, rows not memoized | 1000 | 0.38-0.53 | 0 |
| `memo` + `useCallback` | 0 | 0.17-0.23 | 0 |
| `memo` + `useCallback` + inline `style={{}}` | 1000 | 0.56-0.85 | 0 |
| `memo` + `useCallback` + JSX children | 1000 | 0.64-0.92 | 0 |
| `memo` + context value `{}` inline | 1000 | 0.40-0.54 | 0 |
| `memo` + `useCallback` + `useMemo` style | 0 | 0.19-0.25 | 0 |

The compiled build took 0.01-0.02 ms (minimum) for every one of these updates.

Derived state, per query change: `useEffect` + `setState` = 2 renders, 2 commits, and the
first commit pairs the new query with the old count. Computed in render or in `useMemo` =
1 render, 1 commit.

`useMemo` around `filter` + `sort`, saved per render: about 0.01-0.02 ms at 100
products, 0.2-0.3 ms at 1000, 1.4-2.5 ms at 5000. Around a string concatenation it cost
11-21 percent more in five runs (about 30-80 ns per cell).

StrictMode on mount: the render function, the `useState` initializer and the `useMemo`
factory run twice; the effect sets up twice and cleans up once; a ref callback attaches
twice and cleans up once. On every update the render function runs twice and nothing else
repeats.

Your milliseconds will differ. The counts will not, and the direction of every ratio is
asserted where it is large enough to survive a noisy machine.

# Where an auto-fit grid really changes its column count

The measurement behind [Responsive CSS Grid Without Media Queries, Explained](https://codingdunia.com/blog/responsive-css-grid-auto-fit/).

Headless, with assertions on the result (Playwright 1.62.1; the first run needs the
browser binary):

```bash
npm install
npx playwright install chromium
npm test
```

## What it measures

Nothing in this folder is timed, so the result does not depend on how busy the machine
is, and repeated runs print identical output. Every number comes from
`getComputedStyle(grid).gridTemplateColumns` or `getBoundingClientRect()`.

1. **Breakpoints.** A `repeat(auto-fit, minmax(280px, 1fr))` grid of twelve items is laid
   out at every container width from 200px to 1600px, for gaps of 0, 16, 24 and 32px.
   The script records the width at which the column count changes and asserts it equals
   `n * 280 + (n - 1) * gap`.
2. **The sawtooth.** The width of one card on either side of each breakpoint, gap 24px.
3. **Lone items.** One, two, three and five items in a 600, 900 and 1200px container,
   `auto-fit` against `auto-fill`.
4. **Narrow containers.** A bare `minmax(280px, 1fr)` against
   `minmax(min(280px, 100%), 1fr)` in containers of 320, 280, 240 and 200px.
5. **Scrollbars.** The same grid in a page with 24px side padding, swept by viewport width
   (an iframe, whose width is its viewport) with no layout scrollbar and with a 15px
   one. Headless Chromium cannot draw a native classic scrollbar, so the second case is
   emulated with `::-webkit-scrollbar { width: 15px }`, which reserves the same space.

## What we measured

Headless Chromium 151.0.7922.34 on an Apple M1 (8 cores), Node 22.23.3, 2026-10-16.

Container width at which n columns start (all four gaps matched the formula):

| Gap | 2 | 3 | 4 | 5 |
| --- | ---: | ---: | ---: | ---: |
| 0px | 560 | 840 | 1120 | 1400 |
| 16px | 576 | 872 | 1168 | 1464 |
| 24px | 584 | 888 | 1192 | 1496 |
| 32px | 592 | 904 | 1216 | 1528 |

Width of one card either side of a breakpoint, gap 24px: 583px to 280px going to two
columns, 431.5px to 280px going to three, 381px to 280px going to four.

Lone card in a 1200px container: `auto-fit` 1200, 588, 384 and 282px for 1, 2, 3 and 5
items; `auto-fill` 282px every time. Both modes report four tracks; `auto-fit` keeps the
empty ones at 0px.

Viewport width at which n columns start, page padding 24px: 632, 936, 1240 and 1544px for
2 to 5 columns with no layout scrollbar; 647, 951, 1255 and 1559px with a 15px one.

A 240px container overflows by 40px with a bare `minmax(280px, 1fr)` and by 0 with
`min(280px, 100%)`; at 200px the figures are 80px and 0.

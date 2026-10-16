# ⚖️ Where grid and flexbox really differ

The measurement behind [CSS Grid vs Flexbox: How to Choose the Right Layout](https://codingdunia.com/blog/css-grid-vs-flexbox/).

Three groups of measurements in Chromium, Firefox and WebKit (Playwright 1.62.1), two
passes each in fresh browsers. Everything is read back from real layout, not derived
from the CSS.

```bash
npm install
npx playwright install chromium firefox webkit
npm test
```

Needs Node 22+. About a minute; the timing part is the slow one.

## 📏 What it measures

1. **Sizing blowout.** Three equal columns in a 600 px container, with a 634 px
   unbreakable word (or an unsized 1200x600 image) in the middle one. Seven layouts for
   the word and the image (`flex: 1`, `min-width: 0`, `overflow: hidden`, `flex: 1 1
   auto`, grid `1fr`, `minmax(0, 1fr)`, grid `1fr` with `overflow: hidden`), plus five
   text-only variants with `overflow-wrap`. Reported: the three widths and how far the
   container's `scrollWidth` exceeds 600 px.
2. **Wrapping rows.** Eight items at 700 px with a 16 px gap in four layouts: flex-wrap
   that grows, flex-wrap fixed at 200 px, grid `auto-fill`, grid `auto-fit`. Reported:
   columns, rows and every width on the last row. Then a sweep of 121 container widths
   (320 to 1280 px, step 8) comparing column counts and item widths.
3. **Layout cost.** 500, 2000 and 8000 items. The container's width is changed and
   `offsetHeight` read back to force a layout pass, 10 passes per sample, 9 samples per
   pass, median per pass. Five layouts including a plain block stack as a reference.

## 📈 What we measured

Chromium 151.0.7922.34, Firefox 153.0, WebKit 26.5, Apple M1, 2026-10-16. The machine
was shared with other jobs the whole time (load average 24 to 36 on 8 cores).

**Sizing.** The browsers agree to within about 2 px; the difference is font metrics (the word is 633.7 px in Chromium and WebKit, 635.8 px in Firefox).
Chromium's numbers, container 600 px:

| Layout, long word | left / middle / right px | container overflow px |
| --- | --- | ---: |
| `flex: 1` | 48 / 634 / 48 | 130 |
| grid `1fr 1fr 1fr` | 48 / 634 / 48 | 130 |
| `flex: 1` + `min-width: 0` | 200 / 200 / 200 | 234 |
| grid `minmax(0, 1fr)` | 200 / 200 / 200 | 234 |
| `flex: 1` + `overflow: hidden` | 200 / 200 / 200 | 0 |
| `flex: 1` + `overflow-wrap: break-word` | 48 / 634 / 48 | 130 |
| `flex: 1` + `overflow-wrap: anywhere` | 200 / 200 / 200 | 0 |

`flex: 1` and grid `1fr` blow out identically. The "fix" everyone quotes,
`min-width: 0` or `minmax(0, 1fr)`, equalises the columns and leaves the word sticking
out 234 px; for the 1200 px image it leaves 800 px sticking out. What actually removes
the overflow is `overflow: hidden` (clips it), `overflow-wrap: anywhere` (breaks the word,
and changes min-content so no `min-width: 0` is needed), or `max-width: 100%` on the
image. `overflow-wrap: break-word` does nothing here, because it does not change
min-content.

**Wrapping.** At 700 px the last row of two items is 342 + 342 px with
`flex: 1 1 200px`, 200 + 200 with `flex: 0 0 200px`, and 222.67 + 222.67 with grid
`auto-fill` and `auto-fit`. Across all 121 widths the column count is identical in every
layout and every engine, and so is the first-row item width. The two models agree
until the last row.

**Cost**, milliseconds per forced layout, mean of two passes:

| Engine | Items | flex-wrap | grid auto-fill | flex row | grid row |
| --- | ---: | ---: | ---: | ---: | ---: |
| Chromium | 8000 | 15.0 | 17.4 | 4.2 | 6.2 |
| Firefox | 8000 | 14.5 | 26.8 | 8.3 | 22.5 |
| WebKit | 8000 | 25.1 | 53.9 | 30.6 | 57.2 |

Over two complete runs of the script, grid `auto-fill` cost between 1.07x and 1.15x
flex-wrap in Chromium, 1.77x to 1.90x in Firefox and 2.15x to 2.32x in WebKit at 8000
items. Grid in one row cost 1.5x to 2.7x flex in one row, in all three engines. Absolute
milliseconds moved by up to about a third between runs because the CPU was shared;
the direction did not. At 500 items every layout costs about 4 ms or less in every engine.

## ⚠️ Limits

The cost test measures a layout pass on simple text items, not paint, not real
components, and not a page that has never been laid out. Firefox's readings come out on a
0.1 ms grid, coarser than the other two; the 10-pass loop keeps that below the signal. Absolute
timings depend on the machine: trust the ratios. Items here have no nested content, no
images and no `subgrid`. Left-to-right only.

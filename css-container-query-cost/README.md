# Container queries: what they do to the container, and what a resize costs

The measurement behind [CSS Container Queries: Build Truly Responsive Components](https://codingdunia.com/blog/css-container-queries/).

Headless, with assertions on the shape of the result (Playwright 1.62.1; the first run
needs the browser binary, and about half a minute of CPU):

```bash
npm install
npx playwright install chromium
npm test
```

## What it measures

**A. The collapse (deterministic).** `container-type: inline-size` applies inline-size
containment, so the element reports no intrinsic width. The script measures one
container, a heading plus a sentence, in nine layout contexts with and without it and
prints `getBoundingClientRect()` widths. Block children, `1fr` tracks and `flex: 1`
items keep their width. Auto-width flex items, inline-blocks, floats and absolutely
positioned boxes collapse to 0px. The assertions fail if that stops being true.

**B. The cost of a resize (relative).** A grid of 300, 1,000 and 3,000 cards inside an
iframe is resized between 1200px and 780px; the time to apply the width and force style
and layout is taken inside the page. Five variants, sampled interleaved so that a load
spike hits all of them: no query, a media query, one container per card, one container
per card with no `@container` rule, and a single container around the grid.

Before the timings count, the script checks that the media, per-card and single
variants render the same boxes at both widths. Timings are medians of 19 samples after
2 warm-ups. They move with machine load: read the ratios, not the milliseconds.

## What we measured

Headless Chromium 151.0.7922.34 on an Apple M1 (8 cores), Node 22.23.3, 2026-10-16. The
machine was shared with other jobs (load average above 25).

Widths, 1000px page:

| Where the container sits | Without | With `inline-size` |
| --- | ---: | ---: |
| Block child | 1000 | 1000 |
| Grid `1fr` | 1000 | 1000 |
| Flex item, `flex: 1` | 1000 | 1000 |
| Table cell | 214 | 214 |
| Grid `auto` track | 590 | 484 |
| Flex item, auto width | 214 | 0 |
| `inline-block` | 214 | 0 |
| `float` | 214 | 0 |
| `position: absolute` | 214 | 0 |

One resize pair in ms, run 1, ratio to the media-query version in brackets:

| Cards | none | media | per card | per card, no query | single container |
| --- | ---: | ---: | ---: | ---: | ---: |
| 300 | 4.2 | 17.9 | 20.0 (1.12) | 4.9 | 17.6 (0.98) |
| 1,000 | 13.7 | 61.4 | 63.1 (1.03) | 15.6 | 52.5 (0.86) |
| 3,000 | 46.7 | 170.8 | 188.0 (1.10) | 47.8 | 170.5 (1.00) |

Run 2: per card 1.12, 1.06, 0.98; single container 1.00, 1.10, 0.82. The sign of the
difference changes between runs, so this is a null result: no measurable penalty for
container queries either way. What held in both runs is that containment alone, with no
`@container` rule, costs 2% to 17% over none.

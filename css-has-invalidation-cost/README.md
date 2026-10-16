# :has() and what it makes the browser restyle

The measurement behind [CSS :has() Selector: Practical Styling Patterns for 2026](https://codingdunia.com/blog/css-has-selector-practical-patterns/).

Headless, with assertions on the shape of the result (Playwright 1.62.1; the first
run needs the browser binary, and about half a minute of CPU):

```bash
npm install
npx playwright install chromium
npm test
```

## What it measures

A list of 250 to 4,000 `<li class="card">` elements, each holding a checkbox. The
checkbox of the LAST card is flipped (the worst case for sibling selectors), and the
script forces style and layout. Two readings per toggle:

- **elements**: the `elementCount` Chromium reports on its `UpdateLayoutTree` trace
  event, which is how many elements the style engine recomputed. A count, so it does
  not move with machine load.
- **ms**: median wall time of nine toggles, taken inside the page. This does move with
  load. Read the ratios between rows, not the values.

Three selectors, each compared with the JavaScript that would do the same job (a plain
`.card.on` class on exactly the elements that change):

| Name | Selector | Meaning |
| --- | --- | --- |
| `self` | `.card:has(input:checked)` | the subject contains the checkbox |
| `plus` | `.card:has(+ .card input:checked)` | the card before the checked one |
| `tilde` | `.card:has(~ .card input:checked)` | every card before the checked one |

A last check toggles the first, middle and last card of a 4,000-card list to show that
the cost of `plus` follows the checkbox's position.

The changed property is `background-color` on purpose. An earlier version used `opacity`
and the class-loop control became quadratic as well, because elements below 1.0 opacity
get their own paint layer. Do not swap it back.

## What we measured

Headless Chromium 151.0.7922.34 on an Apple M1 (8 cores), Node 22.23.3, 2026-10-16.
The machine was shared with other jobs (load average 25 to 54).

Elements restyled per click, 250 cards and 4,000 cards:

| Selector | 250 | 4,000 | JS class doing the same job |
| --- | ---: | ---: | ---: |
| `self` | 2 | 2 | 1 |
| `plus` | 251 | 4,001 | 1 |
| `tilde` | 251 | 4,001 | 3,999 |

Median ms per click, run 1:

| Cards | `plus` | `tilde` | JS class loop (same elements) |
| --- | ---: | ---: | ---: |
| 250 | 0.3 | 0.5 | 0.3 |
| 500 | 0.6 | 1.3 | 0.6 |
| 1,000 | 1.1 | 6.3 | 1.2 |
| 2,000 | 2.5 | 26.3 | 2.5 |
| 4,000 | 5.4 | 100.9 | 5.4 |

A second run: `tilde` 82.6 ms at 4,000 cards, `plus` 5.1, class loop 4.9. `self` is
0.004 ms per click in both. Quadrupling the list made `tilde` 12 to 16 times slower
across three runs, and the class loop about 4.5 times slower.

Your absolute milliseconds will differ, and on a quiet machine they will be smaller.
The element counts should match exactly, and `tilde` should keep growing faster than
the list.

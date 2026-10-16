# Subgrid against the usual card-alignment tricks, measured

The measurement behind [CSS Subgrid Explained: Aligning Nested Grid Layouts](https://codingdunia.com/blog/css-subgrid-guide/).

Headless, with assertions on the shape of the result (Playwright 1.62.1; the first run
needs the browser binary):

```bash
npm install
npx playwright install chromium
npm test
```

## What it measures

The same twelve cards, built five ways: `subgrid` (the card spans three parent rows),
`subgridExplicit` (the same, with `auto 1fr auto` declared on the parent as the article's
code does), `nested` (the card is a grid with `auto 1fr auto` rows), `flex` (a column
with `margin-top: auto` on the footer) and `fixed` (the flex column plus a three-line
`min-height` on the title and a four-line one on the body).

Titles run from one word to fifteen and bodies from one to four sentences, on purpose,
so the rows disagree. For every visual row of cards the script asks
`getBoundingClientRect()` how far apart the body tops and the footer tops are, and keeps
the worst row. The container is swept from 300px to 1300px in 5px steps, 201 widths,
152 of them wide enough for two or more columns.

Nothing is timed. The result does not depend on machine load, and repeated runs print
identical output.

## What we measured

Headless Chromium 151.0.7922.34 on an Apple M1 (8 cores), Node 22.23.3, 2026-10-16.

Worst spread in px (body top / footer top) and total grid height:

| Container | subgrid | nested | flex | fixed |
| --- | --- | --- | --- | --- |
| 1240px, 4 columns | 0 / 0, 1008.6 | 78 / 0, 982.6 | 78 / 0, 982.6 | 26 / 0, 1086.6 |
| 940px, 3 columns | 0 / 0, 1273.3 | 52 / 0, 1221.3 | 52 / 0, 1221.3 | 0 / 0, 1377.3 |
| 620px, 2 columns | 0 / 0, 1668.4 | 52 / 0, 1642.4 | 52 / 0, 1642.4 | 0 / 0, 1876.5 |
| 300px, 1 column | 0 / 0, 2988.1 | 0 / 0, 2988.1 | 0 / 0, 2988.1 | 0 / 0, 3642.7 |

Across the 152 multi-column widths: subgrid aligned body tops and footer tops at all of
them, nested and flex at none (footers pinned, bodies not), and the fixed-height guess at
86 (57%). Subgrid made the grid 38px taller than nested on average, between 22px and
78px, because each row is as tall as its tallest title plus its tallest body. A subgrid
that does not set its own `row-gap` inherits the parent's: 24px from title to body here,
against 12px once the card sets it.

Content with equally long text in every card would show no difference between the
builds. That is a property of the test data, not of the layout methods.

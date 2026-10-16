# 🪆 Native CSS nesting against Sass, lightningcss and postcss-nesting

The measurements behind [CSS Nesting vs Sass in 2026](https://codingdunia.com/blog/css-nesting-2026-native-vs-sass/).

```bash
npm install
npx playwright install chromium     # once
npm test
```

`npm test` runs three scripts one after another (a few minutes in total on an M1): `compile-bench.mjs`
(compile time and shipped size), `chromium-behaviors.mjs` (does native nesting resolve the same
way Sass does) and `chromium-parse.mjs` (what the browser pays to parse and apply nested CSS).
Each takes `--quick` for a smaller, faster pass. Needs Node 22+. `sass-version-scan.mjs` is separate and
not part of `npm test`: it installs fifteen Sass releases into a temp directory and shows which ones
hoist a declaration written after a nested rule.

## 📏 What it measures

**`compile-bench.mjs`.** One generated stylesheet of N components, written in a syntax that is valid
both as native nesting and as SCSS (`generate.mjs`), pushed through: no step at all, lightningcss
minify with nesting kept, `sass.compileString` expanded and compressed, lightningcss with an old
target so nesting is lowered (plain and minified), and postcss-nesting. 100, 1,000 and 5,000
components; 7 rounds interleaved; median and min compile time, plus raw, gzip level 9 and brotli
quality 9 sizes. It asserts that every lowering route removed all `&` and produced the same
number of blocks (8 per component).

**`chromium-behaviors.mjs`.** Seven small stylesheets, each fed as **one unchanged text** to five
routes (native, Sass 1.105.2, Sass 1.91.0, lightningcss, postcss-nesting) and read back from headless
Chromium with `getComputedStyle`. Nothing is reasoned from the spec; the browser is the oracle.
Cases: `&__title` suffix, a selector list containing an ID, a declaration written after a nested
rule, a bare type selector, a bare class selector, `.dark &`, and a nested `@media`. It also probes
`@mixin`/`@apply` (not applied), `@function` (applied) and `@each` (ignored) and fails if a future
browser changes any of those, which is the cue to update the article.

**`chromium-parse.mjs`.** The same generated stylesheet as nested CSS, as Sass-flattened CSS and
as lightningcss-flattened CSS, in a fresh Chromium page each time: `replaceSync` time (parse),
then adopt the sheet and force style and layout (apply). A checksum of the computed styles must
match across variants. Part 2 isolates ten nesting patterns, nested against hand-flattened. Part 3
sweeps 250 to 4,000 components for the one expensive pattern.

## 📦 Versions

`sass` 1.105.2 (the pure-JS build, not `sass-embedded`), `sass-1-91` is an alias for `sass` 1.91.0,
`lightningcss` 1.33.0, `postcss` 8.5.30, `postcss-nesting` 14.0.3, `playwright` 1.62.1 which launched
Chromium 151.0.7922.34 (headless shell). Node 22.23.3.

## 📈 What we measured

Apple M1, 8 cores **shared with other jobs the whole time** (load average 19 to 35 when each run started), 2026-10-16.
Two complete, independent runs; run 1 / run 2.

Compile time, median ms:

| Components | Sass (expanded) | postcss-nesting | lightningcss (lowered) |
| --- | ---: | ---: | ---: |
| 100 | 30.8 / 20.1 | 34.3 / 23.2 | 1.44 / 1.19 |
| 1,000 | 217 / 156 | 246 / 195 | 12.5 / 10.2 |
| 5,000 | 1,014 / 1,019 | 1,453 / 1,544 | 60.0 / 61.8 |

Shipped size at 5,000 components (identical in both runs):

| Route | Raw | gzip | brotli |
| --- | ---: | ---: | ---: |
| Sass, compressed | 1,635 KB | 168.5 KB | 81.5 KB |
| lightningcss, lowered + minified | 1,499 KB | 165.0 KB | 75.6 KB |
| nesting kept, minified (lightningcss) | 1,311 KB | 88.1 KB | 13.9 KB |

The generated stylesheet is far more repetitive than a real one, which flatters the brotli figure.
Read the direction (nested compresses much better because the parent selector is written once),
not the 83%.

Where native nesting differs, computed `color` in Chromium 151:

| Case | native | Sass 1.105.2 | Sass 1.91.0 | lightningcss | postcss-nesting |
| --- | --- | --- | --- | --- | --- |
| `.card { &__title { } }` | black (rule dropped) | red | red | black | black |
| `.card, #featured { & p { } }` vs `.card p.note` | green | red | red | green | green |
| declaration after a nested rule | blue | blue | green | blue | blue |
| bare `a { }` or `.title { }` nested | red | red | red | red | red |

lightningcss and postcss-nesting accept `&__title` without an error and emit a dead rule,
`__title.card { }`. Sass is the only one that concatenates.

Style apply cost in Chromium, median ms. I made four complete runs of `chromium-parse.mjs`; the
first two lacked the depth-2 workaround row and everything else in them agreed with the last two to
within about 15%. Figures below are run 3 / run 4.

The generated stylesheet itself (the one `compile-bench.mjs` compiles), apply time:

| Components | nested | flattened by Sass | flattened by lightningcss |
| --- | ---: | ---: | ---: |
| 1,000 | 118 / 114 | 15.3 / 14.2 | 14.8 / 13.7 |
| 5,000 | 2,827 / 2,810 | 180 / 174 | 173 / 179 |

Parsing the sheet cost the same in all three (4 to 5 ms at 1,000 components, 21 to 24 ms at 5,000).
Every variant produced identical computed styles. Isolating one pattern at a time, 1,000 components:

| Pattern | nested | hand-flattened |
| --- | ---: | ---: |
| `& .title`, `&.featured`, `&:focus-visible`, `@media { & .title }`, `& .title { &.active }`, `& .title { & b }` | 2.7 to 8.4 | 2.5 to 8.1 (same, within 1.2x) |
| `& .title:hover` written as a sibling rule, depth 2 | 9.1 / 9.7 | 9.3 / 9.5 |
| `& .title { &:hover }` | 107 / 117 | 9.2 / 9.7 |
| `& .title { &:first-child }` | 114 / 117 | 9.2 / 9.7 |
| `& .title { &::after }` | 176 / 196 | 13.1 / 14.2 |

And the scaling of `& .title { &:hover }`, nested vs flattened:

| Components | nested | flattened | ratio |
| --- | ---: | ---: | ---: |
| 250 | 8.3 / 8.8 | 2.1 / 2.5 | 4.0x / 3.5x |
| 500 | 29.8 / 32.4 | 4.0 / 4.4 | 7.5x / 7.4x |
| 1,000 | 110 / 121 | 8.9 / 9.7 | 12.3x / 12.5x |
| 2,000 | 471 / 474 | 24.4 / 25.9 | 19.3x / 18.3x |
| 4,000 | 1,690 / 1,819 | 74.6 / 78.7 | 22.7x / 23.1x |

Doubling the components roughly quadruples the nested cost. I confirmed the 1,000-component case a
third way, by appending a `<style>` element instead of adopting a sheet: about 110 ms against 9 ms. A
later, small style invalidation cost about 1 ms either way, so this is a full-recalculation cost
(page load, a new stylesheet, an invalidation that touches the whole document), not a per-frame one.
Chromium is the only browser measured, and I did not read its source to find out why.

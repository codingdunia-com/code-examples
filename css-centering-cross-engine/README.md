# 🎯 What centering does to a box that does not fit

The measurement behind [How to Center a Div in CSS: Every Method Explained](https://codingdunia.com/blog/css-centering-guide/).

Twelve centering techniques, four box sizes, three engines (Chromium, Firefox, WebKit
through Playwright 1.62.1), two passes each in fresh browsers. Every number is read
back from real layout with `getBoundingClientRect()` and the scroll position the
browser clamps to, not from what the CSS is supposed to do.

```bash
npm install
npx playwright install chromium firefox webkit
npm test
```

Needs Node 22+. No server and no page to open: the script builds each container in
the browser itself.

## 📏 What it measures

A 400x300 container with `overflow: auto`, and one child inside it:

| Child | Question it answers |
| --- | --- |
| 200x100 | Does the technique center a box that fits? |
| 600x500 | What happens when the box is bigger on both axes? |
| 600x100 | ... only too wide? |
| 200x500 | ... only too tall? |

For the oversized boxes the interesting number is how many pixels sit above or left
of the scroll origin. A scroll container can scroll down and to the right, never up or
left of zero, so those pixels are lost: no scrollbar, wheel or keyboard reaches them.
That is the "unsafe" part of unsafe alignment. The script also scrolls to the maximum
and checks that nothing is cut off at the bottom or right.

`techniques.mjs` holds the twelve rule sets, `measure-page.mjs` is the code that runs
in the browser, `collect.mjs` drives the three engines, `run.mjs` asserts and prints.

## 📈 What we measured

Chromium 151.0.7922.34, Firefox 153.0, WebKit 26.5, on an Apple M1, 2026-10-16. The
CPU was shared with other jobs, which does not matter here: layout is deterministic and
both passes, and two complete runs of the script, printed identical numbers.

| Technique | 200x100 centered? | 600x500: px lost top / left | 600x100: left | 200x500: top |
| --- | --- | --- | ---: | ---: |
| flex + align/justify center | yes | 100 / 100 | 100 | 100 |
| flex + safe center | yes | 0 / 0 | 0 | 0 |
| flex + margin:auto on child | yes | 0 / 0 | 0 | 0 |
| grid + place-items:center (auto track) | yes | 0 / 0 | 0 | 0 |
| grid + place-items:center (100% track) | yes | 100 / 100 | 100 | 100 |
| grid + place-items:safe center (100% track) | yes | 0 / 0 | 0 | 0 |
| grid + place-content:center | yes | 100 / 100 | 100 | 100 |
| grid + margin:auto on child | yes | 0 / 0 | 0 | 0 |
| absolute + top/left 50% + translate(-50%,-50%) | yes | 100 / 100 | 100 | 100 |
| absolute + inset:0 + margin:auto | yes | 100 / 0 | 0 | 100 |
| absolute + inset:0 + align-self/justify-self:center | yes | 0 / 0 | 0 | 0 |
| text-align:center + line-height + inline-block | no (0.3 to 1.1 px low) | 0 / 0 | 0 | 0 |

The three engines agree on every box position and every real scroll limit. They
disagree on one reported property: for `flex-center` and `grid-place-content`, WebKit's
`scrollWidth` or `scrollHeight` counts the unreachable overflow too (600 where
Chromium and Firefox say 500), while the clamped maximum scroll is identical in all
three. Code that computes `scrollWidth - clientWidth` for a scroll limit gets a wrong
answer in WebKit.

The line-height trick lands 0.81 px low in Chromium, 0.32 px in Firefox and 1.13 px in
WebKit, because `vertical-align: middle` aligns to the font's x-height, not to the box.

Two of the results are not obvious from any single-property explanation, so they are
asserted rather than left as observations:

- `place-items: center` is safe or unsafe depending on the track, not on the property.
  On an auto-sized track the track grows to the box and there is no free space to split;
  on a `100%` track the same declaration loses 100 px.
- `inset: 0; margin: auto` is safe horizontally (CSS 2.1 10.3.7 zeroes the negative
  margin) and unsafe vertically (10.6.4 has no such clause). One declaration, two
  behaviours, identical in all three engines.

## ⚠️ Limits

Left-to-right text only. In `dir="rtl"` the scroll origin moves to the right edge, so
the lost side flips; this script does not test it. One font size, and no scrollbar
gutter: `clientWidth` stayed 400 and `clientHeight` 300 in all three engines
(asserted), so a classic always-visible scrollbar on another setup would shrink the
client box and shift every center by half its width. CSS anchor
positioning (`anchor-center`) is not in the matrix.

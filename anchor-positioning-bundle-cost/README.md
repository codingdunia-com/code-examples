# ⚓ What a Floating UI tooltip costs to ship

The measurement behind [Positioning Tooltips With CSS Anchor Positioning](https://codingdunia.com/blog/css-anchor-positioning-tooltips-popovers/).

```bash
npm install
npm run measure
```

## 📏 What it measures

The article claims CSS anchor positioning replaces Floating UI for common tooltip
cases. That claim is only worth anything with a number attached, so the script
bundles a real tooltip and weighs it.

"Real" is the part that matters. Importing `computePosition` on its own would
undersell the library, because nobody ships a tooltip without the middleware that
makes it behave: `offset` for the gap, `flip` to move above the trigger when there
is no room below, `shift` to keep it inside the viewport, `arrow` for the triangle.
The generated entry point imports all four, then esbuild bundles and minifies it and
the script reports gzip and brotli sizes.

It prints its own dependency versions, Node version and the date. A bundle-size
number without those ages badly.

## 📈 What we measured

`@floating-ui/dom` 1.8.0, esbuild 0.28.2, Node 20.20.0 on Darwin arm64, 2026-08-24:

| | Bytes | |
| --- | ---: | ---: |
| minified | 15,098 B | 14.74 kB |
| minified + gzip | 6,115 B | 5.97 kB |
| minified + brotli | 5,529 B | 5.40 kB |

The CSS equivalent ships 0 B of JavaScript.

Two honest caveats. Tree-shaking means your number depends on which middleware you
import, so a simpler tooltip is cheaper than this one. And 6 kB gzipped is not a
crisis on its own, which is exactly why it is worth measuring instead of asserting:
the case for the CSS version is that it deletes a dependency, not that it rescues
your page load.

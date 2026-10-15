# 🖱️ What a scroll listener costs that animation-timeline does not

The measurement behind [Building Scroll-Driven Animations With Pure CSS](https://codingdunia.com/blog/scroll-driven-animations-css-guide/).

Headless, with an assertion on the shape of the result (Playwright 1.62.1; the
first run needs the browser binary):

```bash
npm install
npx playwright install chromium
npm test
```

Or by hand, in a real browser:

```bash
npx --yes http-server . -p 4399 -c-1
```

Then open `http://localhost:4399/measure-scroll.html` and leave the tab in the
foreground. The page scrolls itself and prints a JSON report at the bottom when it
finishes, roughly three seconds later. The result also lands on `window.__report`,
which is the hook to use if you would rather drive it from Playwright or Puppeteer.

Keep the tab focused. A backgrounded tab gets its timers and animation frames
throttled, and the pass either crawls or stalls outright.

## 📏 What it measures

Two progress bars do the same visible job: scale from 0 to 1 across the document's
scroll range. The indigo one is driven by a `scroll` event listener, the green one by
`animation-timeline: scroll(root block)` and no script at all. The page then scrolls
itself in 200 steps and counts, for the listener, how many times it ran and how many
milliseconds of main-thread time it spent inside the handler.

One detail is there to keep the result honest. At the bottom of the page the CSS bar
resolves to `scaleX(1)`, which is the identity matrix, indistinguishable from an
animation that never started. So the script also samples the computed transform
halfway down, where a live timeline has to read as roughly `0.5`.

## 📈 What we measured

Headless Chromium 151 on an Apple M1, 19,280 px of scroll range, 200 steps, three runs:

| | Handler calls | Main-thread ms in handler |
| --- | ---: | ---: |
| `scroll` event listener | 200 | 5.1 / 6.3 / 7.0 |
| `animation-timeline: scroll()` | 0 | 0 |

The same page run in a Linux container, on other hardware, reported 11.4 to 14.7 ms
for the listener. Both are true; the listener's cost is a property of the machine.
The zero is not.

Halfway sample for the CSS bar: `matrix(0.495021, 0, 0, 1, 0, 0)`. The timeline is
live, and it cost no script execution to get there.

Read the numbers for what they are. Single-digit milliseconds spread across a
full-page scroll is not what makes a page feel broken, and anyone claiming a scroll listener
is a performance catastrophe is overselling it. The difference is that the CSS
version is exactly zero, needs no throttling and no `requestAnimationFrame`
batching, and holds that zero on a page where the main thread is already busy with
hydration and renders, and on hardware slower than whatever you measured on. That is
the case for it, not a headline number.

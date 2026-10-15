// Runs measure-scroll.html in headless Chromium so this folder is checked
// the same way as every other example here, rather than being a page someone has
// to remember to open by hand.
//
// The page does the measuring; this file only drives it and checks the result is
// a real measurement. It asserts the shape, not the exact milliseconds, because
// timings move with the machine and a benchmark that fails on a fast laptop is
// just noise.
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('./measure-scroll.html', import.meta.url));

const server = createServer((_req, res) => {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(html);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const { port } = server.address();

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${port}/`);
const report = await page.waitForFunction(() => window.__report, null, { timeout: 60_000 })
  .then((h) => h.jsonValue());
await browser.close();
server.close();

console.log(JSON.stringify(report, null, 2));
console.log('');

const halfway = report.cssScrollTimeline.resolvedTransformAtHalfway ?? '';
const scaleX = Number(halfway.match(/matrix\(([\d.]+)/)?.[1] ?? NaN);

const checks = [
  ['animation-timeline is supported here', report.animationTimelineSupported === true],
  ['the scroll pass actually ran', report.listener.calls > 150],
  ['the listener cost main-thread time', report.listener.totalMainThreadMs > 0],
  ['the CSS timeline cost none', report.cssScrollTimeline.totalMainThreadMs === 0],
  ['the CSS timeline was live at the midpoint', scaleX > 0.35 && scaleX < 0.65],
];

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`);
  if (!ok) failed++;
}
if (failed > 0) {
  console.error(`\n${failed} assertion(s) failed.`);
  process.exit(1);
}
console.log('\nAll assertions passed. Published on an M1: 5.1-7.0 ms in the listener, 0 in CSS.');

import { chromium, firefox, webkit } from 'playwright';
import { TECHNIQUES, SCENARIOS, BOX } from './techniques.mjs';
import { measureInPage } from './measure-page.mjs';

export const ENGINES = [
  ['chromium', chromium],
  ['firefox', firefox],
  ['webkit', webkit],
];

// One fresh browser per pass, so a pass cannot inherit state from the last one.
export async function collect(passes = 2) {
  const result = {};
  for (const [name, type] of ENGINES) {
    result[name] = { passes: [] };
    for (let i = 0; i < passes; i++) {
      const browser = await type.launch();
      result[name].version = browser.version();
      const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
      await page.setContent('<!doctype html><meta charset="utf-8"><body style="margin:0">');
      const args = { techniques: TECHNIQUES, scenarios: SCENARIOS, box: BOX };
      const data = await page.evaluate(`(${measureInPage.toString()})(${JSON.stringify(args)})`);
      result[name].passes.push(data);
      await browser.close();
    }
  }
  return result;
}

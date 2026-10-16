import { chromium, firefox, webkit } from 'playwright';
import { measureInPage } from './measure-page.mjs';

export const ENGINES = [['chromium', chromium], ['firefox', firefox], ['webkit', webkit]];
export const CFG = {
  lastRowWidth: 700,
  sweep: { from: 320, to: 1280, step: 8 },
  cost: { sizes: [500, 2000, 8000], samples: 9, reps: 10 },
};

export async function collect(passes = 2) {
  const result = {};
  for (const [name, type] of ENGINES) {
    result[name] = { passes: [] };
    for (let i = 0; i < passes; i++) {
      const browser = await type.launch();
      result[name].version = browser.version();
      const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
      await page.setContent('<!doctype html><meta charset="utf-8"><body style="margin:0">');
      result[name].passes.push(await page.evaluate(`(${measureInPage.toString()})(${JSON.stringify(CFG)})`));
      await browser.close();
    }
  }
  return result;
}

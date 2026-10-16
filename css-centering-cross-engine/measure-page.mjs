// Runs inside the browser. Builds one container per (technique, scenario),
// reads real layout back, and returns plain numbers. No CSS is "expected" here;
// the verdict is computed from getBoundingClientRect and scroll positions.
export function measureInPage({ techniques, scenarios, box }) {
  const out = {};
  const r2 = (n) => Math.round(n * 100) / 100;

  for (const t of techniques) {
    out[t.id] = {};
    for (const s of scenarios) {
      const c = document.createElement('div');
      c.style.cssText =
        `box-sizing:border-box;width:${box.w}px;height:${box.h}px;overflow:auto;` +
        `scroll-behavior:auto;margin:0;padding:0;border:0;font:16px/1 sans-serif;${t.container}`;
      const k = document.createElement('div');
      k.style.cssText = `box-sizing:border-box;width:${s.w}px;height:${s.h}px;background:#888;${t.child}`;
      c.appendChild(k);
      document.body.appendChild(c);

      c.scrollTo(0, 0);
      const cr = c.getBoundingClientRect();
      const kr = k.getBoundingClientRect();
      const cw = c.clientWidth;
      const ch = c.clientHeight;
      const left = kr.left - cr.left;
      const top = kr.top - cr.top;

      // Ideal centered position inside the visible client box.
      const idealLeft = (cw - kr.width) / 2;
      const idealTop = (ch - kr.height) / 2;

      // Scroll all the way down and right, then see how much sticks out.
      // Ask for an impossible position and read back where the browser clamped
      // it: that is the real scroll limit, whatever scrollWidth claims.
      c.scrollTo(1e6, 1e6);
      const maxX = c.scrollLeft;
      const maxY = c.scrollTop;
      const kr2 = k.getBoundingClientRect();
      const cr2 = c.getBoundingClientRect();
      const stickRight = kr2.right - cr2.left - cw;
      const stickBottom = kr2.bottom - cr2.top - ch;

      out[t.id][s.id] = {
        left: r2(left),
        top: r2(top),
        dx: r2(left - idealLeft),
        dy: r2(top - idealTop),
        // Pixels of the box that lie above/left of the scroll origin: no scroll
        // position can ever bring them into view.
        lostTop: r2(Math.max(0, -top)),
        lostLeft: r2(Math.max(0, -left)),
        // Pixels still cut off even at maximum scroll.
        lostBottom: r2(Math.max(0, stickBottom)),
        lostRight: r2(Math.max(0, stickRight)),
        // Empty scroll room past the box at maximum scroll: you can scroll
        // further than the content goes.
        blankRight: maxX > 0 ? r2(Math.max(0, -stickRight)) : 0,
        blankBottom: maxY > 0 ? r2(Math.max(0, -stickBottom)) : 0,
        maxScrollX: r2(maxX),
        maxScrollY: r2(maxY),
        scrollW: c.scrollWidth,
        scrollH: c.scrollHeight,
        clientW: cw,
        clientH: ch,
      };
      c.remove();
    }
  }
  return out;
}

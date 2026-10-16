// Runs inside the browser. Three groups of measurements, all read back from real
// layout (getBoundingClientRect, scrollWidth, performance.now); nothing is
// computed from what the CSS "should" do.
export async function measureInPage(cfg) {
  const r2 = (n) => Math.round(n * 100) / 100;
  const LONG = 'Pneumonoultramicroscopicsilicovolcanoconiosis_supercalifragilistic';
  const SVG = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600"><rect width="1200" height="600" fill="#888"/></svg>');

  const mount = (html, css) => {
    const host = document.createElement('div');
    host.innerHTML = `<style>${css}</style>${html}`;
    document.body.appendChild(host);
    return host;
  };

  // ---- A + B: how a long word / a wide image changes the tracks ----------
  const SIZING = [
    { id: 'flex-1', label: 'flex: 1', box: 'display:flex', item: 'flex:1' },
    { id: 'flex-1-minw0', label: 'flex: 1 + min-width: 0', box: 'display:flex', item: 'flex:1;min-width:0' },
    { id: 'flex-1-ovh', label: 'flex: 1 + overflow: hidden', box: 'display:flex', item: 'flex:1;overflow:hidden' },
    { id: 'flex-auto', label: 'flex: 1 1 auto', box: 'display:flex', item: 'flex:1 1 auto' },
    { id: 'grid-1fr', label: 'grid 1fr 1fr 1fr', box: 'display:grid;grid-template-columns:1fr 1fr 1fr', item: '' },
    { id: 'grid-minmax0', label: 'grid minmax(0,1fr) x3', box: 'display:grid;grid-template-columns:repeat(3,minmax(0,1fr))', item: '' },
    { id: 'grid-1fr-ovh', label: 'grid 1fr x3 + overflow: hidden', box: 'display:grid;grid-template-columns:1fr 1fr 1fr', item: 'overflow:hidden' },
    // Text-only variants: three ways to let the word break.
    { id: 'flex-1-break-word', label: 'flex: 1 + overflow-wrap: break-word', box: 'display:flex', item: 'flex:1;overflow-wrap:break-word', wordOnly: true },
    { id: 'flex-1-anywhere', label: 'flex: 1 + overflow-wrap: anywhere', box: 'display:flex', item: 'flex:1;overflow-wrap:anywhere', wordOnly: true },
    { id: 'grid-1fr-break-word', label: 'grid 1fr x3 + overflow-wrap: break-word', box: 'display:grid;grid-template-columns:1fr 1fr 1fr', item: 'overflow-wrap:break-word', wordOnly: true },
    { id: 'grid-1fr-anywhere', label: 'grid 1fr x3 + overflow-wrap: anywhere', box: 'display:grid;grid-template-columns:1fr 1fr 1fr', item: 'overflow-wrap:anywhere', wordOnly: true },
    { id: 'flex-1-minw0-anywhere', label: 'flex: 1 + min-width: 0 + overflow-wrap: anywhere', box: 'display:flex', item: 'flex:1;min-width:0;overflow-wrap:anywhere', wordOnly: true },
  ];

  const sizing = {};
  for (const kind of ['word', 'image', 'imageMax']) {
    sizing[kind] = {};
    for (const v of SIZING) {
      if (v.wordOnly && kind !== 'word') { continue; }
      const mid = kind === 'word'
        ? `<div class="i" id="mid">${LONG}</div>`
        : kind === 'image'
          ? `<div class="i" id="mid"><img src="${SVG}" alt=""></div>`
          : `<div class="i" id="mid"><img src="${SVG}" alt="" style="max-width:100%;height:auto"></div>`;
      const host = mount(
        `<div id="box"><div class="i" id="a">short text here</div>${mid}<div class="i" id="c">short text here</div></div>`,
        `#box{width:600px;font:16px/1.2 monospace;${v.box}} .i{box-sizing:border-box;background:#ccc;${v.item}}`,
      );
      await Promise.all(Array.from(host.querySelectorAll('img')).map((im) => im.decode()));
      const box = host.querySelector('#box');
      const w = (id) => r2(host.querySelector(id).getBoundingClientRect().width);
      sizing[kind][v.id] = {
        a: w('#a'), mid: w('#mid'), c: w('#c'),
        overflow: r2(Math.max(0, box.scrollWidth - 600)),
        midHeight: r2(host.querySelector('#mid').getBoundingClientRect().height),
      };
      host.remove();
    }
  }
  // The word's own width, so a reader can see how close 600 px it is on this engine.
  const probe = mount(`<span id="p" style="font:16px/1.2 monospace;white-space:nowrap">${LONG}</span>`, '');
  const wordWidth = r2(probe.querySelector('#p').getBoundingClientRect().width);
  probe.remove();

  // ---- C: wrapping rows, last-row behaviour, column counts ---------------
  const ITEMS = 8;
  const GAP = 16;
  const GRIDS = [
    { id: 'flex-wrap-grow', label: 'flex-wrap, flex: 1 1 200px', box: 'display:flex;flex-wrap:wrap', item: 'flex:1 1 200px' },
    { id: 'flex-wrap-fixed', label: 'flex-wrap, flex: 0 0 200px', box: 'display:flex;flex-wrap:wrap', item: 'flex:0 0 200px' },
    { id: 'grid-auto-fill', label: 'grid auto-fill minmax(200px,1fr)', box: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr))', item: '' },
    { id: 'grid-auto-fit', label: 'grid auto-fit minmax(200px,1fr)', box: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr))', item: '' },
  ];
  const layoutRows = (width, v) => {
    const items = Array.from({ length: ITEMS }, (_, i) => `<div class="i">Item ${i + 1}</div>`).join('');
    const host = mount(`<div id="box">${items}</div>`,
      `#box{width:${width}px;gap:${GAP}px;font:16px/1.2 sans-serif;${v.box}} .i{box-sizing:border-box;background:#ccc;height:30px;${v.item}}`);
    const rects = Array.from(host.querySelectorAll('.i')).map((el) => el.getBoundingClientRect());
    host.remove();
    const rows = [];
    for (const r of rects) {
      const row = rows.find((x) => Math.abs(x.top - r.top) < 1);
      if (row) { row.widths.push(r2(r.width)); row.lefts.push(r2(r.left)); } else { rows.push({ top: r.top, widths: [r2(r.width)], lefts: [r2(r.left)] }); }
    }
    return rows;
  };

  const lastRow = {};
  for (const v of GRIDS) {
    const rows = layoutRows(cfg.lastRowWidth, v);
    const last = rows[rows.length - 1];
    const gaps = rows[0].lefts.slice(1).map((l, i) => r2(l - rows[0].lefts[i] - rows[0].widths[i]));
    lastRow[v.id] = {
      columns: rows[0].widths.length,
      rows: rows.length,
      firstRowWidth: rows[0].widths[0],
      lastRowWidths: last.widths,
      firstRowGaps: gaps,
    };
  }

  const sweep = [];
  for (let w = cfg.sweep.from; w <= cfg.sweep.to; w += cfg.sweep.step) {
    const row = { width: w };
    for (const v of GRIDS) {
      const rows = layoutRows(w, v);
      row[v.id] = { columns: rows[0].widths.length, itemWidth: rows[0].widths[0] };
    }
    sweep.push(row);
  }

  // ---- D: layout cost for N items ----------------------------------------
  const COST = [
    { id: 'block', label: 'block (reference)', box: '', item: '' },
    { id: 'flex-wrap', label: 'flex-wrap, flex: 1 1 200px', box: 'display:flex;flex-wrap:wrap', item: 'flex:1 1 200px' },
    { id: 'grid-auto-fill', label: 'grid auto-fill minmax(200px,1fr)', box: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr))', item: '' },
    { id: 'flex-row', label: 'flex row, no wrap, flex: 1', box: 'display:flex', item: 'flex:1;min-width:0' },
    { id: 'grid-row', label: 'grid, one row of N columns (1fr each)', box: 'display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr)', item: '' },
  ];
  const cost = {};
  for (const n of cfg.cost.sizes) {
    cost[n] = {};
    for (const v of COST) {
      const items = Array.from({ length: n }, (_, i) => `<div class="i">Item ${i}</div>`).join('');
      const host = mount(`<div id="box">${items}</div>`,
        `#box{width:900px;gap:8px;font:14px/1.2 sans-serif;${v.box}} .i{box-sizing:border-box;padding:4px;${v.item}}`);
      const box = host.querySelector('#box');
      // Warm up: first layout builds text shaping caches and is not what we time.
      box.style.width = '901px'; box.offsetHeight;
      const samples = [];
      for (let s = 0; s < cfg.cost.samples; s++) {
        const t0 = performance.now();
        for (let k = 0; k < cfg.cost.reps; k++) {
          box.style.width = (k % 2 ? 900 : 940) + 'px';
          box.offsetHeight;
        }
        samples.push((performance.now() - t0) / cfg.cost.reps);
      }
      samples.sort((a, b) => a - b);
      cost[n][v.id] = { median: r2(samples[Math.floor(samples.length / 2)]), min: r2(samples[0]), max: r2(samples[samples.length - 1]) };
      host.remove();
    }
  }

  return { sizing, wordWidth, lastRow, sweep, cost, labels: { SIZING: SIZING.map(({ id, label }) => ({ id, label })), GRIDS: GRIDS.map(({ id, label }) => ({ id, label })), COST: COST.map(({ id, label }) => ({ id, label })) } };
}

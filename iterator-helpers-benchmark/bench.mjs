import os from 'node:os';

const N = 1_000_000;
const data = Array.from({ length: N }, (_, i) => ({ id: i, score: i % 997, name: 'row-' + i }));

const batch = (fn, n) => {
  for (let i = 0; i < Math.min(n, 5); i++) { fn(); }
  const t = performance.now();
  for (let i = 0; i < n; i++) { fn(); }
  return (performance.now() - t) / n;
};
const best = (fn, n) => Math.min(batch(fn, n), batch(fn, n), batch(fn, n));

console.log('node ' + process.version + ' | v8 ' + process.versions.v8 + ' | ' + os.cpus()[0].model + ' | ' + new Date().toISOString().slice(0, 10));
console.log('dataset: ' + N.toLocaleString('en-US') + ' objects\n');

// --- 1. early termination: first 10 matches ---
const arrayFirst10 = () => data.filter(r => r.score > 900).map(r => r.name).slice(0, 10);
const iterFirst10  = () => data.values().filter(r => r.score > 900).map(r => r.name).take(10).toArray();
const loopFirst10  = () => { const out = []; for (const r of data) { if (r.score > 900) { out.push(r.name); if (out.length === 10) break; } } return out; };

console.log('A. first 10 matches out of ' + N.toLocaleString('en-US'));
console.log('   array .filter().map().slice(0,10) : ' + best(arrayFirst10, 20).toFixed(3) + ' ms');
console.log('   iterator .filter().map().take(10) : ' + best(iterFirst10, 2000).toFixed(4) + ' ms');
console.log('   hand-written for..of with break   : ' + best(loopFirst10, 2000).toFixed(4) + ' ms');
console.log('   (sanity: same result? ' + (JSON.stringify(arrayFirst10()) === JSON.stringify(iterFirst10()) && JSON.stringify(iterFirst10()) === JSON.stringify(loopFirst10())) + ')\n');

// --- 2. full consumption ---
const arrayAll = () => data.filter(r => r.score > 900).map(r => r.name);
const iterAll  = () => data.values().filter(r => r.score > 900).map(r => r.name).toArray();
console.log('B. every match (no early exit), result length ' + arrayAll().length.toLocaleString('en-US'));
console.log('   array .filter().map()             : ' + best(arrayAll, 20).toFixed(2) + ' ms');
console.log('   iterator .filter().map().toArray(): ' + best(iterAll, 20).toFixed(2) + ' ms');
console.log('   (same result? ' + (arrayAll().length === iterAll().length) + ')\n');

// --- 3. reduce/sum over whole set ---
const arraySum = () => data.map(r => r.score).reduce((a, b) => a + b, 0);
const iterSum  = () => data.values().map(r => r.score).reduce((a, b) => a + b, 0);
console.log('C. sum of a mapped field over all ' + N.toLocaleString('en-US'));
console.log('   array .map().reduce()             : ' + best(arraySum, 20).toFixed(2) + ' ms');
console.log('   iterator .map().reduce()          : ' + best(iterSum, 20).toFixed(2) + ' ms');
console.log('   (same result? ' + (arraySum() === iterSum()) + ')\n');

// --- 4. memory: intermediate arrays ---
const mem = (fn) => {
  global.gc?.();
  const before = process.memoryUsage().heapUsed;
  let peak = before;
  const t = setInterval(() => { const h = process.memoryUsage().heapUsed; if (h > peak) { peak = h; } }, 1);
  const r = fn();
  clearInterval(t);
  const after = process.memoryUsage().heapUsed;
  return { peakMB: (Math.max(peak, after) - before) / 1048576, len: r?.length ?? r };
};
console.log('D. heap growth while producing the first 10 matches');
const m1 = mem(arrayFirst10);
const m2 = mem(iterFirst10);
console.log('   array chain    : +' + m1.peakMB.toFixed(1) + ' MB');
console.log('   iterator chain : +' + m2.peakMB.toFixed(1) + ' MB');

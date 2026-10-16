// What async/await actually costs and how it fails, measured on this machine.
//
//   node bench.mjs
//
// Four parts, each prints numbers and asserts the part of the result that is a rule
// rather than a measurement (a direction, an exact tick count, an exit code):
//   1. latency: sequential await vs Promise.all vs a concurrency limit, against a real
//      HTTP server on 127.0.0.1 that answers after 25 ms
//   2. the per-await cost of looping over work that is already done
//   3. how many microtask ticks each way of returning a promise costs
//   4. which error patterns crash the process (child processes, exit codes read)
import http from 'node:http';
import os from 'node:os';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const SERVER_DELAY_MS = 25;
// node bench.mjs --only=2 runs a single part (1 to 4); handy for re-measuring the await cost alone.
const only = process.argv.find((a) => a.startsWith('--only='))?.split('=')[1];
const run = (n) => !only || only === String(n);
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const ms = (x) => (x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2));

console.log('node ' + process.version + ' | v8 ' + process.versions.v8 + ' | undici ' + process.versions.undici + ' | ' + os.cpus()[0].model + ' (' + os.cpus().length + ' cores) | ' + new Date().toISOString().slice(0, 10));
console.log('load average at start: ' + os.loadavg().map((x) => x.toFixed(1)).join(' / ') + '\n');

if (run(1)) {
// =============================== 1. latency ===============================
const server = http.createServer((req, res) => {
  if (req.url === '/fail') {
    res.statusCode = 500;
  }
  setTimeout(() => { res.end('ok'); }, SERVER_DELAY_MS);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = 'http://127.0.0.1:' + server.address().port + '/';

const hit = async (i) => {
  const res = await fetch(base + i);
  return res.text();
};
const timeIt = async (fn) => {
  const t = performance.now();
  await fn();
  return performance.now() - t;
};
const pool = async (limit, n) => {
  let next = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (next < n) {
      const i = next++;
      await hit(i);
    }
  });
  await Promise.all(workers);
};

const N = 20;
const strategies = {
  'await in a for loop': async () => { for (let i = 0; i < N; i++) { await hit(i); } },
  'Promise.all(map)': async () => { await Promise.all(Array.from({ length: N }, (_, i) => hit(i))); },
  'Promise.allSettled(map)': async () => { await Promise.allSettled(Array.from({ length: N }, (_, i) => hit(i))); },
  'pool, 5 at a time': async () => { await pool(5, N); },
  'pool, 2 at a time': async () => { await pool(2, N); },
};

// fetch resolves on an HTTP 500; only a network failure rejects
{
  const res = await fetch(base + 'fail');
  assert.equal(res.ok, false);
  assert.equal(res.status, 500);
  await res.text();
  console.log('fetch of a URL that answers 500: promise resolved, res.ok = ' + res.ok + ', status ' + res.status + '\n');
}
for (let i = 0; i < 5; i++) { await hit(i); } // warm the connection pool and the JIT
const lat = Object.fromEntries(Object.keys(strategies).map((k) => [k, []]));
const names = Object.keys(strategies);
for (let round = 0; round < 9; round++) {
  for (let k = 0; k < names.length; k++) {
    const name = names[(k + round) % names.length];
    lat[name].push(await timeIt(strategies[name]));
  }
}
console.log('## 1a. ' + N + ' requests, server answers after ' + SERVER_DELAY_MS + ' ms (9 rounds, interleaved)');
console.log('strategy | median ms | min | max | ideal ms');
const ideal = { 'await in a for loop': N * SERVER_DELAY_MS, 'Promise.all(map)': SERVER_DELAY_MS, 'Promise.allSettled(map)': SERVER_DELAY_MS, 'pool, 5 at a time': (N / 5) * SERVER_DELAY_MS, 'pool, 2 at a time': (N / 2) * SERVER_DELAY_MS };
for (const name of names) {
  console.log([name, ms(median(lat[name])), ms(Math.min(...lat[name])), ms(Math.max(...lat[name])), ideal[name]].join(' | '));
}
const seq = median(lat['await in a for loop']);
const par = median(lat['Promise.all(map)']);
assert.ok(seq > par * 10, 'sequential should be more than 10x slower than parallel for 20 x 25 ms');
assert.ok(median(lat['pool, 5 at a time']) > par && median(lat['pool, 5 at a time']) < seq, 'a pool sits between the two');
assert.ok(median(lat['pool, 2 at a time']) > median(lat['pool, 5 at a time']), 'a smaller pool is slower');
console.log('speed-up of Promise.all over the loop: ' + (seq / par).toFixed(1) + 'x (ideal ' + N + 'x)');
console.log('overhead above the ideal: loop +' + ms(seq - N * SERVER_DELAY_MS) + ' ms, Promise.all +' + ms(par - SERVER_DELAY_MS) + ' ms\n');

console.log('## 1b. how far does unbounded Promise.all scale? failures counted with allSettled');
console.log('requests | strategy | ms | failed requests | ideal ms');
const settle = async (jobs) => {
  const t = performance.now();
  const res = await Promise.allSettled(jobs);
  const failed = res.filter((x) => x.status === 'rejected');
  return { ms: performance.now() - t, failed: failed.length, code: failed[0]?.reason?.cause?.code ?? failed[0]?.reason?.message };
};
const guardedPool = async (limit, n) => {
  let next = 0;
  let failed = 0;
  const t = performance.now();
  await Promise.all(Array.from({ length: limit }, async () => {
    while (next < n) {
      const i = next++;
      try { await hit(i); } catch { failed++; }
    }
  }));
  return { ms: performance.now() - t, failed };
};
const scale = {};
for (const n of [10, 100, 1000, 2000, 5000]) {
  scale[n] = await settle(Array.from({ length: n }, (_, j) => hit(j)));
  console.log([n, 'Promise.allSettled(map)', ms(scale[n].ms), scale[n].failed + (scale[n].code ? ' (' + scale[n].code + ')' : ''), SERVER_DELAY_MS].join(' | '));
}
const pooled = await guardedPool(50, 5000);
console.log([5000, 'pool, 50 at a time', ms(pooled.ms), pooled.failed, (5000 / 50) * SERVER_DELAY_MS].join(' | '));
assert.equal(scale[10].failed, 0);
assert.equal(pooled.failed, 0, 'a pool of 50 should finish 5,000 requests without a single failure');
// No timing assertion here on purpose: the burst sometimes finishes cleanly and sometimes times out part of the way.
console.log('');
server.closeAllConnections?.();
await new Promise((r) => server.close(r));

}
if (run(2)) {
// =============================== 2. per-await cost ===============================
console.log('## 2. cost of one await, ns per iteration (1,000,000 iterations, best of 5)');
const ITER = 1_000_000;
const syncAdd = (x) => x + 1;
const asyncAdd = async (x) => x + 1;
const bestOf = async (fn) => {
  let best = Infinity;
  for (let r = 0; r < 5; r++) {
    const t = performance.now();
    await fn();
    best = Math.min(best, performance.now() - t);
  }
  return (best * 1e6) / ITER;
};
const cases = {
  'sync call in a loop': async () => { let a = 0; for (let i = 0; i < ITER; i++) { a = syncAdd(a); } return a; },
  'await a plain value': async () => { let a = 0; for (let i = 0; i < ITER; i++) { a = await syncAdd(a); } return a; },
  'await an async function call': async () => { let a = 0; for (let i = 0; i < ITER; i++) { a = await asyncAdd(a); } return a; },
  'await Promise.resolve(value)': async () => { let a = 0; for (let i = 0; i < ITER; i++) { a = await Promise.resolve(syncAdd(a)); } return a; },
  'the same loop written with .then()': () => new Promise((resolve) => {
    let i = 0;
    let a = 0;
    const next = () => {
      if (i++ === ITER) { resolve(a); return; }
      Promise.resolve(syncAdd(a)).then((v) => { a = v; next(); });
    };
    next();
  }),
};
for (let w = 0; w < 2; w++) { for (const fn of Object.values(cases)) { await fn(); } } // warm-up
const perAwait = {};
for (const [name, fn] of Object.entries(cases)) { perAwait[name] = await bestOf(fn); }
console.log('case | ns per iteration');
for (const [name, v] of Object.entries(perAwait)) { console.log(name + ' | ' + v.toFixed(1)); }
assert.ok(perAwait['await a plain value'] > perAwait['sync call in a loop'], 'an await is never free');
assert.ok(perAwait['await a plain value'] > perAwait['sync call in a loop'] * 5, 'an await costs at least 5x a plain call');
console.log('');

}
if (run(3)) {
// =============================== 3. microtask ticks ===============================
// A self-rescheduling microtask counts ticks while the promise under test settles.
// The figure is ticks until a .then() callback on the result runs, minus the figure
// for an already-resolved promise, so it is the cost of the shape and nothing else.
const ticksFor = async (make) => {
  let ticks = 0;
  let running = true;
  const spin = () => { if (running) { ticks++; queueMicrotask(spin); } };
  queueMicrotask(spin);
  let at = -1;
  make().then(() => { at = ticks; running = false; });
  await new Promise((r) => setTimeout(r, 5));
  running = false;
  return at;
};
const baseline = await ticksFor(() => Promise.resolve(1));
const settled = () => Promise.resolve(42);
const tickCases = {
  'async () => 1': () => (async () => 1)(),
  'async () => await p': () => (async () => await settled())(),
  'async () => p (returns the promise)': () => (async () => settled())(),
  'async () => { return await p } in try/catch': () => (async () => { try { return await settled(); } catch (e) { throw e; } })(),
  'async () => { await p; await p; await p }': () => (async () => { await settled(); await settled(); await settled(); return 1; })(),
  'p.then(v => v)': () => settled().then((v) => v),
  'Promise.all([p])': () => Promise.all([settled()]),
  'Promise.all([p, p, p])': () => Promise.all([settled(), settled(), settled()]),
  'Promise.allSettled([p, p, p])': () => Promise.allSettled([settled(), settled(), settled()]),
  'Promise.race([p, p, p])': () => Promise.race([settled(), settled(), settled()]),
};
console.log('## 3. microtask ticks until the result is observable (extra ticks vs an already-resolved promise)');
console.log('shape | extra ticks');
const ticks = {};
for (const [name, make] of Object.entries(tickCases)) {
  ticks[name] = (await ticksFor(make)) - baseline;
  console.log(name + ' | ' + ticks[name]);
}
assert.ok(ticks['async () => p (returns the promise)'] > ticks['async () => await p'], 'returning a promise from an async function costs more ticks than awaiting it');
assert.ok(ticks['async () => { await p; await p; await p }'] > ticks['async () => await p'], 'each await adds a tick');
console.log('');

}
if (run(4)) {
// =============================== 4. errors ===============================
console.log('## 4. which error patterns crash the process (child process per case, Node default flags)');
const runChild = (code) => {
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', code], { encoding: 'utf8', timeout: 20_000 });
  return { exit: r.status, stdout: r.stdout.trim(), crashed: r.status !== 0, mentions: /boom|slow-fail|fast-fail/.test(r.stderr) };
};
const prelude = `
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const failAfter = (ms, msg) => sleep(ms).then(() => { throw new Error(msg); });
const okAfter = (ms, v) => sleep(ms).then(() => v);
`;
const errorCases = [
  {
    name: 'start two, await in order, 2nd fails while awaiting the 1st (try/catch around both)',
    expectCrash: true,
    code: prelude + `
      const a = okAfter(60, 'a'); const b = failAfter(10, 'fast-fail');
      try { await a; await b; console.log('no error'); } catch (e) { console.log('caught ' + e.message); }`,
  },
  {
    name: 'same two promises through Promise.all',
    expectCrash: false,
    code: prelude + `
      const a = okAfter(60, 'a'); const b = failAfter(10, 'fast-fail');
      try { await Promise.all([a, b]); } catch (e) { console.log('caught ' + e.message); }`,
  },
  {
    name: 'two failures through Promise.all (the second one is swallowed)',
    expectCrash: false,
    code: prelude + `
      try { await Promise.all([failAfter(10, 'fast-fail'), failAfter(30, 'slow-fail')]); } catch (e) { console.log('caught ' + e.message); }
      await sleep(60); console.log('done');`,
  },
  {
    name: 'same two promises through Promise.allSettled',
    expectCrash: false,
    code: prelude + `
      const r = await Promise.allSettled([okAfter(60, 'a'), failAfter(10, 'fast-fail')]);
      console.log(r.map((x) => x.status).join(','));`,
  },
  {
    name: 'forEach(async) with try/catch around it',
    expectCrash: true,
    code: prelude + `
      try { [1, 2].forEach(async (n) => { await sleep(10); throw new Error('boom ' + n); }); } catch (e) { console.log('caught'); }
      console.log('after forEach'); await sleep(50);`,
  },
  {
    name: 'for...of with await and try/catch around it',
    expectCrash: false,
    code: prelude + `
      try { for (const n of [1, 2]) { await sleep(10); throw new Error('boom ' + n); } } catch (e) { console.log('caught ' + e.message); }`,
  },
  {
    name: 'async call with no await and no catch',
    expectCrash: true,
    code: prelude + `
      const f = async () => { await sleep(5); throw new Error('boom'); };
      try { f(); } catch (e) { console.log('caught'); }
      await sleep(30);`,
  },
  {
    name: 'same rejection with a process.on("unhandledRejection") listener',
    expectCrash: false,
    code: prelude + `
      process.on('unhandledRejection', (e) => console.log('listener saw ' + e.message));
      const f = async () => { await sleep(5); throw new Error('boom'); };
      f(); await sleep(30);`,
  },
];
console.log('case | exit code | crashed | stdout');
for (const c of errorCases) {
  const r = runChild(c.code);
  console.log(c.name + ' | ' + r.exit + ' | ' + r.crashed + ' | ' + JSON.stringify(r.stdout));
  assert.equal(r.crashed, c.expectCrash, 'unexpected result for: ' + c.name);
}
console.log('');

// Things that need no child process.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
{
  // return vs return await inside try/catch
  const failing = async () => { await sleep(1); throw new Error('boom'); };
  let caughtWithout = false;
  let caughtWith = false;
  const without = async () => { try { return failing(); } catch { caughtWithout = true; } };
  const withAwait = async () => { try { return await failing(); } catch { caughtWith = true; } };
  await without().catch(() => {});
  await withAwait();
  assert.equal(caughtWithout, false, 'return failing() skips the catch block');
  assert.equal(caughtWith, true, 'return await failing() reaches the catch block');
  console.log('try { return p } catch: catch block ran = ' + caughtWithout + ' | try { return await p } catch: catch block ran = ' + caughtWith);
}
{
  // Promise.all does not cancel the work that is still running
  let finished = 0;
  const task = (delay, fail) => sleep(delay).then(() => { finished++; if (fail) { throw new Error('boom'); } });
  const t0 = performance.now();
  await Promise.all([task(10, true), task(40), task(40)]).catch(() => {});
  const rejectedAt = performance.now() - t0;
  const finishedAtRejection = finished;
  await sleep(80);
  console.log('Promise.all rejected after ' + ms(rejectedAt) + ' ms with ' + finishedAtRejection + ' task finished; 80 ms later ' + finished + ' had finished');
  assert.equal(finishedAtRejection, 1);
  assert.equal(finished, 3, 'the other two tasks kept running after Promise.all rejected');
}
{
  // forEach does not wait
  const order = [];
  await (async () => {
    [1, 2, 3].forEach(async (n) => { await sleep(10); order.push('item ' + n); });
    order.push('after forEach');
  })();
  await sleep(40);
  assert.deepEqual(order, ['after forEach', 'item 1', 'item 2', 'item 3']);
  console.log('forEach(async) order: ' + order.join(', '));
}
}
console.log('\nAll assertions passed.');

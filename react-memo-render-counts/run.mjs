// Render counts and commit times for the memoization patterns in
// "React Hooks Best Practices". Runs twice: a production build for timing
// (the dev build is slower and would distort every ratio) and a development
// build for StrictMode, which only does its double work in development.
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const here = fileURLToPath(new URL('.', import.meta.url));
const phase = process.argv.find((a) => a.startsWith('--phase='))?.slice(8);

if (!phase) {
  for (const p of ['production', 'development']) {
    const res = spawnSync(process.execPath, [fileURLToPath(import.meta.url), `--phase=${p}`], {
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: p },
    });
    if (res.status !== 0) {
      process.exit(res.status ?? 1);
    }
  }
  console.log('\nAll assertions passed.');
  process.exit(0);
}

// ---- environment: jsdom must exist before react-dom is imported ----

const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;

const React = await import('react');
const { createRoot } = await import('react-dom/client');
const { flushSync, version: ReactDOMVersion } = await import('react-dom');
const { act, StrictMode, createElement } = React;
// The production build of React does not export act(); the development build
// does, and warns when it is not used. So: act() in development, flushSync() in
// production. Both commit the update before returning control to the script.
globalThis.IS_REACT_ACT_ENVIRONMENT = typeof act === 'function';
const apply = (fn) => (act ? act(fn) : flushSync(fn));
const settle = () => new Promise((resolve) => setImmediate(resolve));

// ---- build components.jsx twice: without and with the React Compiler ----

const { transformSync } = await import('@babel/core');
const buildDir = new URL('.build/', import.meta.url);
mkdirSync(buildDir, { recursive: true });
copyFileSync(new URL('counters.mjs', import.meta.url), new URL('.build/counters.mjs', import.meta.url));

const source = readFileSync(new URL('components.jsx', import.meta.url), 'utf8');
const compilerEvents = [];

function build(withCompiler) {
  const plugins = withCompiler
    ? [['babel-plugin-react-compiler', { logger: { logEvent: (_file, event) => compilerEvents.push(event) } }]]
    : [];
  const out = transformSync(source, {
    filename: 'components.jsx',
    sourceType: 'module',
    babelrc: false,
    configFile: false,
    plugins,
    presets: [['@babel/preset-react', { runtime: 'automatic' }]],
  });
  const name = withCompiler ? 'compiled.mjs' : 'plain.mjs';
  writeFileSync(new URL(name, buildDir), out.code);
  return import(pathToFileURL(fileURLToPath(new URL(name, buildDir))).href);
}

const plain = await build(false);
const compiled = await build(true);
const counters = await import(new URL('.build/counters.mjs', import.meta.url).href);
const { counts, commits, resetCounts, snapshotCounts, setStore, readStore } = counters;

// ---- helpers ----

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

async function mount(Component, props, { strict = false } = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const element = createElement(Component, props);
  apply(() => {
    root.render(strict ? createElement(StrictMode, null, element) : element);
  });
  await settle();
  return {
    container,
    async unmount() {
      apply(() => root.unmount());
      await settle();
      container.remove();
    },
  };
}

function bumpTick() {
  const t0 = performance.now();
  apply(() => {
    setStore({ tick: readStore('tick') + 1 });
  });
  return performance.now() - t0;
}

function header(title) {
  console.log(`\n=== ${title} ===`);
}

function row(cells, widths) {
  console.log(cells.map((c, i) => String(c).padEnd(widths[i])).join('  '));
}

const cpu = os.cpus()[0].model;
console.log(`react ${React.version} / react-dom ${ReactDOMVersion}`);
console.log(`NODE_ENV=${process.env.NODE_ENV}  node ${process.version}  ${cpu}  (${os.cpus().length} cores)`);
console.log(`load average at start (1m): ${os.loadavg()[0].toFixed(2)}  date: ${new Date().toISOString().slice(0, 10)}`);

// ======================================================================
if (phase === 'production') {
  const N = 1000;
  const ROUNDS = 7;
  const BUMPS = 15;

  // ---- scenario 1: what a parent update costs the children ----
  const WORK = 3000; // arithmetic units per row, see calibration below
  header(`1. Parent re-renders on unrelated state, ${N} rows`);
  const s1 = [
    ['PlainInline', 'plain rows, inline handler'],
    ['MemoInline', 'memo rows, inline handler'],
    ['MemoCallback', 'memo rows + useCallback'],
    ['PlainCallback', 'plain rows + useCallback'],
    ['MemoCallbackInlineStyle', 'memo + useCallback + inline style={{}}'],
    ['MemoCallbackMemoStyle', 'memo + useCallback + useMemo style'],
    ['MemoCallbackChildren', 'memo + useCallback + JSX children'],
    ['ContextInlineValue', 'memo + context value {} inline'],
    ['ContextMemoValue', 'memo + context value useMemo'],
  ];
  const works = [0, WORK];
  const results = new Map();
  const keyOf = (work, build, name) => `${work}:${build}:${name}`;
  for (const work of works) {
    for (const [name] of s1) {
      for (const build of ['plain', 'compiled']) {
        results.set(keyOf(work, build, name), { times: [], rowsPerUpdate: new Set() });
      }
    }
  }
  for (let round = 0; round < ROUNDS; round++) {
    for (const work of works) {
      for (const [name] of s1) {
        for (const [buildName, mod] of [['plain', plain], ['compiled', compiled]]) {
          const entry = results.get(keyOf(work, buildName, name));
          resetCounts();
          const view = await mount(mod[name], { n: N, work });
          // Sanity check: the counter works in both builds, every row rendered once on mount.
          assert.equal(counts.row, N, `${buildName}:${name} should render ${N} rows on mount`);
          bumpTick(); // warm-up
          for (let i = 0; i < BUMPS; i++) {
            resetCounts();
            entry.times.push(bumpTick());
            entry.rowsPerUpdate.add(counts.row ?? 0);
          }
          await view.unmount();
        }
      }
    }
  }
  const widths = [40, 9, 12, 10, 10];
  const rowMicros = ((median(results.get(keyOf(WORK, 'plain', 'PlainInline')).times) - median(results.get(keyOf(0, 'plain', 'PlainInline')).times)) / N) * 1000;
  for (const work of works) {
    console.log(`\nrow work = ${work} units${work ? ` (adds about ${rowMicros.toFixed(1)} us per row, measured as the PlainInline difference)` : ' (a bare <li>)'}`);
    row(['pattern', 'build', 'rows/update', 'median ms', 'min ms'], widths);
    for (const [name, label] of s1) {
      for (const buildName of ['plain', 'compiled']) {
        const entry = results.get(keyOf(work, buildName, name));
        row(
          [label, buildName, [...entry.rowsPerUpdate].join('/'), median(entry.times).toFixed(2), Math.min(...entry.times).toFixed(2)],
          widths,
        );
      }
    }
  }
  const rowsOf = (build, name, work = 0) => {
    const set = results.get(keyOf(work, build, name)).rowsPerUpdate;
    assert.equal(set.size, 1, `${build}:${name} rendered a different number of rows on different updates`);
    return [...set][0];
  };
  const msOf = (build, name, work = 0) => median(results.get(keyOf(work, build, name)).times);

  // Without the compiler: memo only helps when every prop is referentially stable.
  for (const work of works) {
    assert.equal(rowsOf('plain', 'PlainInline', work), N);
    assert.equal(rowsOf('plain', 'MemoInline', work), N);
    assert.equal(rowsOf('plain', 'PlainCallback', work), N);
    assert.equal(rowsOf('plain', 'MemoCallback', work), 0);
    assert.equal(rowsOf('plain', 'MemoCallbackInlineStyle', work), N);
    assert.equal(rowsOf('plain', 'MemoCallbackMemoStyle', work), 0);
    assert.equal(rowsOf('plain', 'MemoCallbackChildren', work), N);
    assert.equal(rowsOf('plain', 'ContextInlineValue', work), N);
    assert.equal(rowsOf('plain', 'ContextMemoValue', work), 0);
  }
  // With real row work, a working memo is a large win and a defeated one is not.
  assert.ok(msOf('plain', 'MemoCallback', WORK) * 5 < msOf('plain', 'PlainInline', WORK), 'a working memo should be several times cheaper');
  assert.ok(msOf('plain', 'MemoInline', WORK) > msOf('plain', 'PlainInline', WORK) * 0.9, 'a defeated memo should save nothing');

  // ---- compiler: what it compiled, and what it did to the counts ----
  header('1b. React Compiler (babel-plugin-react-compiler) on the same source');
  const kinds = {};
  for (const e of compilerEvents) {
    kinds[e.kind] = (kinds[e.kind] || 0) + 1;
  }
  console.log('compiler events:', JSON.stringify(kinds));
  for (const e of compilerEvents.filter((x) => x.kind !== 'CompileSuccess')) {
    console.log('  not compiled:', e.fnLoc ? `line ${e.fnLoc.start.line}` : '?', '-', e.detail?.reason ?? e.reason ?? e.kind);
  }
  assert.ok((kinds.CompileSuccess ?? 0) > 10, 'the compiler should have compiled the components');
  // Stored for the article: unmemoized code, compiled.
  for (const work of works) {
    for (const [name] of s1) {
      assert.equal(rowsOf('compiled', name, work), 0, `compiled ${name} should not re-render its rows`);
    }
  }

  // ---- scenario 2: cost of useMemo ----
  header(`2a. useMemo around a string concat, ${N} cells re-rendering`);
  const cheap = { CheapPlain: [], CheapMemo: [] };
  for (let round = 0; round < ROUNDS; round++) {
    for (const name of Object.keys(cheap)) {
      const view = await mount(plain[name], { n: N });
      bumpTick();
      for (let i = 0; i < BUMPS; i++) {
        cheap[name].push(bumpTick());
      }
      await view.unmount();
    }
  }
  row(['variant', 'median ms', 'min ms'], [24, 10, 8]);
  for (const [name, xs] of Object.entries(cheap)) {
    row([name, median(xs).toFixed(2), Math.min(...xs).toFixed(2)], [24, 10, 8]);
  }
  const cheapRatio = median(cheap.CheapMemo) / median(cheap.CheapPlain);
  console.log(`CheapMemo / CheapPlain = ${cheapRatio.toFixed(2)}`);

  header('2b. useMemo around filter + sort (localeCompare), by list size');
  const sizes = [10, 100, 1000, 5000];
  const list = {};
  for (const size of sizes) {
    list[size] = { ListPlain: [], ListMemo: [] };
  }
  for (let round = 0; round < ROUNDS; round++) {
    for (const size of sizes) {
      for (const name of ['ListPlain', 'ListMemo']) {
        const view = await mount(plain[name], { n: size });
        bumpTick();
        for (let i = 0; i < 40; i++) {
          list[size][name].push(bumpTick());
        }
        await view.unmount();
      }
    }
  }
  row(['products', 'no memo ms', 'useMemo ms', 'saved ms'], [10, 12, 12, 10]);
  for (const size of sizes) {
    const a = median(list[size].ListPlain);
    const b = median(list[size].ListMemo);
    row([size, a.toFixed(3), b.toFixed(3), (a - b).toFixed(3)], [10, 12, 12, 10]);
  }
  const big = list[5000];
  assert.ok(median(big.ListMemo) * 3 < median(big.ListPlain), 'useMemo must clearly win on 5000 products');

  // ---- scenario 3: derived state ----
  header('3. Derived state: useEffect + setState versus computing in render (20000 items)');
  // Alternating queries with very different match counts (11111 and 1), so a stale count is visible.
  const queries = ['item-1', 'item-12345', 'item-1', 'item-12345', 'item-1', 'item-12345'];
  const derived = {
    DerivedEffect: { label: 'useEffect + setState', render: 'derived.effect.render' },
    DerivedRender: { label: 'plain computation in render', render: 'derived.render.render' },
    DerivedMemo: { label: 'useMemo in render', render: 'derived.memo.render' },
  };
  const derivedOut = {};
  for (const [name, meta] of Object.entries(derived)) {
    derivedOut[name] = { times: [], renders: new Set(), commits: new Set(), firstCommitStale: [] };
  }
  for (let round = 0; round < ROUNDS; round++) {
    for (const [name, meta] of Object.entries(derived)) {
      setStore({ query: 'item-0' });
      const view = await mount(plain[name], { n: 20000 });
      for (let i = 0; i < queries.length; i++) {
        resetCounts();
        const t0 = performance.now();
        apply(() => {
          setStore({ query: queries[i] });
        });
        await settle(); // lets the useEffect + setState variant finish its second render
        const dt = performance.now() - t0;
        if (i > 0) {
          derivedOut[name].times.push(dt);
        }
        derivedOut[name].renders.add(counts[meta.render] ?? 0);
        derivedOut[name].commits.add(commits.length);
        derivedOut[name].firstCommitStale.push(commits[0].startsWith(`${queries[i]}:`) && commits.length > 1 && commits[0] !== commits.at(-1));
      }
      await view.unmount();
    }
  }
  row(['approach', 'renders/change', 'DOM commits/change', 'first commit stale', 'median ms'], [30, 16, 20, 20, 10]);
  for (const [name, meta] of Object.entries(derived)) {
    const o = derivedOut[name];
    row(
      [meta.label, [...o.renders].join('/'), [...o.commits].join('/'), o.firstCommitStale.every(Boolean) ? 'yes' : 'no', median(o.times).toFixed(2)],
      [30, 16, 20, 20, 10],
    );
  }
  assert.deepEqual([...derivedOut.DerivedEffect.renders], [2]);
  assert.deepEqual([...derivedOut.DerivedEffect.commits], [2]);
  assert.ok(derivedOut.DerivedEffect.firstCommitStale.every(Boolean), 'the first commit pairs the new query with the old count');
  assert.deepEqual([...derivedOut.DerivedRender.renders], [1]);
  assert.deepEqual([...derivedOut.DerivedRender.commits], [1]);
  assert.deepEqual([...derivedOut.DerivedMemo.renders], [1]);

  // ---- scenario 5: closure facts ----
  header('5. Facts the article states about closures and initial state');
  const clickFacts = {};
  for (const functional of [false, true]) {
    const view = await mount(plain.ClickCounter, { functional });
    const button = document.querySelector('button');
    const seen = [];
    for (let i = 0; i < 2; i++) {
      apply(() => {
        button.click();
      });
      await settle();
      seen.push(Number(button.dataset.count));
    }
    clickFacts[functional ? 'functional' : 'direct'] = seen;
    await view.unmount();
  }
  console.log('two setCount calls per click, count after click 1 and click 2:', JSON.stringify(clickFacts));
  assert.deepEqual(clickFacts.direct, [1, 2]);
  assert.deepEqual(clickFacts.functional, [2, 4]);

  const initFacts = {};
  for (const lazy of [false, true]) {
    let calls = 0;
    const parse = () => {
      calls++;
      return 'user';
    };
    const view = await mount(plain.EagerInit, { lazy, parse });
    for (let i = 0; i < 60; i++) {
      bumpTick();
    }
    initFacts[lazy ? 'lazy' : 'eager'] = calls;
    await view.unmount();
  }
  console.log('parse() calls over 1 mount + 60 re-renders:', JSON.stringify(initFacts));
  assert.equal(initFacts.eager, 61);
  assert.equal(initFacts.lazy, 1);
}

// ======================================================================
if (phase === 'development') {
  header('4. StrictMode: mount, one update, unmount');
  const keys = ['strict.initializer', 'strict.useMemoFactory', 'strict.render', 'strict.effectSetup', 'strict.effectCleanup', 'strict.refAttach', 'strict.refCleanup'];
  const strictOut = {};
  for (const strict of [false, true]) {
    resetCounts();
    const view = await mount(plain.StrictProbe, {}, { strict });
    const afterMount = snapshotCounts();
    resetCounts();
    bumpTick();
    const afterUpdate = snapshotCounts();
    resetCounts();
    await view.unmount();
    const afterUnmount = snapshotCounts();
    strictOut[strict ? 'StrictMode' : 'no StrictMode'] = { afterMount, afterUpdate, afterUnmount };
  }
  for (const mode of Object.keys(strictOut)) {
    console.log(`\n${mode}`);
    row(['counter', 'mount', 'update', 'unmount'], [26, 8, 8, 8]);
    for (const key of keys) {
      const o = strictOut[mode];
      row([key, o.afterMount[key] ?? 0, o.afterUpdate[key] ?? 0, o.afterUnmount[key] ?? 0], [26, 8, 8, 8]);
    }
  }
  const s = strictOut.StrictMode;
  const plainMode = strictOut['no StrictMode'];
  assert.equal(plainMode.afterMount['strict.render'], 1);
  assert.equal(s.afterMount['strict.render'], 2);
  assert.equal(s.afterUpdate['strict.render'], 2);
  assert.equal(plainMode.afterMount['strict.effectSetup'], 1);
  assert.equal(s.afterMount['strict.effectSetup'], 2);
  assert.equal(s.afterMount['strict.effectCleanup'], 1);

  header('4b. StrictMode and a fetch in an effect, with and without an abort cleanup');
  const fetchOut = {};
  for (const withAbort of [false, true]) {
    let started = 0;
    const fetcher = (signal) =>
      new Promise((resolve, reject) => {
        started++;
        const timer = setTimeout(() => resolve('data'), 30);
        signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
        });
      });
    resetCounts();
    const view = await mount(plain.FetchOnMount, { fetcher, withAbort }, { strict: true });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 80));
    });
    fetchOut[withAbort ? 'with abort cleanup' : 'no cleanup'] = {
      requestsStarted: started,
      resultsApplied: counts['fetch.applied'] ?? 0,
      abortsSeen: counts['fetch.abortSeen'] ?? 0,
    };
    await view.unmount();
  }
  console.log(JSON.stringify(fetchOut, null, 2));
  assert.deepEqual(fetchOut['no cleanup'], { requestsStarted: 2, resultsApplied: 2, abortsSeen: 0 });
  assert.deepEqual(fetchOut['with abort cleanup'], { requestsStarted: 2, resultsApplied: 1, abortsSeen: 1 });
}

console.log(`\n[${phase}] assertions passed`);

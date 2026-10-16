// Measured behaviour of the React 19 APIs the "React 19 New Features" guide
// describes: Actions, useOptimistic, use(), ref as a prop, Activity and
// useEffectEvent. Plain React 19, no React Compiler anywhere in this folder.
// Runs against the development build because that is where React reports
// misuse (warnings are part of the result), and counts do not differ in production.
process.env.NODE_ENV = 'development';

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import os from 'node:os';
import { JSDOM, VirtualConsole } from 'jsdom';

const require = createRequire(import.meta.url);
const dom = new JSDOM('<!doctype html><html><body></body></html>', { virtualConsole: new VirtualConsole() });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
// React builds a FormData from the submitted form; Node's own FormData rejects a jsdom element.
globalThis.FormData = dom.window.FormData;
globalThis.SubmitEvent = dom.window.SubmitEvent;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const React = await import('react');
const { createRoot } = await import('react-dom/client');
const ReactDOMVersion = (await import('react-dom')).version;
const {
  act, Component, createElement: h, Suspense, useActionState, useEffect, useOptimistic, useRef, useState, useTransition, use,
} = React;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const settle = (ms = 80) => act(async () => { await sleep(ms); });
const header = (t) => console.log(`\n=== ${t} ===`);
const show = (label, value) => console.log(`${label.padEnd(44)} ${typeof value === 'string' ? value : JSON.stringify(value)}`);

// Collects console.error output while fn runs (React reports misuse there).
async function withWarnings(fn) {
  const seen = [];
  const original = console.error;
  console.error = (...args) => {
    seen.push(args.map(String).join(' ').replace(/\s+/g, ' ').slice(0, 160));
  };
  try {
    await fn();
  } finally {
    console.error = original;
  }
  return seen;
}

async function mount(element) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container, { onUncaughtError() {}, onCaughtError() {}, onRecoverableError() {} });
  await act(async () => { root.render(element); });
  return { container, async unmount() { await act(async () => root.unmount()); container.remove(); } };
}

class Boundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() { return this.state.error ? h('p', { id: 'caught' }, `caught: ${this.state.error.message}`) : this.props.children; }
}

console.log(`react ${React.version} / react-dom ${ReactDOMVersion}  NODE_ENV=${process.env.NODE_ENV}`);
console.log(`node ${process.version}  ${os.cpus()[0].model} (${os.cpus().length} cores)  load average (1m): ${os.loadavg()[0].toFixed(2)}  date: ${new Date().toISOString().slice(0, 10)}`);

const results = {};

// ---------------------------------------------------------------- 1. exports per version
header('1. What each react version exports');
const versions = [['react-18', '18.3.1'], ['react-19-0', '19.0.0'], ['react-19-1', '19.1.0'], ['react-19-2', '19.2.0'], ['react', React.version]];
const names = ['use', 'useActionState', 'useOptimistic', 'useEffectEvent', 'Activity', 'unstable_Activity', 'cacheSignal'];
const matrix = {};
for (const [alias, label] of versions) {
  const mod = require(alias);
  assert.equal(mod.version, label, `${alias} should resolve to ${label}`);
  const row = {};
  for (const n of names) {
    row[n] = typeof mod[n] !== 'undefined';
  }
  let compilerRuntime = true;
  try { require.resolve(`${alias}/compiler-runtime`); } catch { compilerRuntime = false; }
  row['compiler-runtime'] = compilerRuntime;
  matrix[label] = row;
}
console.log(['version'.padEnd(9), ...[...names, 'compiler-runtime'].map((n) => n.slice(0, 11).padEnd(12))].join(''));
for (const [label, row] of Object.entries(matrix)) {
  console.log([label.padEnd(9), ...[...names, 'compiler-runtime'].map((n) => (row[n] ? 'yes' : '-').padEnd(12))].join(''));
}
const reactPkgFiles = Object.keys(require('react/package.json').exports);
show('react package export paths', reactPkgFiles.join(' '));
results.matrix = matrix;

// ---------------------------------------------------------------- 2. useTransition + useActionState
header('2. Actions: useTransition(async) and useActionState');
{
  const log = [];
  function Pending() {
    const [isPending, start] = useTransition();
    log.push(isPending);
    return h('button', { id: 'go', onClick: () => start(async () => { await sleep(30); }) }, 'go');
  }
  const view = await mount(h(Pending));
  log.length = 0;
  await act(async () => { document.getElementById('go').click(); });
  await settle(60);
  show('useTransition(async) isPending per render', log);
  results.transitionLog = [...log];
  await view.unmount();
}

async function runForm(action, { submits = 1, wrapper = (x) => x } = {}) {
  const log = [];
  function Form() {
    const [state, formAction, isPending] = useActionState(action, { status: 'idle', n: 0 });
    log.push(`${isPending ? 'pending' : 'idle'}:${state.status}${state.n}`);
    return h('form', { id: 'f', action: formAction }, h('input', { name: 'name', defaultValue: 'Ada' }), h('button', null, 'Save'));
  }
  const view = await mount(wrapper(h(Form)));
  log.length = 0;
  const warnings = await withWarnings(async () => {
    await act(async () => {
      for (let i = 0; i < submits; i++) {
        document.getElementById('f')?.requestSubmit();
      }
    });
    await settle(150);
  });
  const caught = document.getElementById('caught')?.textContent ?? null;
  await view.unmount();
  return { log, warnings, caught };
}

{
  const calls = [];
  const t0 = performance.now();
  const ok = await runForm(async (prev) => {
    calls.push({ at: Math.round(performance.now() - t0), event: 'start', prevN: prev.n });
    await sleep(30);
    calls.push({ at: Math.round(performance.now() - t0), event: 'end' });
    return { status: 'ok', n: prev.n + 1 };
  });
  show('one submit, renders (isPending:status+n)', ok.log);
  results.formSuccess = ok.log;

  calls.length = 0;
  const t1 = performance.now();
  const two = await runForm(async (prev) => {
    calls.push({ at: Math.round(performance.now() - t1), event: 'start', prevN: prev.n });
    await sleep(40);
    calls.push({ at: Math.round(performance.now() - t1), event: 'end' });
    return { status: 'ok', n: prev.n + 1 };
  }, { submits: 2 });
  show('two submits back to back, renders', two.log);
  show('two submits, action calls', calls.map((c) => `${c.event}${c.event === 'start' ? `(prev.n=${c.prevN})` : ''}`));
  results.formTwo = { log: two.log, calls: calls.map((c) => ({ ...c })) };

  const thrown = await runForm(async () => { await sleep(10); throw new Error('boom'); }, { wrapper: (x) => h(Boundary, null, x) });
  show('action that throws, renders', thrown.log);
  show('action that throws, boundary text', thrown.caught);
  results.formThrow = { log: thrown.log, caught: thrown.caught };

  const returned = await runForm(async () => { await sleep(10); return { status: 'error', n: 0 }; });
  show('action that returns an error object, renders', returned.log);
  results.formReturnError = returned.log;
}

// ---------------------------------------------------------------- 3. useOptimistic
header('3. useOptimistic: success, failure, and a call outside an action');
async function optimisticRun(mode) {
  const log = [];
  function List() {
    const [items, setItems] = useState(['a']);
    const [optimistic, addOptimistic] = useOptimistic(items, (state, next) => [...state, `${next}*`]);
    const [, start] = useTransition();
    log.push(optimistic.join(','));
    const add = () => {
      if (mode === 'outside') {
        addOptimistic('b');
        return;
      }
      start(async () => {
        addOptimistic('b');
        await sleep(40);
        if (mode === 'fail') {
          return; // the server said no; nothing is written to real state
        }
        if (mode === 'success-wrapped') {
          start(() => { setItems((prev) => [...prev, 'b']); });
          return;
        }
        setItems((prev) => [...prev, 'b']);
      });
    };
    return h('button', { id: 'add', onClick: add }, optimistic.join(','));
  }
  const view = await mount(h(List));
  log.length = 0;
  const warnings = await withWarnings(async () => {
    await act(async () => { document.getElementById('add').click(); });
    await settle(120);
  });
  await view.unmount();
  return { log, warnings };
}
for (const mode of ['success', 'success-wrapped', 'fail', 'outside']) {
  const r = await optimisticRun(mode);
  show(`useOptimistic ${mode}: what each render showed`, r.log);
  if (r.warnings.length) {
    show(`useOptimistic ${mode}: warning`, r.warnings[0]);
  }
  results[`optimistic_${mode.replace('-', '_')}`] = r;
}

// manual pending bookkeeping for the same job
{
  const log = [];
  function Manual() {
    const [items, setItems] = useState(['a']);
    const [pending, setPending] = useState([]);
    const shown = [...items, ...pending.map((p) => `${p}*`)];
    log.push(shown.join(','));
    const add = async () => {
      setPending((p) => [...p, 'b']);
      try {
        await sleep(40);
        setItems((prev) => [...prev, 'b']);
      } finally {
        setPending((p) => p.filter((x) => x !== 'b'));
      }
    };
    return h('button', { id: 'add', onClick: add }, shown.join(','));
  }
  const view = await mount(h(Manual));
  log.length = 0;
  await act(async () => { document.getElementById('add').click(); });
  await settle(120);
  show('manual pending state, success, renders', log);
  results.manualSuccess = log;
  await view.unmount();
}

// ---------------------------------------------------------------- 4. use()
header('4. use(): where the promise comes from, and conditional calls');
{
  let fetches = 0;
  const makePromise = () => { fetches++; return sleep(20).then(() => 'user'); };
  let renders = 0;
  function Profile({ promise }) {
    renders++;
    return h('p', null, use(promise));
  }
  const stable = makePromise();
  const stableFetches = fetches;
  const view = await mount(h(Suspense, { fallback: h('i', null, '...') }, h(Profile, { promise: stable })));
  await settle(80);
  show('promise made outside render: fetches / renders / text', `${stableFetches} / ${renders} / ${document.body.textContent}`);
  results.useStable = { fetches: stableFetches, renders, text: document.body.textContent };
  await view.unmount();

  renders = 0;
  fetches = 0;
  function Unstable() {
    renders++;
    return h('p', null, use(makePromise()));
  }
  // Outside act() on purpose: act() holds React's retry work until the scope ends,
  // which hides how often a suspended component is asked to try again.
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  const warnings = await withWarnings(async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    root.render(h(Suspense, { fallback: h('i', null, '...') }, h(Unstable)));
    await sleep(1500); // seventy-five times the 20 ms the promise takes
    results.useUnstableText = container.textContent;
    root.unmount();
    container.remove();
  });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  show('promise made inside render, after 1500 ms: text', results.useUnstableText);
  show('  fetches started / component renders', `${fetches} / ${renders}`);
  show('  warnings', warnings.length ? warnings[0] : 'none');
  results.useUnstable = { fetches, renders, warnings, text: results.useUnstableText };
}
{
  // conditional call after an early return
  const promise = Promise.resolve('value');
  function Cond({ on }) {
    const [first] = useState('first');
    if (!on) {
      return h('p', null, first);
    }
    return h('p', null, `${first}+${use(promise)}`);
  }
  const holder = { set: null };
  function Host() {
    const [on, setOn] = useState(false);
    holder.set = setOn;
    return h(Suspense, { fallback: 'loading' }, h(Cond, { on }));
  }
  const warnings = await withWarnings(async () => {
    const view = await mount(h(Host));
    await act(async () => { holder.set(true); });
    await settle(30);
    results.useConditional = document.body.textContent;
    await view.unmount();
  });
  show('use() after an early return, flipped on', results.useConditional);
  show('  warnings', warnings.length);

  function CondState({ on }) {
    const [first] = useState('first');
    if (!on) {
      return h('p', null, first);
    }
    const [second] = useState('second');
    return h('p', null, `${first}+${second}`);
  }
  const holder2 = { set: null };
  function Host2() {
    const [on, setOn] = useState(false);
    holder2.set = setOn;
    return h(Boundary, null, h(CondState, { on }));
  }
  const w2 = await withWarnings(async () => {
    const view = await mount(h(Host2));
    await act(async () => { holder2.set(true); });
    await settle(30);
    results.useStateConditional = document.body.textContent;
    await view.unmount();
  });
  show('second useState after an early return, flipped on', results.useStateConditional);
  show('  boundary / warnings', w2.slice(0, 1));
}
{
  function Reject({ promise }) { return h('p', null, use(promise)); }
  const rejected = Promise.reject(new Error('nope'));
  rejected.catch(() => {});
  const view = await mount(h(Boundary, null, h(Suspense, { fallback: 'loading' }, h(Reject, { promise: rejected }))));
  await settle(30);
  show('rejected promise passed to use()', document.body.textContent);
  results.useRejected = document.body.textContent;
  await view.unmount();
}

// ---------------------------------------------------------------- 5. ref as a prop
header('5. ref as a prop');
{
  const received = {};
  function PlainInput({ ref, ...rest }) { return h('input', { ref, ...rest }); }
  const Legacy = React.forwardRef(function Legacy(props, ref) { return h('input', { ref, ...props }); });
  const warnings = await withWarnings(async () => {
    const a = { current: null };
    const b = { current: null };
    const view = await mount(h('div', null, h(PlainInput, { ref: a, id: 'a' }), h(Legacy, { ref: b, id: 'b' })));
    received.plain = a.current?.id ?? null;
    received.forwardRef = b.current?.id ?? null;
    await view.unmount();
  });
  show('ref prop without forwardRef reaches the DOM node', received.plain);
  show('forwardRef still works', received.forwardRef);
  show('warnings from either', warnings.length ? warnings : 'none');
  results.ref = { received, warnings };

  const events = [];
  function Cleanup() {
    return h('input', { ref: (node) => { events.push('attach'); return () => events.push('cleanup'); } });
  }
  const view = await mount(h(Cleanup));
  await view.unmount();
  show('ref callback that returns a function', events);
  results.refCleanup = events;
}

// ---------------------------------------------------------------- 6. Activity
header('6. Activity versus display: none for a hidden subtree');
async function hiddenSubtree(kind) {
  const events = [];
  function Child({ value }) {
    events.push(`child render:${value}`);
    useEffect(() => {
      events.push('child effect:setup');
      return () => events.push('child effect:cleanup');
    }, []);
    const [typed, setTyped] = useState('');
    return h('input', { id: 'in', value: typed, onChange: (e) => setTyped(e.target.value) });
  }
  const holder = {};
  function Host() {
    const [hidden, setHidden] = useState(false);
    const [value, setValue] = useState(0);
    holder.setHidden = setHidden;
    holder.setValue = setValue;
    React.useLayoutEffect(() => { events.push(`host commit:${value}/${hidden ? 'hidden' : 'visible'}`); });
    const child = h(Child, { value });
    return h('div', null, h('span', null, value), kind === 'activity'
      ? h(React.Activity, { mode: hidden ? 'hidden' : 'visible' }, child)
      : h('div', { style: { display: hidden ? 'none' : 'block' } }, child));
  }
  const view = await mount(h(Host));
  const out = {};
  const step = async (name, fn) => {
    events.length = 0;
    await act(async () => { fn(); });
    await settle(20);
    out[name] = [...events];
  };
  await act(async () => {
    const input = document.getElementById('in');
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(input, 'draft');
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
  await step('hide', () => holder.setHidden(true));
  await step('update while hidden', () => holder.setValue(1));
  await step('show', () => holder.setHidden(false));
  out.typedAfter = document.getElementById('in').value;
  await view.unmount();
  return out;
}
results.hidden = { activity: await hiddenSubtree('activity'), displayNone: await hiddenSubtree('display-none') };
for (const [kind, out] of Object.entries(results.hidden)) {
  console.log(`\n${kind}`);
  for (const step of ['hide', 'update while hidden', 'show']) {
    show(`  ${step}`, out[step].length ? out[step] : 'nothing');
  }
  show('  input value after hide + show', out.typedAfter);
}

// ---------------------------------------------------------------- 7. useEffectEvent
header('7. useEffectEvent: reconnects when only the theme changes');
{
  async function reconnects(useEvent) {
    let connects = 0;
    const holder = {};
    function Chat({ roomId, theme }) {
      const onConnected = React.useEffectEvent(() => `${roomId}/${theme}`);
      useEffect(() => {
        connects++;
        if (useEvent) {
          onConnected();
        }
        return () => {};
      }, useEvent ? [roomId] : [roomId, theme]);
      return h('p', null, theme);
    }
    function Host() {
      const [theme, setTheme] = useState('light');
      holder.setTheme = setTheme;
      return h(Chat, { roomId: 'general', theme });
    }
    const view = await mount(h(Host));
    await act(async () => { holder.setTheme('dark'); });
    await view.unmount();
    return connects;
  }
  const withEvent = await reconnects(true);
  const withDep = await reconnects(false);
  show('effect runs after mount + one theme change', { 'theme in deps': withDep, 'useEffectEvent, roomId only': withEvent });
  results.effectEvent = { withDep, withEvent };
}


// ---------------------------------------------------------------- assertions
const m = results.matrix;
for (const n of names) {
  assert.equal(m['18.3.1'][n], false, `${n} must not exist in 18.3.1`);
}
assert.equal(m['18.3.1']['compiler-runtime'], false);
for (const v of ['19.0.0', '19.1.0']) {
  assert.deepEqual([m[v].use, m[v].useActionState, m[v].useOptimistic], [true, true, true]);
  assert.deepEqual([m[v].useEffectEvent, m[v].Activity, m[v].cacheSignal], [false, false, false], `${v} must not export the 19.2 APIs`);
  assert.equal(m[v]['compiler-runtime'], true);
}
for (const v of ['19.2.0', React.version]) {
  assert.deepEqual([m[v].useEffectEvent, m[v].Activity, m[v].cacheSignal], [true, true, true]);
  assert.equal(m[v].unstable_Activity, false);
}

assert.deepEqual(results.transitionLog, [true, false]);
assert.deepEqual(results.formSuccess, ['pending:idle0', 'idle:ok1']);
assert.deepEqual(results.formTwo.calls.map((c) => c.event), ['start', 'end', 'start', 'end'], 'the second action must wait for the first');
assert.deepEqual(results.formTwo.calls.filter((c) => c.event === 'start').map((c) => c.prevN), [0, 1]);
assert.equal(results.formTwo.log.at(-1), 'idle:ok2');
assert.equal(results.formThrow.caught, 'caught: boom');
assert.ok(results.formThrow.log.every((entry) => entry.startsWith('pending')), 'a throwing action never settles into an idle state');
assert.deepEqual(results.formReturnError, ['pending:idle0', 'idle:error0']);

assert.ok(results.optimistic_success.log.includes('a,b,b*'), 'naive useOptimistic shows the item twice for one render');
assert.ok(!results.optimistic_success_wrapped.log.includes('a,b,b*'));
assert.equal(results.optimistic_success_wrapped.log.at(-1), 'a,b');
assert.deepEqual(results.optimistic_fail.log, ['a,b*', 'a']);
assert.deepEqual(results.optimistic_outside.log, ['a,b*', 'a']);
assert.match(results.optimistic_outside.warnings[0], /outside a transition or action/);
assert.deepEqual(results.manualSuccess, ['a,b*', 'a,b']);

assert.equal(results.useStable.fetches, 1);
assert.equal(results.useStable.text, 'user');
assert.ok(results.useUnstable.fetches > 3, 'a promise made in render is made again on every retry');
assert.equal(results.useUnstable.text, '...', 'and the component never leaves its fallback');
assert.equal(results.useConditional, 'first+value');
assert.match(results.useStateConditional, /Rendered more hooks than during the previous render/);
assert.equal(results.useRejected, 'caught: nope');

assert.equal(results.ref.received.plain, 'a');
assert.equal(results.ref.received.forwardRef, 'b');
assert.deepEqual(results.ref.warnings, []);
assert.deepEqual(results.refCleanup, ['attach', 'cleanup']);

const act_ = results.hidden.activity;
const dn = results.hidden.displayNone;
assert.ok(act_.hide.includes('child effect:cleanup'), 'Activity tears effects down while hidden');
assert.ok(!dn.hide.includes('child effect:cleanup'), 'display: none leaves effects running');
assert.ok(act_['update while hidden'].indexOf('host commit:1/hidden') < act_['update while hidden'].indexOf('child render:1'), 'hidden render comes after the visible commit');
assert.ok(dn['update while hidden'].indexOf('child render:1') < dn['update while hidden'].indexOf('host commit:1/hidden'), 'display: none renders the child before the commit');
assert.ok(act_.show.includes('child effect:setup'));
assert.equal(act_.typedAfter, 'draft');
assert.equal(dn.typedAfter, 'draft');

assert.equal(results.effectEvent.withDep, 2);
assert.equal(results.effectEvent.withEvent, 1);

console.log('\nAll assertions passed.');

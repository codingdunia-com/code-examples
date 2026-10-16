// Behavioural differences between Object.groupBy, Map.groupBy and the hand-written
// reduce() pattern. Every claim in the article's "what changes besides speed"
// section is an assertion here, so a future engine that changes the answer fails
// this file instead of leaving the article quietly wrong.
import assert from 'node:assert/strict';
import _ from 'lodash';

const results = [];
const check = (name, fn) => {
  fn();
  results.push(name);
};

// The classic accumulator, written the way most codebases write it.
const reduceGroup = (items, keyFn) =>
  items.reduce((acc, item, i) => {
    const key = keyFn(item, i);
    if (!acc[key]) { acc[key] = []; }
    acc[key].push(item);
    return acc;
  }, {});

const reduceGroupNullable = (items, keyFn) =>
  items.reduce((acc, item, i) => {
    const key = keyFn(item, i);
    (acc[key] ??= []).push(item);
    return acc;
  }, Object.create(null));

// 1. Group keys that collide with Object.prototype members.
check('reduce({}) throws on a group key called "toString"', () => {
  assert.throws(() => reduceGroup(['a', 'b'], () => 'toString'), TypeError);
});
check('reduce({}) throws on a group key called "constructor" and "__proto__"', () => {
  assert.throws(() => reduceGroup(['a'], () => 'constructor'), TypeError);
  assert.throws(() => reduceGroup(['a'], () => '__proto__'), TypeError);
});
check('Object.groupBy handles "toString", "constructor" and "__proto__" as plain data', () => {
  const g = Object.groupBy(['a', 'b', 'c'], (s) => ({ a: 'toString', b: 'constructor', c: '__proto__' })[s]);
  assert.equal(Object.getPrototypeOf(g), null);
  assert.deepEqual(Object.keys(g).sort(), ['__proto__', 'constructor', 'toString']);
  assert.deepEqual(g.toString, ['a']);
  assert.deepEqual(Object.getOwnPropertyDescriptor(g, '__proto__').value, ['c']);
});
check('reduce(Object.create(null)) with ??= matches Object.groupBy on those keys', () => {
  const g = reduceGroupNullable(['a', 'b'], () => 'toString');
  assert.deepEqual(g.toString, ['a', 'b']);
});

// 2. The result is a null-prototype object, so the usual methods are missing.
check('Object.groupBy result has no hasOwnProperty and cannot be printed with String()', () => {
  const g = Object.groupBy([1, 2], () => 'x');
  assert.equal(typeof g.hasOwnProperty, 'undefined');
  assert.throws(() => String(g), TypeError);
  assert.throws(() => `${g}`, TypeError);
});

// 3. Key coercion.
check('Object.groupBy merges 1 and "1"; Map.groupBy keeps them apart', () => {
  const items = [1, '1', 1, '1'];
  assert.deepEqual(Object.keys(Object.groupBy(items, (x) => x)), ['1']);
  assert.equal(Map.groupBy(items, (x) => x).size, 2);
});
check('Object.groupBy collapses every object key into "[object Object]"', () => {
  const a = { id: 1 };
  const b = { id: 2 };
  const g = Object.groupBy([a, b, a], (x) => x);
  assert.deepEqual(Object.keys(g), ['[object Object]']);
  assert.equal(g['[object Object]'].length, 3);
  const m = Map.groupBy([a, b, a], (x) => x);
  assert.equal(m.size, 2);
  assert.equal(m.get(a).length, 2);
});
check('Map.groupBy uses SameValueZero: NaN is one group, -0 and 0 are one group', () => {
  const m = Map.groupBy([NaN, NaN, 0, -0], (x) => x);
  assert.equal(m.size, 2);
  assert.equal(m.get(NaN).length, 2);
  assert.equal(m.get(0).length, 2);
});
check('Object.groupBy accepts symbol keys and keeps them separate from the same string', () => {
  const s = Symbol('k');
  const g = Object.groupBy(['a', 'b', 'c'], (x) => (x === 'c' ? 'k' : s));
  assert.equal(g[s].length, 2);
  assert.equal(g.k.length, 1);
});

// 4. Key order.
check('Object.groupBy orders integer-like keys numerically, not by first appearance', () => {
  const items = ['b', '10', 'a', '2', '1'];
  const g = Object.groupBy(items, (x) => x);
  assert.deepEqual(Object.keys(g), ['1', '2', '10', 'b', 'a']);
  assert.deepEqual([...Map.groupBy(items, (x) => x).keys()], ['b', '10', 'a', '2', '1']);
});
check('Object.groupBy keeps first-seen order for non-integer string keys', () => {
  const g = Object.groupBy(['z', 'y', 'z', 'x'], (x) => x);
  assert.deepEqual(Object.keys(g), ['z', 'y', 'x']);
});
check('items inside one group stay in source order', () => {
  const g = Object.groupBy([5, 3, 8, 1, 9, 2], (n) => (n % 2 ? 'odd' : 'even'));
  assert.deepEqual(g.odd, [5, 3, 1, 9]);
  assert.deepEqual(g.even, [8, 2]);
});

// 5. Input handling.
check('groupBy visits holes in a sparse array; reduce skips them', () => {
  const sparse = [1, , 3]; // eslint-disable-line no-sparse-arrays
  assert.deepEqual(Object.keys(Object.groupBy(sparse, (x) => String(x))), ['1', '3', 'undefined']);
  assert.deepEqual(Object.keys(reduceGroupNullable(sparse, (x) => String(x))), ['1', '3']);
});
check('groupBy accepts any iterable: Set, string and generator', () => {
  const fromSet = Object.groupBy(new Set([1, 2, 3]), (n) => n % 2);
  assert.deepEqual({ ...fromSet }, { 0: [2], 1: [1, 3] });
  assert.deepEqual(Object.groupBy('hello', (c) => c).l, ['l', 'l']);
  function* gen() { yield 1; yield 2; yield 3; }
  assert.equal(Map.groupBy(gen(), (n) => n % 2).get(1).length, 2);
});
check('Object.groupBy rejects a plain object because it is not iterable', () => {
  assert.throws(() => Object.groupBy({ a: 1 }, (x) => x), TypeError);
});
check('the callback receives (item, index) and the index counts from 0 across the iteration', () => {
  const seen = [];
  Object.groupBy(['a', 'b', 'c'], (item, index) => { seen.push([item, index]); return 'k'; });
  assert.deepEqual(seen, [['a', 0], ['b', 1], ['c', 2]]);
});
check('groups hold references, not copies', () => {
  const row = { id: 1 };
  const g = Object.groupBy([row], () => 'k');
  assert.equal(g.k[0], row);
});
check('an error thrown inside the callback propagates to the caller', () => {
  assert.throws(() => Object.groupBy([1, 2, 3], (n) => { if (n === 2) { throw new RangeError('boom'); } return 'k'; }), RangeError);
});

check('lodash groupBy returns an ordinary object and survives "toString" keys', () => {
  const g = _.groupBy(['a', 'b'], () => 'toString');
  assert.notEqual(Object.getPrototypeOf(g), null);
  assert.deepEqual(g.toString, ['a', 'b']);
});

console.log('Semantics: ' + results.length + ' assertions passed');
for (const r of results) { console.log('  ok  ' + r); }

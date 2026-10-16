// Shared by the plain and the compiled build of components.jsx so both write
// into the same counters and read from the same store.
import { useSyncExternalStore } from 'react';

export const counts = {};
export const commits = [];

export function tick(name) {
  counts[name] = (counts[name] || 0) + 1;
}

export function snapshotCounts() {
  return { ...counts };
}

export function resetCounts() {
  for (const key of Object.keys(counts)) {
    delete counts[key];
  }
  commits.length = 0;
}

export function logCommit(text) {
  commits.push(text);
}

// A tiny external store. Changing it re-renders only components that read the
// changed key, which is how a parent gets "unrelated state" in these tests.
const state = { tick: 0, query: 'a' };
const listeners = new Set();

export function readStore(key) {
  return state[key];
}

export function setStore(patch) {
  Object.assign(state, patch);
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useStoreValue(key) {
  return useSyncExternalStore(subscribe, () => state[key]);
}

// Stand-in for "the row does some real work": a fixed amount of arithmetic.
let sink = 0;
export function burn(units) {
  if (!units) {
    return;
  }
  let acc = 0;
  for (let i = 1; i <= units; i++) {
    acc += Math.sqrt(i);
  }
  sink += acc;
}
export function readSink() {
  return sink;
}

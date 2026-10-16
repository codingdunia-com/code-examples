# React 19 APIs, measured

The measurement behind [React 19: Complete Guide to New Features and Migration](https://codingdunia.com/blog/react-19-new-features/).

```bash
npm install
npm test
```

Needs Node 22.22.2+ (jsdom 30 requires it; tested on 22.23.3 and 24.21.0). No browser: React runs in jsdom, on the development
build, because that is where React reports misuse and the warnings are part of the result.
There is no React Compiler anywhere in this folder; every number is plain React 19.

Pinned: `react` and `react-dom` 19.3.1, plus `react@18.3.1`, `19.0.0`, `19.1.0` and
`19.2.0` installed under aliases (`react-18`, `react-19-0`, ...) for the export matrix.
`jsdom` 30.1.3.

## What it measures

1. Which of `use`, `useActionState`, `useOptimistic`, `useEffectEvent`, `Activity`,
   `cacheSignal` and `react/compiler-runtime` each React version actually exports.
2. `useTransition` with an async function, and `useActionState` through a real
   `<form action>` submitted with `requestSubmit()`: the render sequence for a success, a
   returned error, a thrown error, and two submissions back to back.
3. `useOptimistic`: what every render showed on success, on failure, with the real state
   updated outside a nested transition, and when it is called outside an action. Compared
   with hand-written pending state.
4. `use()`: how many times the fetch ran and how often the component rendered for a
   promise made outside the component versus inside it; a conditional `use()` versus a
   conditional `useState`; a rejected promise.
5. `ref` as a prop without `forwardRef`, whether `forwardRef` warns, and a ref callback
   that returns a cleanup function.
6. `<Activity mode="hidden">` versus `display: none`: order of render and commit, effects
   and preserved input state.
7. `useEffectEvent`: how many times an effect re-runs when only a non-dependency changes.

The script asserts every result below, so it fails if a future React changes the answer.

## What we measured

React 19.3.1, Node 22.23.3, Apple M1, 2026-10-16, machine shared with other jobs
(these are counts and orderings, not timings, so load does not move them; two runs gave
identical output apart from the retry count in item 4).

| | 18.3.1 | 19.0.0 | 19.1.0 | 19.2.0 | 19.3.1 |
| --- | :-: | :-: | :-: | :-: | :-: |
| `use`, `useActionState`, `useOptimistic` | no | yes | yes | yes | yes |
| `useEffectEvent`, `Activity`, `cacheSignal` | no | no | no | yes | yes |
| `react/compiler-runtime` | no | yes | yes | yes | yes |

- Async `useTransition`: `isPending` is `true` then `false` (two renders).
- One form submit through `useActionState`: pending render, then the settled render.
  Two submits back to back: the actions run one after the other, the second receives the
  state the first returned (`prevState.n` 0 then 1), and only two renders happen.
- An action that throws never settles; the nearest error boundary catches it. An action
  that returns an error object settles normally.
- `useOptimistic`, success with `setItems` after an `await`: renders `a,b*` then
  `a,b,b*` (the item twice) then `a,b`. Wrapping `setItems` in `startTransition` removes
  the duplicate. Failure: `a,b*` then `a`. Called outside an action: React warns and the
  optimistic value lasts one render.
- `use(promise)`, promise made outside: one fetch, three renders. Made inside the
  component: the fetch restarts on every retry (about 70 in 1.5 s with a 20 ms promise),
  the fallback never goes away, and React prints no warning.
- `use()` after an early return works; a second `useState` after an early return throws
  "Rendered more hooks than during the previous render".
- `ref` as a prop reaches the DOM node; `forwardRef` still works and produced no warning
  in 19.3.1. A ref callback that returns a function gets it called on unmount.
- `Activity` hidden: effects are cleaned up, the child still renders for prop changes but
  after the host commit, and typed input survives. `display: none`: effects keep running
  and the child renders before the commit.
- `useEffectEvent`: 1 effect run when only the theme changes, against 2 with the theme
  in the dependency array.

# Utility types, compiled and then executed

Every utility type from [TypeScript Utility Types Explained](https://codingdunia.com/blog/typescript-utility-types-guide/),
compiled under strict TypeScript 7 and then actually run.

```bash
npm install
npm test
```

## Two halves

**`src/`** compiles and runs. `main.ts` asserts what the helpers do at runtime:
`Partial` merges a subset onto a user, `Required` fills defaults and throws on a
missing `apiUrl`, `Pick` and `Omit` produce objects with exactly the expected keys,
`Record` covers every `HttpStatus`, and the `Exclude` and `Extract` unions are used
to type real arrays. `function-types.ts` derives
`Parameters`, `ReturnType` and `Awaited` from a real async function, wraps it with a
generic helper, and freezes a `Readonly<Config>`.

**`must-fail/`** does not compile, on purpose. Each file is compiled on its own and
has to produce a specific diagnostic:

| File | Expected | Point |
| --- | --- | --- |
| `record-missing-key.ts` | `TS2741` | `Record` forces a message for every status |
| `omit-leaks.ts` | `TS2339` | `Omit` removes the key, not just the visibility |
| `exclude-null.ts` | `TS2322` | `Exclude<MaybeString, null \| undefined>` is only `string` |
| `pick-extra-key.ts` | `TS2353` | `Pick` narrows the surface |
| `awaited-promise.ts` | `TS2339` | `ReturnType` of an async function is the `Promise`; `Awaited` unwraps it |
| `readonly-assign.ts` | `TS2540` | `Readonly<Config>` rejects writes at compile time |

A type-level guide is easy to write and hard to check, because nothing runs. That is
what `must-fail/` is for: the errors are the assertions.

Versions: Node 22.23.3, typescript 7.0.2, @types/node 20.x. Verified 2026-10-02 (function-shaped types and `Readonly` added; the first seven verified 2026-08-23 on Node 20.19.5).

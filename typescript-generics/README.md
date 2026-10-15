# 🧬 The generics from the guide, compiled and run

The code behind [TypeScript Generics: Practical Guide for React Developers](https://codingdunia.com/blog/typescript-generics-explained/).

```bash
npm install
npm test
```

TypeScript 7.0.2, pinned. The install pulls a compiler, so it is not instant.

## ✅ What it checks

Two halves, the same shape as the other TypeScript folders here.

`src/` compiles under `strict` and then **runs**. Every generic that carries a value
is executed with assertions on what it produces: the constraint that lets `indexById`
reach `.id`, the envelope that carries a payload type through `wrap` and back out of
`unwrap`, the state tuple whose setter follows its argument, and `NoInfer<T>` building
the palette the guide describes. A generic that only type-checks proves less than
people assume.

`must-fail/` is the half that matters more. Each file is compiled on its own and has
to fail with a specific diagnostic:

| File | Code | Why it must fail |
| --- | --- | --- |
| `constraint-missing.ts` | `TS2339` | drop `extends HasId` and the body cannot reach `.id` |
| `constraint-violation.ts` | `TS2322` | a `number` does not satisfy `HasId` |
| `mapped-readonly.ts` | `TS2540` | the mapped type really does add `readonly` to every key |
| `no-infer-mismatch.ts` | `TS2345` | `NoInfer<T>` stops `'green'` widening `T`, which is its entire purpose |

The codes are recorded because "this errors" is a weaker claim than "this errors for
the reason I said it did". If a future compiler changes the diagnostic, this folder
fails and the article gets corrected rather than quietly drifting.

## 🎯 Scope

The article is written for React developers, but nothing here imports React. The
claims being checked are type-level, and a render test would prove nothing about
`NoInfer` or a mapped type that a compiler run does not. `src/hook.ts` models the
generic hook as what it actually is once the framework is stripped away: a function
returning a tuple whose type follows its argument.

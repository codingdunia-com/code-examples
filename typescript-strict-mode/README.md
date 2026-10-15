# 🔒 Strict mode, one flag at a time

Every compiler flag from [The TypeScript Strict Mode Guide](https://codingdunia.com/blog/typescript-strict-mode-guide/)
as a pair of files: the version that compiles with strict off and fails with it on,
and the fix that passes.

```bash
npm install
npm test
```

## ✅ What it checks

| Flag | `before/` | Diagnostic | `after/` |
| --- | --- | --- | --- |
| `strictNullChecks` | `null-check.ts` | `TS18047` | narrows with `!== null` |
| `noImplicitAny` | `implicit-any.ts` | `TS7006` | types the parameter |
| `noUncheckedIndexedAccess` | `unchecked-index.ts` | `TS18048` | handles `undefined` |
| `useUnknownInCatchVariables` | `unknown-catch.ts` | `TS18046` | narrows with `instanceof Error` |

For each row the script compiles the `before/` file three ways and asserts all three
outcomes: clean with `--strict false`, failing with that exact diagnostic code once
the flag is on, and clean again for the `after/` file. Then it type-checks the whole
`after/` folder against `tsconfig.json`, which turns on `strict` plus
`noUncheckedIndexedAccess` together.

Asserting the diagnostic code, not just the exit status, is the part that matters.
It means this folder fails loudly if a future compiler release changes what a flag
reports, instead of quietly passing on the wrong error.

Versions: Node 20.19.5, typescript 7.0.2. Verified 2026-08-23.

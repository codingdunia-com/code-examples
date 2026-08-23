# satisfies, with the failures included

The examples from [The satisfies Operator in TypeScript](https://codingdunia.com/blog/typescript-satisfies-operator-guide/),
including the ones that are supposed to fail. A guide about a type operator is mostly
claims about what the compiler rejects, so the rejections belong in the test.

```bash
npm install
npm test
```

## What it checks

| File | Expected | Point |
| --- | --- | --- |
| `annotation-widens.ts` | `TS2345` | an annotation validates the shape and widens the literal |
| `no-annotation.ts` | compiles | no annotation means the `methdo` typo is never caught |
| `satisfies-preserves.ts` | compiles | `satisfies` validates and keeps `method` as `'GET'` |
| `satisfies-catches-typo.ts` | `TS2561` | the same typo, now caught at the declaration |
| `as-const-satisfies.ts` | compiles | readonly literals plus shape validation in one expression |
| `command-registry.ts` | compiles | `keyof typeof` yields `'build' \| 'deploy'` |
| `command-registry-unknown-key.ts` | `TS2322` | a name outside that union is rejected |

## The detail that trips people up

`satisfies` does not stop widening on its own. It stops the *annotation* from
widening, but the type you satisfy still supplies a contextual type, and if that
contextual type is plain `string`, the literal widens anyway:

```ts
interface RouteConfig { method: string; path: string }
const route = { method: 'GET', path: '/users' } satisfies RouteConfig;
// route.method is string, not 'GET'
```

Two things keep the literal. Either the satisfied type says something narrower than
`string` (here `RouteConfig.method` is `'GET' | 'POST' | 'PUT' | 'DELETE'`), or you
write `as const satisfies`. This folder uses the first, `as-const-satisfies.ts` shows
the second. Both are asserted, so neither claim rests on a screenshot.

Versions: Node 20.19.5, typescript 7.0.2. Verified 2026-08-23.

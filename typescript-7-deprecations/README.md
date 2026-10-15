# 🗑️ What TypeScript 7 removed, run against both compilers

The config changes described in [TypeScript 7 Migration Guide](https://codingdunia.com/blog/typescript-7-migration-guide/)
and [TypeScript 6 vs TypeScript 7](https://codingdunia.com/blog/typescript-6-vs-7-differences/),
as something you can execute rather than read.

```bash
npm install
npm test
```

Installs `typescript@6.0.3` and `typescript@7.0.2` side by side, then pushes the same
tsconfig through both and prints what each one says.

## ✅ What it checks

`legacy/tsconfig.json` uses three options TypeScript 7 deleted: `target: "es5"`,
`module: "amd"` and `moduleResolution: "node10"`. `fixed/tsconfig.json` is the
recommended TypeScript 7 config from the migration guide. Same source file in both.

| Run | Result |
| --- | --- |
| tsc 6 on `legacy/` | `TS5107`, one per deprecated option, exit 2 |
| tsc 6 on `legacy/` with `--ignoreDeprecations 6.0` | clean, exit 0 |
| tsc 7 on `legacy/` | `TS5108` "has been removed", exit 1 |
| tsc 7 on `fixed/` | clean, exit 0 |

The script asserts each of those and exits non-zero if a future compiler release
changes the answer.

## ✏️ One correction worth knowing

TypeScript 6 does not treat a removed-in-7 option as a warning that still builds.
It is a hard error, `TS5107`, and the build fails. What TypeScript 6 gives you is the
`ignoreDeprecations: "6.0"` escape hatch, which lets you keep shipping while you clean
up. TypeScript 7 has no equivalent. That is the real shape of the two-step upgrade:
version 6 makes the problem visible and lets you defer it, version 7 does not ask.

Versions: Node 20.19.5, typescript 6.0.3, typescript 7.0.2. Verified 2026-08-23.

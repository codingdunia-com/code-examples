# QUALITY.md lint, init and --fix, asserted

The commands from Adding QUALITY.md to an Existing Repo, run against the pinned
`quality.md@0.35.2` CLI (specification 0.12, Draft). Everything the article says the
CLI does or does not do is a check here, so a later release that changes the answer
fails this folder instead of quietly contradicting the article.

```bash
npm install
npm test
```

## What it checks

| Check | Expected |
| --- | --- |
| `qualitymd version --json` | `0.35.2` |
| `lint fixtures/valid.md` | exit 0, no findings |
| `lint fixtures/broken.md` | exit 1: `invalid-assessment`, `missing-criterion`, `unknown-factor`, plus the `missing-factor-description` warning |
| `lint --fix` on a copy of `broken.md` | file byte-identical, still exit 1 |
| `init` in a folder with `AGENTS.md` and `CLAUDE.md` | both files gain a pointer to `QUALITY.md` |
| `lint` on the untouched `init` template | valid, placeholders and all |
| a second `init` | refuses without `--force` |
| `init --minimal --no-agent-instructions` | `AGENTS.md` left alone |

## Notes

`npm install` pulls one platform binary as an optional dependency. On linux-x64 the
0.35.2 tarball is 36.8 MB and unpacks to 95.2 MB, which is worth caching in CI.
The CLI is labelled early alpha upstream; expect this folder to need a version bump.

---
title: demo-api
ratingScale:
  - level: target
    title: Target
    description: Good enough to ship.
    criterion: "Satisfies the requirement."
  - level: unacceptable
    title: Unacceptable
    description: Blocks a release.
    criterion: "Does not meet the requirement."
factors:
  type-safety:
    title: Type safety
    description: Public functions are typed so callers and agents get compiler feedback.
    requirements:
      no-implicit-any:
        title: no implicit any in src
        assessment: Run tsc with strict enabled and confirm zero errors under src/.
  testability:
    title: Testability
    description: Every exported function has a test an agent can run.
    requirements:
      exports-have-tests:
        title: every export has a unit test
        assessment: Compare exports in src/index.ts against test files in tests/.
---

# Quality model: demo-api

## Overview

A tiny TypeScript utility package used to try the QUALITY.md format.

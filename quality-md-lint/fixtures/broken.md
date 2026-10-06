---
title: demo-api
ratingScale:
  - level: target
    title: Target
    description: Good enough to ship.
  - level: unacceptable
    title: Unacceptable
    description: Blocks a release.
    criterion: "Does not meet the requirement."
factors:
  type-safety:
    title: Type safety
    requirements:
      no-implicit-any:
        title: no implicit any in src
requirements:
  readme-current:
    title: README matches the public API
    assessment: Compare README examples against src/index.ts exports.
    factors: [docs]
---

# Quality model: demo-api

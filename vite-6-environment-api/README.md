# Vite 6 Environment API

A single `vite.config.ts` defining three named environments (client, SSR, edge), each with its own `outDir` and `resolve.conditions`.

```bash
npx vite build --app
```

The `--app` flag tells Vite to build every named environment instead of just the default client target.

Full write-up: [Vite 6 Environment API: A Guide to Multi-Target Builds](https://codingdunia.com/blog/vite-6-environment-api-guide/)

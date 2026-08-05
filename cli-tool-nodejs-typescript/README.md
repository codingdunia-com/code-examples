# Node.js + TypeScript CLI Skeleton

A minimal CLI: `util.parseArgs()` for flags, a `try`/`catch` around the whole run function so exit codes are trustworthy, and native `.ts` execution (Node 23.6+, no build step, no ts-node/tsx).

```bash
npm link          # test locally: creates a global symlink to your local package
mycli --help       # now runs as a real command

npm test           # runs validate.test.ts via node --test
```

Full write-up: [Building a CLI Tool with Node.js and TypeScript](https://codingdunia.com/blog/building-cli-tool-nodejs-typescript/)

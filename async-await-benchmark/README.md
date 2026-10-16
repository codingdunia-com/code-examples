# ⏳ async/await, measured: parallel vs sequential, the cost of an await, and what crashes Node

The measurements behind [JavaScript Async/Await: Errors, Parallel Calls, Loops](https://codingdunia.com/blog/javascript-async-await-guide/).

```bash
npm test          # same as: node bench.mjs
node bench.mjs --only=2    # one part only (1 to 4), e.g. to re-measure the await cost alone
```

No dependencies. **Needs Node 22+** (global `fetch` backed by undici 6, which is what the
timings use). The whole script takes about 25 seconds.

## 📏 What it measures

**1. Latency, against a real server.** A `node:http` server on `127.0.0.1` answers every
request after 25 ms. Twenty requests through five strategies: an `await` in a `for` loop,
`Promise.all`, `Promise.allSettled`, and a worker pool of 5 and of 2. Nine rounds, strategies
interleaved. Then the same server gets 10 to 5,000 requests at once through `allSettled`, and
the failures are counted, next to a pool of 50 doing the same 5,000.

**2. The cost of one `await`.** One million iterations, best of five: a plain function call,
`await` on a plain value, `await` on an `async` function call, `await Promise.resolve(x)`, and the
same loop written with `.then()`.

**3. Microtask ticks.** A self-rescheduling microtask counts ticks while a promise settles. The
figure is the extra ticks compared with an already-resolved promise. Asserted: returning a
promise from an `async` function costs more ticks than `await`-ing it, and every `await` adds one.

**4. Error patterns, in child processes.** Each case runs in `node --input-type=module -e` and
the script reads the exit code. Eight cases, including: start two promises and `await` them in
order while the second fails first; the same through `Promise.all` and `Promise.allSettled`;
`forEach(async)` inside a `try/catch`; an un-awaited `async` call; and the same with a
`process.on('unhandledRejection')` listener. In-process: `return p` versus `return await p`
inside `try/catch`, `Promise.all` not cancelling the other work, and `forEach` not waiting.

Parts 3 and 4 assert exact results. Parts 1 and 2 assert only directions (sequential at least
10x slower than parallel, a pool in between, an `await` costing at least 5x a plain call),
because milliseconds move with the machine.

## 📈 What we measured

Node 22.23.3 (V8 12.4.254.21, undici 6.28.1), Apple M1 with 8 cores **shared with other jobs
the whole time** (load average 21 at the start of the last two runs, 25 to 45 in earlier ones),
2026-10-16. Median ms, run 1 / run 2, 20 requests at a 25 ms server delay:

| Strategy | Measured | Ideal |
| --- | ---: | ---: |
| `await` in a `for` loop | 556 / 564 | 500 |
| `Promise.all` | 32.2 / 33.9 | 25 |
| `Promise.allSettled` | 29.7 / 32.8 | 25 |
| pool, 5 at a time | 116 / 118 | 100 |
| pool, 2 at a time | 286 / 286 | 250 |

`Promise.all` was 17.3x and 16.6x faster than the loop (ideal 20x). The loop paid about 3 ms
per request on top of the server's 25, which is the HTTP round trip on loopback.

Burst of N requests at once through `Promise.allSettled`, run 1 / run 2 (a third and fourth run
and a first probe gave the same shape):

| Requests | Time | Failed |
| --- | ---: | ---: |
| 10 | 28.6 / 30.7 ms | 0 / 0 |
| 100 | 44.8 / 40.3 ms | 0 / 0 |
| 1,000 | 262 / 284 ms | 0 / 0 |
| 2,000 | 1,181 / 394 ms | 0 / 0 |
| 5,000 | 4,046 / 7,868 ms | 0 / 665 (`ETIMEDOUT`) |
| 5,000 through a pool of 50 | 3,187 / 3,371 ms | 0 / 0 |

The 5,000-request burst had failures in six of the seven runs I made (185 to 893 requests),
and a clean one in the seventh (a third complete run on a quieter machine, load 4, agreed with
the first two: 15.7x, 442 failures, await 38.1 ns and `.then()` 30.5 ns). Pool of 50: no failure in any run. What fails, and when, depends
on the machine and its load; that the burst is unreliable and the pool is not is the stable
result.

One `await`, best of five, ns per iteration (the two quietest runs; earlier, busier runs gave
up to 250 ns for the same code):

| Case | Run 1 / run 2 |
| --- | ---: |
| plain function call | 1.7 / 1.6 |
| `await` a plain value | 50.4 / 42.8 |
| `await` an `async` function call | 43.1 / 40.5 |
| `await Promise.resolve(x)` | 44.8 / 42.0 |
| same loop written with `.then()` | 35.8 / 34.9 |

Part 3 and part 4 results are identical in every run: `return p` costs 2 extra ticks, `return
await p` 1, three awaits 3, and `Promise.all` of one or of three promises 1. The un-awaited
rejection and the `forEach(async)` case both exit with code 1; the same failures through
`Promise.all`, `Promise.allSettled`, `for...of` or a `process.on('unhandledRejection')` listener
exit with code 0.

Your numbers will differ, and the burst failure threshold most of all. The exit codes and tick
counts should not.

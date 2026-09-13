# Cell Soup 0.9.2 — runtime stability and recovery

The old error banner suggested using a WebGPU-capable browser after every
failure, including failures in an already running world. Runtime errors now
retain their actual message, the world seed and simulation tick. Device loss
and GPU memory exhaustion have separate guidance. Secondary validation errors
cannot hide an earlier allocation failure.

Restarting after a failure releases the previous world and device before
requesting a replacement. Late errors from retired devices cannot stop a new
world. Failed initialization and readback paths now release their GPU buffers;
retired observer workers and event handlers are also detached. A failure in an
optional observer stays local to that observer. Rendering waits for GPU completion
before the next animation frame is queued, including while the soup is paused.

**Restart soup** begins again from the starting seed and settings. It does not
restore the evolved population after GPU memory has been lost. If the browser
itself cannot supply a replacement adapter, a browser restart can still be
necessary.

## Work limits for extreme crowds

Previously, several spatial scans followed every cell in nearby bins. A highly
concentrated population could turn these scans into quadratic work, and repeated
filtered queries could multiply the program's apparent instruction budget.

The runtime now permits at most 512 visited entities per physical contact scan,
1,024 spatial visits per cell's program tick, and 1,024 predicate instructions per
cell's program tick. These are fixed execution safety limits. Below the limits,
scan order and results are unchanged. Above them, contacts and sensors use
partial results and exhausted predicates stop matching; extreme crowd dynamics
are therefore approximate. The engine exposes cumulative `denseScanLimits`
and `queryBudgetLimits` counters for diagnostics.

## Validation and limits

Tests cover failed allocations, failed mappings, partial initialization, worker
retirement, stale device events and reconnecting after deliberate device loss.
Native GPU fixtures compare ordinary neighborhoods and linked motion against the
previous shader, and exercise concentrated populations and expensive filters.
A separate bounded soak tracks live GPU buffer allocations, host memory,
population accounting, genome reference counts and finite cell state.

The original browser crash has **not** been reproduced. These changes fix
identified cleanup and recovery defects and bound a plausible source of GPU
timeouts; they are not proof that every long-running browser or driver failure
has been eliminated. The native soak excludes browser rendering and observers,
which receive separate lifecycle tests and browser smoke checks.

Run the recovery test with `node research/gpu-recovery-check.mjs` and a soak with
`node --expose-gc research/gpu-runtime-memory-soak.mjs /tmp/cellsoup-soak.json 120`
on a machine with a working native WebGPU adapter.

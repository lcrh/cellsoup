# GPU workload and failure cleanup checks

The reported browser device loss has not been reproduced. The shader audit did find a concrete source of growing GPU work: legacy sensing and physical contacts traversed every cell in nearby spatial bins, even when those bins contained a large fraction of the population. Pure filters had a per-candidate limit but could multiply that cost across many candidates and VM instructions.

The safety limits are now:

- **512 visited cells per physical contact scan**, across all its spatial bins. Each of a cell's at most four linked-edge reaction scans has the same separate limit. Its direct spring forces still execute even if the contact scan reaches its limit.
- **1,024 visited candidates per cell per tick**, shared by legacy nearest-cell/corpse queries, corpse eating searches, stored-energy gradients, proximity listening, and composable neighborhood queries. The user-selected per-query candidate budget still applies as well.
- **1,024 predicate instructions per cell per tick**, shared by all filter invocations. Each individual predicate also retains its 64-instruction ceiling and pays its configured CPU cost.

Below the limits, scan order and results are unchanged. Above them, sensors and collision/link-contact forces use partial local information. In particular, an extremely crowded region can have asymmetric approximate contact reactions; this is a bounded fallback, not an exact dense-body solver. Exact connected-component sizes and direct spring forces are not truncated by these guards. The `queryBudgetLimits` and `denseScanLimits` diagnostic counters expose how often limits are reached. They count limit reaches, including cases where the last available candidate happens to fill a budget exactly.

Engine creation now releases already-created buffers if allocation, shader compilation, pipeline creation, or initial submission fails. Readbacks release their staging buffer after copy, mapping, range-access, or unmapping failures. `tests/gpu-resources.test.mjs` injects these failures and verifies cleanup. Engine stepping already awaited GPU queue completion on every call; there was no unbounded compute submission loop in that API.

## Reproduce the shader comparison

From the repository root, export the pre-fix shader from the last release. The exporter refuses to overwrite an existing file and uses the current repository's opcode metadata:

```sh
node research/export-baseline-shader.mjs 6fbfaa2 /tmp/cellsoup-before-guards.mjs
node research/gpu-work-limits-check.mjs /tmp/cellsoup-before-guards.mjs /tmp/cellsoup-work-limits-check.json
node --test tests/gpu-resources.test.mjs
```

The GPU comparison checks ordinary multi-cell sensing and linked motion against that shader, then runs finite synthetic crowds of 256, 1,024 and 4,096 cells and exercises the shared filter/legacy-query limits. Timing is a small synthetic diagnostic, not a sustained benchmark or proof of the user's browser failure. Avoid running other GPU experiments at the same time. The JSON report records the bounds, checked behavior and observed elapsed times.

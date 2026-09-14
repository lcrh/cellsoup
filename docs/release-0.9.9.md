# Cell Soup 0.9.9 — reliable colony resampling

A cell that unlinked and then relinked to the same neighbour in one tick could
create duplicate links on the other endpoint. The colony archive accepted
those links, but later reintroducing the body failed its stricter link check
and stopped the simulation.

Link creation now checks both endpoints before adding an edge. Link pruning
also removes duplicates, self-links and invalid handles. An unlink/relink
request may wait until the old edge has finished being removed.

Automatic colony capture independently keeps only unique, reciprocal links
between distinct living cells. Removed edges have their spring anchors cleared;
the original snapshot and valid link-slot geometry are preserved. Explicitly
supplied malformed colony observations still receive validation errors.

Validation: all 153 unit tests pass, including repeated archive replay after
malformed-edge cleanup. Native WebGPU checks pass for the reproduced failure,
link repair, ordinary linking and same-tick death, plus 53 lifecycle and six
body-resampling checks. The browser build starts and simulates without errors.

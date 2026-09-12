# Cell Soup 0.8.4

The main behavior panel now measures gzip compressibility of actual execution
paths from sampled living cells. It compares ordered and shuffled paths, records
instruction and branch destinations, and exports raw traces with their programs.
Sample averages also show mutation depth, tree depth, executed-code coverage and
varying branches. The coarse observer is off by default and remains accessible
as an experimental diagnostic.

These are candidate complexity measures with explicit failure cases: simple
loops compress well, random branching can appear varied, and tree or mutation
depth can grow without useful behavior. They do not control ecological selection.
The [method and limitations](execution-traces.md) describe the sampling, binary
encoding, controls, validation and next behavioral checks.

The optional trace buffer has fixed size independent of population capacity.
No action, energy, reproduction or mutation rule changes. The larger simulation
viewport and scrollable information panel are retained.

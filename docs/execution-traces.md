# Execution-trace compression and candidate complexity measures

The coarse eleven-model observer is now off by default and inside an experimental
disclosure. It learns aggregate spatial/temporal population patterns and can miss
behavior that depends on memory, sensory values or communication. It is not a
trusted evolutionary objective. Older recordings remain available as diagnostics.

The main measurement instead records **actual instruction paths** and compares
their gzip size with a shuffled control. This follows the compression approach in
[Turing Soup](https://github.com/lcrh/turingsoup/blob/main/wasm/src/lib.rs), whose
current implementation applies DEFLATE to sampled soup bytes. Cell Soup records
execution rather than just program contents. This is an inspectable candidate
proxy, not a replacement definition of epiplexity.

## Sampling and encoding

The GPU splits living cell slots into 32 pseudorandom buckets, then selects the
lowest hashed priority in each bucket. Hash collisions favor the lower slot.
This is a bounded, stratified sample, not an exactly uniform random sample of
individuals. Empty buckets contribute no cell. A changed seed refreshes selection
for each window. Each selected cell is followed for 256 consecutive physics ticks
(about 4.27 seconds); slot reuse cannot contribute a different cell's execution.
A new capture starts after a further 60 simulated seconds. Pausing does not
advance the window, and playback speed does not change its length.

Each attempted instruction has a four-byte event:

- byte 0: opcode;
- byte 1: program counter before the attempt;
- byte 2: program counter afterward, including a taken branch;
- byte 3: bit 0 means the instruction's CPU energy cost was paid and it executed;
  bit 1 means it yielded the VM.

Paying CPU cost does not imply that a requested ecological action succeeded.
Unaffordable instructions still advance the PC, so they are retained with a
clear status. Sleeping, dead or replaced cells have no events for that tick.

The compressed stream is cell-major: 256 frames per selected cell, each with a
one-byte attempt count followed by that many little-endian event words. Unused
GPU slots and event padding are removed. Cell identities, genotype IDs, program
text and absolute ticks are metadata, excluded from both measured byte streams.
All instruction attempts within the fixed VM budget are retained, up to 128 per
tick. The instrumentation uses approximately 4.23 MB of fixed GPU storage and the
same fixed readback size per capture, independent of population capacity.

The control shuffles whole events independently within each cell, then restores
the original frame lengths. It preserves each cell's event histogram, including
PCs and statuses, and every tick's attempt count. Thus both streams have the same
formatting and idle-time overhead. It removes ordering across the window, not
all temporal structure. It does not test communication between cells.

## Display and export

The panel reports compressed bits per original byte, the same value after
shuffling, and the fractional size saving relative to the shuffled control:
`(shuffled gzip bytes - ordered gzip bytes) / shuffled gzip bytes`. Savings may
be negative. A sample with no executed instructions receives no ordering score.

The downloadable `.json.gz` includes source programs, opcode names, per-cell raw
frames, the binary encoding description, engine configuration and measured
sizes. It is a compressed JSON container, so its file size differs from the
compressed binary stream used for the displayed numbers.

Compression uses the runtime's `CompressionStream("gzip")`. Browser and Node
implementations can choose different DEFLATE details and produce slightly
different sizes for identical input. Compare runs using the same implementation.
The browser export was decoded and recomputed independently in Node: event counts
and raw sizes matched; compressed sizes differed slightly. This is recorded as
an implementation limitation, not hidden as exact cross-runtime reproducibility.

Additional sampled-cell averages report mutation depth, tree depth, executed
instruction coverage and the number of conditional branches that took multiple
next-PC paths. Mutation depth is archive-mutation ancestry; it does not count
all generations or establish accumulated adaptation. Tree depth includes dead
code. A varying branch can be driven by random values or an internal counter,
and does not establish perception. These are separate cross-checks, not weighted
into an arbitrary universal score.

## Failure cases and the next measurement loop

The calibration explicitly demonstrates that a short repeated loop compresses
very strongly. Random instruction paths have little extra benefit from their
ordering. Neither should be ranked as sophisticated living behavior merely from
these results. In a browser recording, 88,103 executed instructions compressed
from 360,604 binary bytes to 2,852 gzip bytes, versus 91,785 after shuffling: a
96.9% saving from ordering. A separate initial random-founder sample already
showed a 96.5% ordering saving, zero mean mutation depth and 12 varying branches.
That demonstrates repeated execution of short programs; neither high savings
nor varying branches establish evolved sophistication. The compressed
[browser recording](../research/results/execution-trace-browser.json.gz) and
[initial-founder recording](../research/results/execution-trace-initial.json.gz)
are retained for inspection.

Registers, sensor values, action magnitudes and external physics are excluded
from this first path recorder. A body can change its movement through a changing
sensor value while executing exactly the same instruction sequence. Distributed
computation can therefore be missed. Conversely, adding useless branches can
make paths look richer. The proposed refinement loop must test those failures.

Useful next checks are whether disrupting linked communication, memory or sensing
reduces a colony's ability to maintain itself, reproduce or move toward resources,
with matched controls for cost and instruction timing. Find evolved examples,
compare them with inert loops and random branching, then evaluate candidate
metrics against those behavioral distinctions before tuning toward them. Keep
rechecking the behavior after tuning to detect score exploitation.

Validation: 97 Node tests; 52 GPU lifecycle regressions; direct GPU trace checks
of exact instruction/PC order, fixed recording windows, identical traced versus
untraced state, unaffordable instructions and slot reuse; lossless gzip and
histogram-preserving shuffle tests; and live browser recording/export checks.

## Causal calibration: a demonstrated blind spot

A [controlled sensory replay](../research/sensory-complexity.md) found two natural
programs that reach brighter light when their directional sensor works. For one,
mean encountered sunlight is 0.799 versus 0.500 with that sensor zeroed, and final
energy is 28.8% higher. Yet every paired 256-tick path is byte-for-byte identical.
A common sensor-using swimmer instead loses light exposure. These observed cases
confirm that instruction-path compression cannot measure the usefulness of
values flowing through an otherwise fixed program. The raw paired recordings,
matched intervention and authored positive/negative controls are retained.

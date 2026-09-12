# 0.8.1 — visible energy sharing

Completed energy gifts now appear as green arrows with Activity enabled. The
arrows point from donor to recipient and read the last simulated tick directly
from GPU buffers. Recycled cell slots cannot inherit an old arrow. Stored-reserve
diffusion is still represented by the ordinary links.

This follows three hour-long evolutionary runs and a controlled regrowth assay
of a naturally generated colony. Disabling its energy transfer strongly reduced
reproduction in bright light. See the [experiment and limits](../research/continuous-evolution.md).

Random founders, the tree sampler, division mutation, and ecological defaults
are unchanged. Research runs now preserve progress and whole-colony observations.

Validation: 77 Node tests, three real GPU rendering checks, successful static
build, and a running browser preview with no reported errors. The render checks
cover completed gifts, Activity visibility, and source/recipient slot reuse.

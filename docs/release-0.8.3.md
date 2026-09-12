# Cell Soup 0.8.3

The GPU page now records coarse whole-world behavior and displays an explicit
behavioral epiplexity estimate. It fits eleven bounded predictors and selects
one by model-description bits plus prediction cost on a separate selection
block. The displayed structural bits match an actual compact binary model code.
A final unseen block measures prediction error; shuffled recordings provide a
separate baseline. The panel shows the trend and exports recordings, models,
candidate scores and habitat settings for inspection.

The simulation retains a large viewport, with statistics, display controls and
behavior measurements in a separately scrollable panel underneath. The desktop
inspector scrolls independently.

The observer samples every two simulated seconds, using a 32-frame rolling
window. Sampling follows physics ticks at every playback speed and uses a fixed
36 KB GPU readback. Fitting runs in a worker. Measurement can be switched off;
restarting it or starting a new world clears its history. Cell colors, genome
identifiers and the camera are excluded.

This is a finite-observer estimate, not a universal complexity or intelligence
score. It can detect learnable physics and population changes as well as living
organization. The documentation gives the encoding, data splits, controls,
calibration results and limitations. No evolutionary rule or fitness criterion
is changed.

Validation: 90 automated tests; three real GPU checks of read-only sampling,
reciprocal links, state-buffer parity, stale/dead activity and hue independence;
five calibrated signal families; a three-minute autonomous recording; and live
browser checks of estimation, pausing and restarting measurement.

[Full measurement specification](behavioral-epiplexity.md).

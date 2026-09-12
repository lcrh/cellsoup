# 0.8.8 — defined directions at zero distance

Linking cells whose centers coincide could write a NaN spring anchor on Metal.
The anchor bypassed register cleanup and could subsequently contaminate physics.
Flat sunlight gradients also returned an extreme register value instead of the
promised zero. Both came from evaluating an undefined direction of a zero vector.

Relative target bearings and flat sunlight gradients now return zero without
evaluating the angle. Coincident links use the initiating cell's heading as a
shared axis, with opposite spring endpoints. This remains relative to the cells:
rotating the cells rotates that fallback axis. Ordinary nonzero bearings and
spring geometry retain their existing calculation. These changes do not repair
an already contaminated world; start a fresh world after loading the release.

Thirteen native GPU checks cover flat sunlight, absent storage gradients, self-bearing,
three rotated coincident-link cases over 120 ticks, separation after overlap,
ordinary target/sunlight bearings and the periodic seam. The old shader reproduces NaN
anchors at coincidence and −999999 in flat/zero-bearing registers. The fixed
shader returns finite anchors and zero sensor readings. All 52 existing GPU
lifecycle checks, 12 division-mutation cases and 106 Node tests pass; the static
site build passes.

[GPU regression evidence](../research/results/zero-direction-check.json).
A structural-resampling world previously failed a non-finite-state census. The
original runner did not retain its failing state, so this reproduction is a
plausible cause rather than a confirmed diagnosis of that particular world.

# Cell Soup 0.9.10 — touch navigation

Pinch the habitat with two fingers to zoom. The world stays anchored under the
moving midpoint, so the same gesture also pans. One-finger dragging still pans,
and a tap still selects a cell. Pinching turns off colony following; releasing
either finger continues smoothly as a pan without selecting a cell.

Cancelled touches and lost pointer capture are cleaned up. Zoom limits and
desktop wheel behavior are unchanged. Touch gestures are handled only on the
canvas, leaving the surrounding page available for normal scrolling.

Validation: 157 unit tests pass, including gesture sequences for pinch anchoring,
zoom limits, coincident fingers, cancellation, transitions to one finger, taps
and desktop navigation. The browser starts without errors at a 390-pixel phone
viewport. Physical-device multi-touch was not available in this test environment.

# Cell Soup 0.8.2

Explicit energy gifts now travel through reciprocal links up to their normal
65-unit breaking distance. A stretched colony can therefore keep sharing usable
energy even when its cells are outside the 18-unit contact range. Direct gifts
to unconnected cells and attacks still require that contact range. Recipient
capacity, the donor reserve and conservative transfer accounting are unchanged.
Unlinking before giving prevents a long-range gift from that source.

Typed trees remain the default, founders remain fully random, archive arrivals
remain individual cells, and ordinary division copies the genome without
mutation. The research-only conditional-insertion mutation and colony-fragment
resampling experiments are not enabled in the browser.

The release includes [controlled regrowth experiments](../research/propagule-experiments.md)
with a naturally generated giving genotype. In dim light, three captured
connected fragments reached approximately 4096 living cells with linked gifts;
the same disconnected or zero-gift controls stayed at eight. This is evidence
for the link-range correction, not a claim about general evolutionary complexity
or long-term ecological balance.

Validation covers direct, reciprocal, unilateral, broken-distance and removed
links, contact-only attacks, energy conservation, GPU rendering and the existing
lifecycle and classic-engine suites. The raw results and fixture extraction tools
are included for reproduction.

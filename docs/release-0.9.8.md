# Cell Soup 0.9.8 — shared shields

Barrier strength now diffuses automatically across reciprocal links between
living cells. Each tick transfers a configurable fraction of the difference
between linked cells, using the previous tick's state for all transfers.

**Barrier sharing / tick** defaults to 0.12 and ranges from 0 to 0.25. Zero
disables sharing. Random worlds vary this setting independently of reserve
sharing. Shield points spread through a colony over successive ticks; they
are not instantly pooled across the whole connected organism.

Sharing conserves total barrier strength, within floating-point precision,
before ordinary construction, upkeep, attack damage and death. It costs no
additional usable energy. Each cell maintains its resulting barrier, and
newly received protection can absorb attacks in the same tick. Corpses,
unlinked cells and nonreciprocal links do not participate.

The change uses an existing spare settings field and the ordinary cell update;
it adds no GPU buffers or simulation passes.

Validation: seven focused GPU checks, 53 lifecycle checks and all 150 unit
tests pass. The browser exposes the randomized sharing control and runs without
console errors.

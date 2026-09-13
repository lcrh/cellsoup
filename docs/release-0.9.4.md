# Cell Soup 0.9.4 — room for colonies

Impossible division attempts now let a cell keep executing its program. This
covers insufficient energy, no free link for budding, and no available birth
slots, including slots reserved for newcomers. Feasible attempts still pause
for synchronized allocation; competing births can still fail. Instruction
costs and the division energy requirement remain in force.

Random worlds keep the full founder grammar available: maximum depth six and
one to six randomly sampled top-level actions. No action or organism is guaranteed.
Manual generation controls remain available. The audit found that the previous
randomized limits frequently produced very short programs, reducing the supply
of genomes combining energy collection, reproduction, and movement.

Sunny worlds now choose photosynthesis input together with energy losses,
division costs, and the logarithmic fill scale. The generator leaves an idealized
at least 0.5 energy/second surplus at the division threshold under 70% sunlight, before
heat, computation, action cadence, or other costs. Input is rounded to half-unit
steps and capped at 20; extreme combinations use a gentler fill curve to fit
that limit. This is a tuning rule, not a guarantee of survival or cooperation.
Sunless energy settings and other seeded ecological settings remain unchanged.

Both logarithmic energy pools, energy-weighted replacement, thermal pressures,
random founders, mutations, and optional language features remain part of the
simulation. Existing seed links use the new generation rules; customized
settings retain their explicit overrides.

See the [structure audit](../research/structure-regression-audit.md) for the
controlled comparisons, captured colonies, limitations, and reproduction steps.

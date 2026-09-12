# Cell Soup 0.8

The GPU laboratory now defaults to randomly generated typed Lisp trees.
Assembly remains selectable. It is available at `/gpu.html`; the original
WASM laboratory remains at the site root.

- Random arrivals continue at a constant rate and replenish low populations.
  Archived successes can produce two-parent subtree crossovers. Crossover and
  subsequent resampling mutation have separate controls; division copies the
  genome exactly.
- Named numeric `state`, `let`, and `set!` forms support computation across
  evaluations. Division inherits values; new arrivals initialize fresh.
  The inspector shows the program, direct parents, and eight memory values.
- Explicit photosynthesis operates under slowly drifting cloud shadows.
  Cells keep short-lived local energy and linked reserves. Attacks damage
  energy; dead cells leave slowly decaying, edible corpses.
- Sunlight and activity generate heat, crowding slows cooling, and links
  conduct heat. Overheating drains usable energy.
- Spring links act as soft barriers. Colliding cells push back on their
  endpoints, including across world edges. Fast crossings remain possible.

The release passed 74 language, classic-engine, and worker tests, 51 actual
GPU checks, and a short autonomous named-state trial. The deployment workflow
also rebuilds and runs the classic engine's soak test.

This remains an experimental ecology. Older assembly trials demonstrated
reproduction after immigration stopped; the first tree comparison retained
fewer survivors. Neither sustained predator/prey dynamics nor useful evolved
recurrent computation has been established. In the named-state trial, none of
the twelve recorded leading genomes reads its user memory values, despite some
having state declarations or writes. See the [state-use audit](../research/results/state-use-audit.json)
and [tree notes](../research/typed-trees.md) for the measured scope.

Execution and physics remain on the GPU; tree arrivals are created and compiled
on the CPU once per simulated second. Performance depends on population density,
genome complexity, hardware, and browser activity. The maximum configurable
capacity is not a claim of demonstrated performance at that size.

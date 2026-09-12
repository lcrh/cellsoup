# Energy sharing under clouds and introduced non-givers

This follow-up uses the naturally generated energy-sharing genome 15333 described
in [continuous-evolution.md](continuous-evolution.md). It tests where its benefit
breaks down, then asks whether the existing language can express a conditional gift.

Each trial starts four fresh cells in an explicitly constructed star with 24
energy each, zero reserves, normal action costs and physics, no immigration or
mutation, and 4,096 entity slots. The central cell has three links; its `c2`
points to leaf 3. The non-giver differs from the original by one bytecode
instruction that sets the gift fraction to zero. In mixed trials either leaf 3
or leaf 1 is replaced with this non-giver. These are deliberately founded
chimeras, not naturally observed invasions or restarts of the captured colony.

## Ordinary gifts

Final living counts after 600 simulated seconds are shown as giver / non-giver.

| Light  | Seed | Four givers | Four non-givers | Non-giver in recipient slot | Non-giver in other slot |
| ------ | ---: | ----------: | --------------: | --------------------------: | ----------------------: |
| full   |   42 |        4096 |              15 |                      15 / 9 |                4088 / 8 |
| full   |   97 |        4095 |              15 |                    4087 / 9 |                4088 / 8 |
| full   |  321 |        4096 |              15 |                   4085 / 10 |               4080 / 16 |
| clouds |   42 |         314 |               8 |                      0 / 12 |                 365 / 1 |
| clouds |   97 |        2524 |              15 |                   1080 / 12 |               4079 / 16 |
| clouds |  321 |          20 |               5 |                       1 / 2 |                   2 / 4 |

Giver monocultures outgrew non-giver monocultures in all six light/seed cases.
Under clouds, placing the non-giver in the direct recipient position prevented
any giver births in seeds 42 and 321. Placement therefore matters in these
fixtures. Each condition has only one trajectory per seed, and GPU contention
can make same-seed repeats differ; this is not a universal invasion result.

## A matched conditional-gift test

Two authored controls wrap only the gift action:

```lisp
(if (alive (bond c2)) (give (bond c2) (bonds)) (nop))
(if (kin   (bond c2)) (give (bond c2) (bonds)) (nop))
```

Both compile to 23 instructions instead of the original 18. The compiled
controls differ only in the sensed field. `kin` tests exact genome-slot identity,
not approximate ancestry. Branch choice can still change executed instruction
counts and timing. These hand-written controls are language tests and are never
injected into the random evolutionary population.

| Seed | Alive guard: four givers | Kin guard: four givers | Alive guard: recipient non-giver | Kin guard: recipient non-giver |
| ---- | -----------------------: | ---------------------: | -------------------------------: | -----------------------------: |
| 42   |                      346 |                    160 |                            0 / 6 |                          2 / 0 |
| 97   |                     2924 |                   4095 |                         239 / 12 |                         76 / 4 |
| 321  |                       17 |                      5 |                            1 / 2 |                          6 / 2 |

The kin guard reduced non-giver births from 25, 11, and 4 to 1, 3, and 1.
Giver births changed from 0, 268, and 0 to 3, 74, and 3. It restricted the
introduced non-giver but did not consistently restore cooperative growth.
The monoculture results also vary widely. This does not justify seeding a
kin-giving template or declaring a successful evolved defense.

## Reproduce

```sh
node research/colony-invasion-probe.mjs research/results/colony-gift-probe.json research/results/replay-invasion.json
node research/colony-invasion-probe.mjs research/results/colony-gift-probe.json research/results/replay-alive.json alive clouds giving,recipient-invader
node research/colony-invasion-probe.mjs research/results/colony-gift-probe.json research/results/replay-kin.json kin clouds giving,recipient-invader
```

Raw results: [ordinary gifts](results/colony-invasion-probe.json),
[alive guard](results/colony-guard-alive.json), and
[kin guard](results/colony-guard-kin.json). Each includes full configurations,
founder fixtures, kernel fingerprints, sample histories, and completion flags.
Population ledgers and genome references were checked; no GPU errors occurred.

New colony observations preserve four positional `linkSlots`, including empty
holes, as well as spring anchors and rest lengths. Earlier observations retain
only condensed adjacency, which is sufficient for topology plots but cannot
reconstruct which target `(bond c2)` selected. These remain inspection records,
not complete restart files.

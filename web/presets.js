export const PRESETS = {
  colony: {
    name: "Branching colony",
    description:
      "Connected daughters turn away, share energy, and grow into a loose tissue.",
    source: `; A shared genome, a branching body.
color 158
tag 1
shield 0.3
loop:
  sense r0 energy
  jlt r0 82 rest
  sense r1 bonds
  jgt r1 2 rest
  bud r2
  jeq r2 1 daughter
  turn 71
  jmp rest
daughter:
  turn 115
rest:
  wait 12
  jmp loop`,
  },
  grazer: {
    name: "Wandering grazers",
    description:
      "Compare food to the left and right, steer toward it, and divide when well fed.",
    source: `color 196
tag 2
loop:
  sense r0 left
  sense r1 right
  jgt r0 r1 leftward
  turn 12
  jmp forage
leftward:
  turn -12
forage:
  move 0.6
  sense r0 energy
  jlt r0 90 rest
  split r2
  jeq r2 1 daughter
  jmp rest
daughter:
  turn 90
rest:
  wait 3
  jmp loop`,
  },
  predator: {
    name: "Selective predators",
    description:
      "Hunt public tag 2, close the distance, then steal. Prey can evolve shields or change tags.",
    source: `color 12
tag 3
hunt:
  scan r0 2 360
  jz r0 wander
  peek r1 r0 bearing
  turn r1
  move 1
  steal r0 3
  sense r2 energy
  jlt r2 100 rest
  split r3
  jmp rest
wander:
  turn 17
  move 0.5
rest:
  wait 2
  jmp hunt`,
  },
  pulse: {
    name: "Pulsing tissue",
    description:
      "Grow connected cells, then rhythmically shorten and relax their spring bonds.",
    source: `color 285
tag 4
shield 0.6
loop:
  sense r0 energy
  jlt r0 90 beat
  sense r1 bonds
  jgt r1 2 beat
  bud r2
  turn 110
beat:
  contract 0.6
  emit 0 1
  wait 24
  contract 1.3
  wait 24
  jmp loop`,
  },
  sentinel: {
    name: "Signaling defenders",
    description:
      "Shielded grazers broadcast nearby strangers; neighbors listen and turn away.",
    source: `color 52
tag 2
shield 0.9
loop:
  scan r0 -1 360
  jz r0 listen
  peek r1 r0 kin
  jnz r1 listen
  emit 1 3
listen:
  listen r2 1
  jlt r2 0.5 feed
  turn 65
feed:
  move 0.4
  sense r3 energy
  jlt r3 100 rest
  split r4
rest:
  wait 5
  jmp loop`,
  },
};

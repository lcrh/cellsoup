## Variant 2462: 8 living, 8 births

Harvest 1327.91015625, depth 1.

```asm
L0: abs r7 0
L1: turn r3
L2: photosynthesize r0
L3: bond r1 60
L4: jnz 3 L14
L5: color r7
L6: receive r4 r0 r7
L7: split r1
L8: div r1 120
L9: scan_color r3 r7 10
L10: photosynthesize r5
L11: photosynthesize r0
L12: tag 25
L13: div r2 25
L14: jnz -1 L27
L15: jnz r4 L12
L16: add r2 r3
L17: turn 5
L18: scan_corpse r5 25
L19: photosynthesize r3
L20: mod r2 60
L21: store r2 0.25
L22: mod r0 0
L23: tag 1
L24: bud r3
L25: split r6
L26: mul r0 r4
L27: split r3
L28: eat r7
L29: nop
L30: scan_corpse r1 360
L31: jz r6 L20
L32: rand r3 r2
L33: move 2
L34: rand r4 0
```

## Variant 1466: 5 living, 214 births

Harvest 21914.84375, depth 0.

```asm
L0: abs r7 0
L1: turn r3
L2: photosynthesize r0
L3: bond r1 60
L4: jnz 3 L14
L5: color r7
L6: receive r4 r0 r7
L7: split r1
L8: div r1 120
L9: scan_color r3 r7 10
L10: photosynthesize r5
L11: photosynthesize r0
L12: tag 25
L13: div r2 25
L14: jnz -1 L27
L15: jnz r4 L12
L16: add r2 r3
L17: turn 5
L18: scan_corpse r5 25
L19: photosynthesize r3
L20: mod r2 60
L21: store r2 0.25
L22: mod r0 0
L23: tag 1
L24: bud r3
L25: split r6
L26: bud r4
L27: split r3
L28: eat r7
L29: nop
L30: scan_corpse r1 360
L31: jz r6 L20
L32: rand r3 r2
L33: move 2
L34: rand r4 0
```

## Variant 2697: 3 living, 4 births

Harvest 234.2265625, depth 1.

```asm
L0: mov r7 120
L1: shield -1
L2: nop
L3: mod r2 120
L4: eat r3
L5: emit 90 r4
L6: listen r2 60
L7: send r0 r7 2
L8: attack r1 0
L9: move 10
L10: receive r5 r4 25
L11: split r0
L12: mov r3 60
L13: attack 120 120
L14: color 120
L15: abs r5 90
L16: storage_gradient r3 r7 0.5
L17: color 2
```

## Variant 2670: 3 living, 2 births

Harvest 210.63671875, depth 1.

```asm
L0: abs r7 0
L1: turn r3
L2: photosynthesize r0
L3: bond r1 60
L4: min r2 90
L5: color r7
L6: receive r4 r0 r7
L7: split r1
L8: div r1 120
L9: scan_color r3 r7 10
L10: photosynthesize r5
L11: photosynthesize r0
L12: tag 25
L13: div r2 25
L14: jnz -1 L27
L15: jnz r4 L12
L16: add r2 r3
L17: turn 5
L18: scan_corpse r5 25
L19: photosynthesize r3
L20: mod r2 60
L21: store r2 0.25
L22: mod r0 0
L23: tag 1
L24: bud r3
L25: split r6
L26: bud r4
L27: split r3
L28: eat r7
L29: nop
L30: scan_corpse r1 360
L31: jz r6 L20
L32: rand r3 r2
L33: move 2
L34: rand r4 0
```

## Variant 2652: 3 living, 3 births

Harvest 328.55078125, depth 1.

```asm
L0: bud r5
L1: unlink 0
L2: peek r2 r6 bonds
L3: photosynthesize r0
L4: move 2
L5: sub r2 90
L6: nop
L7: emit r2 r3
L8: emit 5 10
L9: send 0.25 r0 120
L10: attack r1 r6
L11: eat r6
L12: scan_color r1 -1 1
L13: link 3
L14: bond r4 0.25
```

## Variant 2662: 2 living, 3 births

Harvest 245.09765625, depth 1.

```asm
L0: abs r7 0
L1: turn r3
L2: photosynthesize r0
L3: bond r1 60
L4: jnz 3 L14
L5: color r7
L6: receive r4 r0 r7
L7: split r1
L8: div r1 25
L9: scan_color r3 r7 10
L10: photosynthesize r5
L11: photosynthesize r0
L12: tag 25
L13: div r2 25
L14: jnz -1 L27
L15: jnz r4 L12
L16: add r2 r3
L17: turn 5
L18: scan_corpse r5 25
L19: photosynthesize r3
L20: mod r2 60
L21: store r2 0.25
L22: mod r0 0
L23: tag 1
L24: bud r3
L25: split r6
L26: bud r4
L27: split r3
L28: eat r7
L29: nop
L30: scan_corpse r1 360
L31: jz r6 L20
L32: rand r3 r2
L33: move 2
L34: rand r4 0
```

## Variant 2197: 2 living, 1 births

Harvest 211.0625, depth 0.

```asm
L0: turn 1
L1: shield r5
L2: jmp L6
L3: scan r0 r0 0.75
L4: jeq 360 r5 L3
L5: mod r4 r2
L6: split r6
L7: photosynthesize r3
L8: jgt 1 0.25 L4
L9: mov r0 90
L10: store r3 120
L11: min r2 25
L12: attack 10 r4
L13: jgt 360 3 L0
```

## Variant 2413: 2 living, 1 births

Harvest 334.98046875, depth 0.

```asm
L0: abs r7 0
L1: turn r3
L2: photosynthesize r0
L3: bond r1 60
L4: jnz 3 L14
L5: color r7
L6: receive r4 r0 r7
L7: split r1
L8: div r1 120
L9: scan_color r3 r7 10
L10: photosynthesize r5
L11: photosynthesize r0
L12: tag 25
L13: div r2 25
L14: jnz -1 L27
L15: jnz r4 L12
L16: add r2 r3
L17: turn 5
L18: scan_corpse r5 25
L19: photosynthesize r3
L20: mod r2 60
L21: store r2 0.25
L22: mod r0 0
L23: tag 1
L24: bud r3
L25: split r6
L26: bud r4
L27: split r3
L28: eat r7
L29: nop
L30: scan_corpse r1 360
L31: jz r6 L20
L32: rand r3 r2
L33: move 2
L34: rand r4 0
```

## Variant 2315: 2 living, 11 births

Harvest 1453.33984375, depth 1.

```asm
L0: abs r7 0
L1: turn r3
L2: photosynthesize r0
L3: bond r1 60
L4: jnz 3 L14
L5: color r7
L6: receive r4 r0 r7
L7: split r1
L8: div r1 120
L9: scan_color r3 r7 10
L10: photosynthesize r5
L11: photosynthesize r0
L12: tag 25
L13: div r2 25
L14: jnz -1 L27
L15: jnz r4 L12
L16: add r2 r3
L17: turn 5
L18: scan_corpse r5 25
L19: photosynthesize r3
L20: mod r2 60
L21: store r2 0.25
L22: mod r0 0
L23: tag 1
L24: mobilize r6 0.1
L25: split r6
L26: bud r4
L27: split r3
L28: eat r7
L29: nop
L30: scan_corpse r1 360
L31: jz r6 L20
L32: rand r3 r2
L33: move 2
L34: rand r4 0
```

## Variant 2777: 2 living, 1 births

Harvest 31.57421875, depth 1.

```asm
L0: photosynthesize r6
L1: shield 0.25
L2: emit r0 5
L3: storage_gradient r0 r6 -1
L4: rand r7 0
L5: eat r2
L6: move 90
L7: bond r1 1
L8: bond r2 0.1
L9: attack 0.25 0.25
L10: min r0 0.1
L11: gradient r3 r6
L12: peek r1 1 bearing
L13: eat r6
L14: gradient r1 r7
L15: attack r6 0.75
L16: scan r6 r3 0.75
L17: bond r5 60
L18: eat r3
L19: jz 3 L27
L20: abs r4 r2
L21: jlt 0.25 r7 L9
L22: add r5 0.5
L23: mul r1 r5
L24: sub r6 3
L25: add r3 0.5
L26: unlink 0.25
L27: eat r3
L28: min r1 25
L29: jlt 90 0.75 L13
L30: abs r7 25
L31: tag 0
L32: storage_gradient r6 r6 120
L33: attack -1 60
L34: tag 2
L35: listen r6 -1
L36: bond r5 0.1
L37: store r4 0
L38: bud r5
L39: shield 0.25
L40: div r1 1
```

## Variant 2723: 2 living, 1 births

Harvest 118.74609375, depth 1.

```asm
L0: abs r7 0
L1: turn r3
L2: photosynthesize r0
L3: bond r1 60
L4: jnz 3 L14
L5: color r7
L6: receive r4 r0 r7
L7: split r1
L8: div r1 120
L9: scan_color r3 r7 10
L10: photosynthesize r1
L11: photosynthesize r0
L12: tag 25
L13: div r2 25
L14: jnz -1 L27
L15: jnz r4 L12
L16: add r2 r3
L17: turn 5
L18: scan_corpse r5 25
L19: photosynthesize r3
L20: mod r2 60
L21: store r2 0.25
L22: mod r0 0
L23: tag 1
L24: bud r3
L25: split r6
L26: bud r4
L27: split r3
L28: eat r7
L29: nop
L30: scan_corpse r1 360
L31: jz r6 L20
L32: rand r3 r2
L33: move 2
L34: rand r4 0
```

## Variant 2758: 2 living, 1 births

Harvest 85.15625, depth 1.

```asm
L0: bud r5
L1: unlink 0
L2: peek r2 r6 bonds
L3: photosynthesize r0
L4: move 2
L5: jnz r7 L0
L6: nop
L7: emit r2 r3
L8: emit 5 10
L9: send 0.25 r0 120
L10: attack r1 r6
L11: eat r6
L12: scan_color r1 -1 2
L13: link 3
L14: bond r4 0.25
```

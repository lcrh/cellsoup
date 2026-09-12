## Variant 10408: 1934 living, 2586 births

Harvest 833037.47265625, depth 1.

```asm
L0: div r1 r6
L1: bud r1
L2: give 360 r3
L3: storage_gradient r3 r6 60
L4: photosynthesize r7
L5: storage_gradient r3 r4 r1
L6: eat r5
L7: move 360
L8: abs r2 r1
```

## Variant 9574: 943 living, 1322 births

Harvest 463708.60546875, depth 0.

```asm
L0: nop
L1: photosynthesize r0
L2: turn 0.1
L3: max r1 360
L4: unlink 360
L5: min r0 r1
L6: eat r0
L7: tag 10
L8: abs r5 5
L9: move 0.75
L10: mobilize r6 r3
L11: eat r5
L12: sense r6 color
L13: storage_gradient r3 r0 r1
L14: sense r4 crowding
L15: jgt 0 0.75 L3
L16: photosynthesize r3
L17: jz 1 L8
L18: eat r2
L19: receive r2 r7 r7
L20: move 2
L21: peek r6 r7 distance
L22: photosynthesize r6
L23: bud r4
L24: mobilize r6 0
L25: scan_corpse r1 0.25
L26: jnz 2 L39
L27: jz 0.5 L3
L28: wait 90
L29: rand r5 120
L30: shield 1
L31: send r7 -1 2
L32: receive r7 r5 0
L33: scan_corpse r4 120
L34: jnz r1 L21
L35: color 60
L36: move 120
L37: store r7 120
L38: shield 0.25
L39: scan_corpse r5 r7
L40: sub r7 r0
```

## Variant 4357: 799 living, 1945 births

Harvest 589618.35546875, depth 0.

```asm
L0: nop
L1: photosynthesize r0
L2: turn 0.1
L3: max r1 360
L4: unlink 360
L5: min r0 r1
L6: eat r0
L7: tag 10
L8: abs r5 5
L9: move 0.75
L10: mobilize r6 r3
L11: eat r5
L12: sense r6 color
L13: storage_gradient r3 r0 r1
L14: sense r4 crowding
L15: jgt 0 0.75 L3
L16: photosynthesize r3
L17: jz 1 L8
L18: eat r2
L19: receive r2 r7 r7
L20: move 2
L21: peek r6 r7 distance
L22: photosynthesize r6
L23: bud r4
L24: mobilize r6 0
L25: scan_corpse r1 0.25
L26: jnz 2 L39
L27: jz 0.5 L3
L28: wait 90
L29: rand r5 120
L30: shield 1
L31: send r7 -1 2
L32: receive r7 r5 0
L33: scan_corpse r4 120
L34: jnz r1 L21
L35: color 60
L36: move 120
L37: store r7 120
L38: shield 0.25
L39: scan_corpse r5 r7
L40: sub r7 r0
```

## Variant 8913: 592 living, 759 births

Harvest 266048.65625, depth 0.

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

## Variant 9980: 560 living, 1288 births

Harvest 278623.390625, depth 1.

```asm
L0: tag r6
L1: attack 0 r1
L2: scan_corpse r5 5
L3: scan_corpse r7 r3
L4: shield r1
L5: move 0.25
L6: mov r3 10
L7: nop
L8: photosynthesize r1
L9: color 90
L10: add r6 0.25
L11: split r2
L12: jeq r1 3 L6
L13: eat r1
L14: give 360 r3
L15: min r6 r6
L16: gradient r6 r1
```

## Variant 2770: 544 living, 786 births

Harvest 213783.2578125, depth 0.

```asm
L0: tag r6
L1: gradient r7 r4
L2: scan_corpse r5 5
L3: scan_corpse r7 r3
L4: shield r1
L5: move 0.25
L6: mov r3 10
L7: nop
L8: photosynthesize r1
L9: color 90
L10: add r6 0.25
L11: split r2
L12: jeq r1 3 L6
L13: eat r1
L14: give 360 r3
L15: min r6 r6
L16: gradient r6 r1
```

## Variant 6866: 471 living, 3268 births

Harvest 1186426.07421875, depth 0.

```asm
L0: listen r7 2
L1: eat r3
L2: jlt r4 1 L50
L3: mobilize r7 0.25
L4: rand r7 r0
L5: shield 90
L6: mod r1 0.75
L7: shield 0.1
L8: mov r2 r0
L9: photosynthesize r5
L10: jeq r4 r3 L3
L11: jeq 2 0 L27
L12: bond r6 120
L13: scan_color r2 5 0.75
L14: jz 90 L48
L15: scan r4 r4 0.75
L16: eat r1
L17: mod r6 r7
L18: move 1
L19: sense r1 ahead
L20: receive r1 r3 360
L21: gradient r0 r1
L22: scan r6 3 -1
L23: abs r6 90
L24: jgt 3 r7 L3
L25: receive r2 r5 r6
L26: gradient r6 r4
L27: unlink 3
L28: mov r7 2
L29: shield -1
L30: mov r0 5
L31: storage_gradient r7 r5 1
L32: jz 0.75 L43
L33: storage_gradient r2 r3 r2
L34: eat r0
L35: eat r7
L36: scan r2 0.5 25
L37: jgt 3 5 L26
L38: eat r6
L39: contract 0.25
L40: tag 1
L41: jeq 0 r7 L9
L42: mod r5 10
L43: mov r3 3
L44: eat r0
L45: store r5 0.1
L46: sub r7 0.1
L47: storage_gradient r1 r2 0.25
L48: bud r2
L49: sub r0 120
L50: mobilize r1 1
L51: split r6
L52: photosynthesize r1
L53: photosynthesize r3
L54: color r2
L55: move r2
L56: abs r0 0
L57: move 10
```

## Variant 1411: 466 living, 1146 births

Harvest 346640.65234375, depth 0.

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

## Variant 757: 274 living, 717 births

Harvest 196423, depth 0.

```asm
L0: bud r7
L1: min r1 360
L2: nop
L3: div r7 60
L4: jmp L19
L5: store r1 r4
L6: sub r2 25
L7: gradient r0 r5
L8: max r3 2
L9: sense r7 crowding
L10: tag 60
L11: jnz 90 L25
L12: max r7 3
L13: turn 120
L14: gradient r3 r1
L15: storage_gradient r2 r7 3
L16: eat r4
L17: storage_gradient r6 r1 0.75
L18: max r4 r7
L19: abs r0 90
L20: bond r3 0.5
L21: mov r0 r4
L22: max r2 r1
L23: mobilize r0 r3
L24: bond r6 3
L25: mul r4 90
L26: max r0 0.75
L27: scan_corpse r4 r4
L28: listen r0 120
L29: eat r4
L30: mov r1 r3
L31: mod r1 0.75
L32: unlink 0.25
L33: move 5
L34: photosynthesize r1
L35: link 90
```

## Variant 9282: 197 living, 216 births

Harvest 94291.12109375, depth 0.

```asm
L0: unlink 5
L1: storage_gradient r6 r4 r3
L2: rand r5 5
L3: mov r7 90
L4: color 25
L5: max r3 0.5
L6: storage_gradient r7 r7 10
L7: abs r6 25
L8: photosynthesize r0
L9: jeq 0 0.1 L13
L10: split r7
L11: color 360
L12: sub r6 r1
L13: listen r2 r6
L14: mobilize r0 0.75
L15: jz 60 L8
```

## Variant 9105: 159 living, 427 births

Harvest 99181.0078125, depth 0.

```asm
L0: tag r6
L1: gradient r7 r4
L2: scan_corpse r5 5
L3: scan_corpse r7 r3
L4: shield r1
L5: move 0.25
L6: mov r3 10
L7: nop
L8: photosynthesize r1
L9: color 90
L10: add r6 0.25
L11: split r2
L12: jeq r1 3 L6
L13: eat r1
L14: give 360 r3
L15: min r6 r6
L16: gradient r6 r1
```

## Variant 9887: 141 living, 163 births

Harvest 56609.203125, depth 1.

```asm
L0: abs r7 0
L1: turn r3
L2: photosynthesize r0
L3: bond r1 60
L4: jnz 3 L14
L5: color r7
L6: receive r4 r0 r7
L7: abs r1 r0
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

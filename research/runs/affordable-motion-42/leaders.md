## Variant 812: 8750 living, 16429 births

Harvest 5048144.19921875, depth 0.

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

## Variant 6921: 276 living, 4940 births

Harvest 1226068.27734375, depth 0.

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

## Variant 10285: 237 living, 236 births

Harvest 47393.46484375, depth 1.

```asm
L0: photosynthesize r7
L1: nop
L2: peek r1 -1 temperature
L3: jeq r1 0.75 L1
L4: nop
L5: split r3
L6: abs r5 5
L7: mod r3 2
L8: add r5 2
L9: nop
L10: abs r3 r0
L11: unlink 0.25
```

## Variant 10435: 231 living, 407 births

Harvest 136777.94921875, depth 1.

```asm
L0: sub r1 5
L1: sub r5 60
L2: storage_gradient r0 r4 120
L3: rand r1 120
L4: scan r6 1 5
L5: scan_color r6 r4 3
L6: scan_color r0 5 0.25
L7: mobilize r0 0
L8: gradient r3 r7
L9: unlink 120
L10: eat r4
L11: contract 0.5
L12: bond r4 0
L13: storage_gradient r2 r3 0
L14: turn r2
L15: photosynthesize r3
L16: eat r5
L17: rand r3 -1
L18: link r3
L19: div r2 0.25
L20: give 0 r1
L21: split r7
L22: unlink 0.1
L23: scan_corpse r4 -1
L24: gradient r4 r5
L25: mobilize r1 2
L26: rand r0 10
L27: jnz 60 L47
L28: sense r1 linked_storage
L29: contract 0.1
L30: nop
L31: mobilize r0 r3
L32: gradient r1 r2
L33: scan_corpse r4 25
L34: move r1
L35: contract r6
L36: scan_corpse r5 0.5
L37: jnz 5 L16
L38: mobilize r1 3
L39: color 0.75
L40: sub r4 60
L41: rand r2 1
L42: shield 120
L43: bud r3
L44: mul r4 0
L45: jeq r5 0.5 L48
L46: abs r1 360
L47: jnz 360 L15
L48: emit 5 r0
L49: jgt 360 0.25 L35
L50: listen r3 90
L51: store r4 r6
L52: receive r6 r4 120
L53: eat r6
L54: link 90
L55: eat r6
L56: rand r7 25
L57: wait 0.25
L58: storage_gradient r2 r5 90
```

## Variant 10260: 171 living, 236 births

Harvest 61400.50390625, depth 0.

```asm
L0: photosynthesize r7
L1: nop
L2: peek r1 -1 temperature
L3: jeq r1 0.75 L1
L4: nop
L5: split r3
L6: photosynthesize r5
L7: mod r3 2
L8: add r5 2
L9: nop
L10: abs r3 r0
L11: unlink 0.25
```

## Variant 10189: 158 living, 235 births

Harvest 60671.4140625, depth 1.

```asm
L0: bud r7
L1: sense r5 linked_storage
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

## Variant 2116: 119 living, 241 births

Harvest 53526.125, depth 0.

```asm
L0: receive r2 r4 360
L1: mod r1 3
L2: min r1 -1
L3: scan_corpse r7 0.75
L4: rand r4 r0
L5: nop
L6: abs r6 360
L7: photosynthesize r0
L8: bond r5 0.75
L9: rand r0 r2
L10: mod r0 r6
L11: eat r3
L12: sense r3 linked_temperature
L13: attack 3 90
L14: unlink 0.75
L15: listen r0 1
L16: mobilize r3 25
L17: bud r1
L18: jgt r6 5 L7
L19: color 0
L20: sense r5 id
L21: sub r0 0.1
L22: div r4 0.5
L23: jgt r5 r3 L18
L24: mobilize r6 5
L25: photosynthesize r1
L26: scan_color r6 r7 90
L27: sub r1 0.25
L28: peek r7 0.75 energy
L29: emit r6 120
L30: receive r5 r1 10
L31: mobilize r0 0.1
L32: receive r5 r0 r2
L33: max r3 0.5
L34: store r4 0.75
```

## Variant 4079: 107 living, 229 births

Harvest 74556.671875, depth 0.

```asm
L0: add r4 90
L1: bud r4
L2: shield 120
L3: div r5 60
L4: give 0 0.75
L5: move 120
L6: split r0
L7: give 0 r5
L8: eat r0
L9: jz 5 L16
L10: div r0 r2
L11: tag r0
L12: jeq 2 25 L15
L13: scan_corpse r7 3
L14: mov r4 60
L15: jeq r0 360 L37
L16: scan_color r5 3 120
L17: sub r0 10
L18: link 0.5
L19: jz 1 L25
L20: link r2
L21: photosynthesize r3
L22: scan_color r4 1 r3
L23: split r7
L24: bond r1 -1
L25: bond r6 0.75
L26: photosynthesize r3
L27: mul r3 60
L28: max r5 0.5
L29: jnz r0 L4
L30: div r5 60
L31: contract r2
L32: receive r1 r5 r3
L33: move 25
L34: listen r6 0.25
L35: bud r7
L36: give 0.5 0.75
L37: jz -1 L15
L38: store r2 360
L39: gradient r0 r1
L40: unlink 120
L41: tag 2
L42: peek r1 90 color
L43: send r7 r2 0.5
L44: mod r0 3
L45: send 90 1 10
```

## Variant 9746: 85 living, 127 births

Harvest 43275.48046875, depth 1.

```asm
L0: eat r6
L1: photosynthesize r5
L2: jz -1 L2
L3: listen r2 1
L4: bud r2
L5: jgt 25 120 L1
L6: receive r5 r7 3
L7: color 90
L8: min r4 0.25
L9: add r2 r4
L10: jz 1 L6
```

## Variant 10410: 48 living, 71 births

Harvest 25182.83203125, depth 1.

```asm
L0: sense r3 crowding
L1: link r0
L2: add r4 -1
L3: photosynthesize r2
L4: move r7
L5: eat r1
L6: link r1
L7: peek r6 0.25 storage
L8: div r6 25
L9: jmp L50
L10: sense r5 energy
L11: jnz 90 L16
L12: scan_color r1 10 0.1
L13: add r7 0
L14: jz 5 L3
L15: sense r2 rotation
L16: storage_gradient r6 r2 90
L17: abs r7 90
L18: jgt 60 60 L44
L19: scan r1 r0 0
L20: move r1
L21: bond r6 r2
L22: nop
L23: mod r0 r6
L24: move 5
L25: mobilize r7 0.75
L26: bond r1 r7
L27: mov r7 2
L28: scan_color r7 2 r6
L29: contract 360
L30: abs r6 25
L31: turn 10
L32: bond r2 360
L33: scan r2 5 r4
L34: mov r3 r0
L35: jlt r7 0.25 L0
L36: split r2
L37: max r7 10
L38: abs r7 1
L39: eat r6
L40: link 60
L41: tag 0.25
L42: tag 60
L43: jgt r6 r0 L14
L44: eat r1
L45: bond r2 10
L46: rand r5 0.5
L47: storage_gradient r4 r1 r6
L48: rand r3 0.1
L49: scan_color r3 25 0.1
L50: bud r5
```

## Variant 9308: 35 living, 127 births

Harvest 41329.54296875, depth 1.

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
L42: eat r0
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

## Variant 10587: 31 living, 53 births

Harvest 24034.6796875, depth 1.

```asm
L0: sub r1 5
L1: sub r5 60
L2: storage_gradient r0 r4 120
L3: rand r1 120
L4: scan r6 1 5
L5: scan_color r6 r4 3
L6: scan_color r0 5 0.25
L7: mobilize r0 0
L8: gradient r3 r7
L9: unlink 120
L10: eat r4
L11: contract 0.5
L12: bond r4 0
L13: storage_gradient r2 r3 0
L14: turn r2
L15: photosynthesize r3
L16: eat r5
L17: rand r3 -1
L18: link r3
L19: div r2 0.25
L20: give 0 r1
L21: split r7
L22: unlink 0.1
L23: scan_corpse r4 -1
L24: gradient r4 r5
L25: mobilize r1 2
L26: rand r0 10
L27: jnz 60 L47
L28: sense r1 linked_storage
L29: contract 0.1
L30: nop
L31: mobilize r0 r3
L32: gradient r1 r2
L33: scan_corpse r4 25
L34: move r1
L35: contract r6
L36: scan_corpse r5 0.5
L37: jnz 5 L16
L38: mobilize r1 3
L39: color 0.75
L40: sub r4 60
L41: rand r6 1
L42: shield 120
L43: bud r3
L44: mul r4 0
L45: jeq r5 0.5 L48
L46: abs r1 360
L47: jnz 360 L15
L48: emit 5 r0
L49: jgt 360 0.25 L35
L50: listen r3 90
L51: store r4 r6
L52: receive r6 r4 120
L53: eat r6
L54: link 90
L55: eat r6
L56: nop
L57: wait 0.25
L58: storage_gradient r2 r5 90
```

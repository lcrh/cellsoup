## Variant 10393: 471 living, 654 births

Harvest 133045.87890625, depth 2.

```asm
L0: move r0
L1: photosynthesize r3
L2: mobilize r4 5
L3: scan_color r7 1 360
L4: move 360
L5: sense r1 linked_temperature
L6: bud r7
L7: jlt 90 r3 L12
L8: store r1 5
L9: sub r6 0
L10: jeq r3 -1 L21
L11: mobilize r0 3
L12: scan r3 60 r0
L13: jeq 90 120 L4
L14: eat r6
L15: send 0.5 360 r4
L16: listen r0 90
L17: storage_gradient r6 r7 r1
L18: jz r0 L26
L19: move r5
L20: store r4 r6
L21: listen r6 60
L22: photosynthesize r5
L23: scan_color r5 r5 360
L24: scan_color r0 0.25 1
L25: sense r5 temperature
L26: scan_color r0 25 25
L27: listen r7 0.1
L28: photosynthesize r4
```

## Variant 10261: 376 living, 531 births

Harvest 132341.01953125, depth 0.

```asm
L0: receive r3 r1 r3
L1: unlink r1
L2: attack r4 2
L3: nop
L4: scan_color r6 1 0.5
L5: attack r1 r0
L6: peek r0 r6 storage
L7: photosynthesize r0
L8: jgt -1 0.5 L13
L9: unlink 0.1
L10: shield r7
L11: rand r7 r1
L12: max r6 90
L13: abs r5 3
L14: split r1
L15: add r2 r7
```

## Variant 9661: 256 living, 465 births

Harvest 93279.59765625, depth 1.

```asm
L0: bud r7
L1: min r1 360
L2: nop
L3: div r7 60
L4: jmp L19
L5: store r1 2
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

## Variant 6921: 187 living, 4095 births

Harvest 919015.8828125, depth 0.

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

## Variant 4476: 143 living, 387 births

Harvest 89216.30078125, depth 0.

```asm
L0: bud r0
L1: jmp L18
L2: gradient r0 r6
L3: wait 0.75
L4: div r2 0.25
L5: link 0.1
L6: mobilize r1 0.75
L7: mul r6 60
L8: add r7 360
L9: emit 10 0.25
L10: receive r4 r5 0
L11: peek r7 120 alive
L12: split r6
L13: turn r4
L14: scan_color r0 60 0.5
L15: turn 5
L16: mobilize r2 r2
L17: bud r3
L18: min r3 0.1
L19: max r1 r2
L20: move 120
L21: photosynthesize r0
L22: jlt r3 r3 L33
L23: scan_corpse r2 0.75
L24: jnz 2 L33
L25: unlink 0.5
L26: peek r5 0.1 color
L27: add r0 0.5
L28: store r2 10
L29: div r5 90
L30: jeq 90 5 L38
L31: min r5 1
L32: jeq r1 2 L40
L33: jnz 25 L0
L34: sub r6 25
L35: scan_color r5 r0 -1
L36: bud r0
L37: give 2 0.1
L38: store r2 25
L39: jmp L32
L40: rand r1 r7
L41: storage_gradient r0 r4 10
L42: scan r5 0.75 3
L43: link 0
L44: abs r2 -1
```

## Variant 10260: 105 living, 150 births

Harvest 50953.0703125, depth 0.

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

## Variant 812: 94 living, 467 births

Harvest 94409.94140625, depth 0.

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

## Variant 9612: 92 living, 124 births

Harvest 58660.39453125, depth 0.

```asm
L0: eat r6
L1: photosynthesize r5
L2: jz -1 L2
L3: listen r2 1
L4: bud r2
L5: jgt 25 120 L1
L6: receive r5 r7 3
L7: color 90
L8: min r5 0.25
L9: add r2 r4
L10: jz 1 L6
```

## Variant 9677: 62 living, 61 births

Harvest 38937.80078125, depth 0.

```asm
L0: bond r3 r1
L1: bond r0 0
L2: max r2 r7
L3: mod r6 360
L4: max r2 5
L5: abs r0 3
L6: scan r0 10 120
L7: add r7 0.5
L8: jz r7 L13
L9: bud r1
L10: attack r5 2
L11: color 1
L12: jeq 90 r5 L2
L13: div r6 120
L14: gradient r2 r2
L15: send 10 r0 -1
L16: photosynthesize r4
L17: eat r0
```

## Variant 10435: 49 living, 192 births

Harvest 58316.2578125, depth 1.

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

## Variant 9277: 35 living, 69 births

Harvest 25349.73828125, depth 0.

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

## Variant 10575: 31 living, 30 births

Harvest 13001.04296875, depth 1.

```asm
L0: move 90
L1: max r7 0.75
L2: div r2 r5
L3: attack 120 2
L4: listen r1 5
L5: photosynthesize r5
L6: bud r5
L7: abs r4 r5
L8: jlt 0.5 90 L3
L9: mobilize r0 25
L10: wait 0
L11: store r2 0.5
L12: unlink 10
L13: color 360
L14: contract 360
L15: eat r0
L16: unlink 360
```

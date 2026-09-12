## Variant 9180: 929 living, 1939 births

Harvest 511160.30078125, depth 1.

```asm
L0: tag r6
L1: gradient r7 r4
L2: link 2
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

## Variant 6642: 849 living, 5374 births

Harvest 1979507.09765625, depth 0.

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

## Variant 309: 640 living, 696 births

Harvest 202274.9765625, depth 0.

```asm
L0: rand r4 r3
L1: listen r3 90
L2: split r1
L3: photosynthesize r4
L4: move 0.25
L5: jmp L1
L6: rand r1 1
L7: rand r7 25
L8: sub r2 25
L9: add r4 0.75
```

## Variant 4309: 322 living, 363 births

Harvest 135741.1796875, depth 0.

```asm
L0: scan r5 r6 120
L1: split r4
L2: emit 25 10
L3: sense r7 left
L4: split r7
L5: peek r0 r6 bearing
L6: mod r3 1
L7: photosynthesize r2
L8: jgt r0 r5 L5
L9: mov r6 25
L10: receive r0 r6 1
L11: rand r7 90
L12: peek r2 360 bearing
L13: add r6 120
L14: jnz 0.75 L21
L15: rand r3 0.5
L16: jlt 90 r0 L41
L17: jmp L15
L18: jnz 1 L5
L19: receive r1 r0 r6
L20: min r2 0
L21: sub r4 10
L22: scan_corpse r2 25
L23: receive r1 r6 r1
L24: listen r5 10
L25: add r0 0.1
L26: jnz r6 L43
L27: mobilize r7 r7
L28: jeq 1 0.5 L13
L29: send 10 10 0.1
L30: give 0.1 1
L31: give -1 120
L32: mov r4 360
L33: jz r6 L4
L34: rand r0 0.75
L35: scan_color r5 r4 90
L36: eat r2
L37: split r1
L38: attack r7 3
L39: wait 25
L40: sub r1 r7
L41: listen r0 25
L42: scan_corpse r3 90
L43: give 2 -1
L44: scan_corpse r3 r2
L45: max r6 0.5
```

## Variant 9755: 309 living, 313 births

Harvest 122885.22265625, depth 1.

```asm
L0: max r6 1
L1: sense r5 id
L2: unlink r6
L3: sense r6 sunlight
L4: storage_gradient r3 r6 r7
L5: jlt 90 3 L32
L6: mobilize r5 r3
L7: split r5
L8: scan_color r1 0.5 120
L9: nop
L10: scan_color r0 0.75 0.75
L11: max r3 -1
L12: eat r2
L13: photosynthesize r1
L14: mod r4 10
L15: send 120 0.25 360
L16: jeq 0 0.75 L15
L17: rand r7 0.75
L18: photosynthesize r1
L19: mov r6 r7
L20: storage_gradient r5 r7 -1
L21: rand r7 2
L22: mul r5 0.5
L23: jgt 0 0.25 L45
L24: sub r3 120
L25: gradient r1 r7
L26: color 5
L27: max r5 -1
L28: jmp L6
L29: gradient r6 r0
L30: send 0 60 r2
L31: abs r7 r1
L32: storage_gradient r4 r0 120
L33: wait 0
L34: send 2 0.75 0.5
L35: tag 120
L36: turn r2
L37: nop
L38: listen r6 -1
L39: peek r6 360 temperature
L40: rand r4 2
L41: turn r1
L42: give 5 25
L43: mobilize r3 360
L44: wait r0
L45: mobilize r2 60
L46: tag 3
L47: abs r1 r6
L48: mobilize r2 5
L49: jgt 0.5 0 L53
L50: give r1 0.1
L51: abs r5 25
L52: peek r6 5 energy
L53: jgt 0 r7 L44
L54: scan_corpse r3 2
```

## Variant 9779: 250 living, 257 births

Harvest 101052.05859375, depth 1.

```asm
L0: scan_color r6 3 r1
L1: turn 2
L2: max r3 0
L3: photosynthesize r1
L4: unlink -1
L5: mul r1 1
L6: give 2 r7
L7: split r3
L8: add r0 25
L9: jlt 1 120 L3
L10: eat r3
L11: wait r3
L12: jeq 3 2 L22
L13: sense r7 bonds
L14: contract 0.25
L15: jnz 0 L32
L16: photosynthesize r4
L17: nop
L18: tag r7
L19: listen r6 0.1
L20: mod r7 r1
L21: scan_corpse r3 2
L22: peek r2 0.5 energy
L23: scan r0 0.1 5
L24: attack 0.75 3
L25: mobilize r6 360
L26: jeq 3 360 L19
L27: sense r2 ahead
L28: mobilize r4 0.25
L29: turn 3
L30: nop
L31: scan r6 -1 0
L32: link 0.1
L33: emit r0 0.75
L34: listen r2 0.1
L35: turn 0.5
L36: gradient r7 r1
```

## Variant 4757: 215 living, 214 births

Harvest 58062.9765625, depth 0.

```asm
L0: photosynthesize r3
L1: eat r0
L2: min r1 r3
L3: scan_color r0 r7 r3
L4: bond r7 r1
L5: mov r4 25
L6: min r1 360
L7: jmp L19
L8: shield r0
L9: listen r4 0
L10: tag 3
L11: div r4 2
L12: contract 3
L13: emit r2 1
L14: give 120 r7
L15: move 90
L16: photosynthesize r3
L17: peek r4 r7 color
L18: shield 10
L19: add r5 5
L20: sub r6 1
L21: split r2
L22: sense r1 crowding
```

## Variant 9534: 194 living, 195 births

Harvest 114584.69921875, depth 1.

```asm
L0: max r6 1
L1: sense r5 id
L2: unlink r6
L3: sense r6 sunlight
L4: storage_gradient r1 r6 r7
L5: jlt 90 3 L32
L6: mobilize r5 r3
L7: split r5
L8: scan_color r1 0.5 120
L9: nop
L10: scan_color r0 0.75 0.75
L11: max r3 -1
L12: eat r2
L13: photosynthesize r1
L14: mod r4 10
L15: send 120 0.25 360
L16: jeq 0 0.75 L15
L17: rand r7 0.75
L18: photosynthesize r1
L19: mov r6 r7
L20: storage_gradient r5 r7 -1
L21: rand r7 2
L22: mul r5 0.5
L23: jgt 0 0.25 L45
L24: sub r3 120
L25: gradient r1 r7
L26: color 5
L27: max r5 -1
L28: jmp L6
L29: gradient r6 r0
L30: send 0 60 r2
L31: abs r7 r1
L32: storage_gradient r4 r0 120
L33: wait 0
L34: send 2 0.75 0.5
L35: tag 120
L36: turn r2
L37: nop
L38: listen r6 -1
L39: peek r6 360 temperature
L40: rand r4 2
L41: turn r1
L42: give 5 25
L43: mobilize r3 360
L44: wait r0
L45: mobilize r2 60
L46: tag 3
L47: abs r1 r6
L48: mobilize r2 5
L49: jgt 0.5 0 L53
L50: give r1 0.1
L51: abs r5 25
L52: peek r6 5 energy
L53: jgt 0 0.75 L44
L54: scan_corpse r3 2
```

## Variant 10215: 178 living, 177 births

Harvest 54224.83203125, depth 1.

```asm
L0: photosynthesize r4
L1: link 360
L2: eat r3
L3: bud r1
L4: listen r2 90
L5: bond r0 25
L6: nop
L7: scan r4 -1 3
L8: add r0 0.1
L9: eat r1
L10: listen r7 r2
L11: attack -1 0.75
L12: jnz r0 L20
L13: bond r0 0
L14: rand r7 r6
L15: jz 0.75 L27
L16: peek r1 0 shield
L17: send 2 2 r4
L18: receive r5 r2 0.25
L19: jz 0.5 L25
L20: min r6 0.75
L21: jlt r7 r5 L19
L22: give 0.75 r5
L23: photosynthesize r4
L24: gradient r6 r2
L25: link 60
L26: link r5
L27: split r0
L28: min r1 -1
```

## Variant 8873: 174 living, 173 births

Harvest 86974.703125, depth 1.

```asm
L0: scan_color r6 3 r1
L1: wait 360
L2: max r3 0
L3: photosynthesize r1
L4: unlink -1
L5: mul r1 1
L6: give 2 r7
L7: split r3
L8: add r0 25
L9: jlt 1 120 L3
L10: eat r3
L11: wait r3
L12: jeq 3 2 L22
L13: sense r7 bonds
L14: gradient r6 r2
L15: jnz 0 L32
L16: photosynthesize r4
L17: nop
L18: tag r7
L19: listen r6 0.1
L20: mod r7 r1
L21: scan_corpse r3 2
L22: peek r2 0.5 energy
L23: scan r0 0.1 5
L24: attack 0.75 3
L25: mobilize r6 360
L26: jeq 3 360 L19
L27: sense r2 ahead
L28: mobilize r4 0.25
L29: turn 3
L30: nop
L31: scan r6 -1 0
L32: link 0.1
L33: emit r0 0.75
L34: listen r2 0.1
L35: turn 0.5
L36: gradient r7 r1
```

## Variant 9563: 146 living, 184 births

Harvest 58137.09375, depth 0.

```asm
L0: sub r2 25
L1: link 0.1
L2: scan r0 360 r1
L3: photosynthesize r3
L4: send 5 90 0.5
L5: scan_color r3 360 r2
L6: shield r0
L7: color 3
L8: listen r6 0.5
L9: scan_color r3 r2 2
L10: min r6 3
L11: tag 60
L12: split r0
L13: mul r2 360
L14: turn 0.75
L15: photosynthesize r3
L16: send r4 0.75 120
L17: sub r4 0.1
L18: peek r3 360 temperature
L19: scan_color r5 r0 0.75
L20: bond r0 0.75
L21: scan r5 r7 60
L22: jmp L2
L23: jnz r4 L25
L24: give 10 r0
L25: send 3 25 0.25
L26: receive r6 r4 r3
L27: photosynthesize r5
L28: scan r3 2 1
L29: receive r2 r1 3
L30: min r7 360
L31: sub r2 0.1
```

## Variant 10138: 100 living, 99 births

Harvest 28435.67578125, depth 1.

```asm
L0: split r2
L1: jz 1 L11
L2: jlt 0 r5 L15
L3: color r2
L4: sub r7 2
L5: max r7 r0
L6: bond r1 0.1
L7: sense r2 crowding
L8: bond r3 0.5
L9: give 360 0
L10: emit 0.5 0
L11: jlt 0.75 0.5 L11
L12: mobilize r0 0
L13: store r5 60
L14: mobilize r6 60
L15: mov r7 25
L16: jnz 1 L17
L17: mobilize r3 120
L18: photosynthesize r0
L19: max r4 2
L20: receive r0 r0 360
```

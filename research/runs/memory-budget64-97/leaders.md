## Variant 442: 5 living, 81 births

Harvest 30371.89453125, depth 0.

```lisp
(seq
  (eat)
  (photosynthesize)
  (send
    (scan (temperature) (linked_temperature))
    c0
    (target-bearing (self))
  )
  (split)
  (photosynthesize)
)
```

## Variant 10514: 1 living, 0 births

Harvest 1218.796875, depth 0.

```lisp
(seq
  (mobilize (linked_temperature))
  (set m6 (birth-result))
  (emit c0 (target-tag (none)))
  (do
    (mobilize (tag))
    (give (nearest-corpse) (temperature))
  )
  (mobilize (target-color (bond c3)))
  (state ((state1 (listen c1)))
    (photosynthesize)
  )
)
```

## Variant 414: 1 living, 0 births

Harvest 1465.31640625, depth 0.

```lisp
(seq (give (none) (color)) (photosynthesize))
```

## Variant 8697: 1 living, 0 births

Harvest 2092.390625, depth 1.

```lisp
(seq
  (move (energy))
  (if
    false
    (unlink (none))
    (state ((state0 (linked_storage)))
      (photosynthesize)
    )
  )
  (eat)
)
```

## Variant 10517: 1 living, 0 births

Harvest 1323.79296875, depth 1.

```lisp
(seq
  (do (eat) (photosynthesize))
  (give (self) (target-temperature (none)))
  (unlink (self))
  (state ((state7 (bonds)))
    (move (bonds))
  )
  (send
    (bond c2)
    c1
    (/ (storage) (target-distance (nearest-corpse)))
  )
)
```

## Variant 9759: 1 living, 0 births

Harvest 1693.62890625, depth 1.

```lisp
(seq
  (if true (photosynthesize) (nop))
  (move (color))
  (set m3 (sunlight))
  (nop)
  (unlink
    (do
      (eat)
      (state ((state6 (tag)))
        (nearest-cell)
      )
    )
  )
  (eat)
)
```

## Variant 10437: 1 living, 0 births

Harvest 1315.6328125, depth 0.

```lisp
(seq (turn (linked_temperature)) (photosynthesize))
```

## Variant 1742: 1 living, 0 births

Harvest 1455.7578125, depth 0.

```lisp
(seq
  (photosynthesize)
  (move (linked_storage))
  (color-set (target-tag (none)))
)
```

## Variant 10253: 1 living, 0 births

Harvest 1302.6171875, depth 0.

```lisp
(seq
  (eat)
  (do (link (self)) (mobilize 10))
  (contract (target-color (self)))
  (contract (receive c0))
  (do (photosynthesize) (turn (listen c1)))
  (color-set (target-temperature (self)))
)
```

## Variant 10196: 1 living, 0 births

Harvest 670.203125, depth 1.

```lisp
(seq
  (attack
    (if false (bond c2) (nearest-corpse))
    (target-energy (nearest-corpse))
  )
  (do (photosynthesize) (eat))
  (turn
    (*
      (min (receive c2) (sunlight))
      (random
        (do (give (nearest-cell) -1) (crowding))
      )
    )
  )
  (bud)
  (move (generation))
)
```

## Variant 9809: 1 living, 0 births

Harvest 1293.01171875, depth 1.

```lisp
(seq
  (send
    (scan-color (generation) (sunlight))
    c0
    (target-tag (none))
  )
  (photosynthesize)
  (state ((state0 (sunlight-slope)))
    (eat)
  )
  (eat)
)
```

## Variant 8961: 1 living, 0 births

Harvest 1706.06640625, depth 1.

```lisp
(seq
  (let ((local7 (min
      (storage-bearing (linked_temperature))
      (sunlight-bearing)
    )))
    (move (target-energy (self)))
  )
  (move 0.21337470412254333)
  (send
    (scan-color (generation) (sunlight))
    c0
    (target-tag (none))
  )
  (photosynthesize)
  (state ((state0 (sunlight-slope)))
    (eat)
  )
  (eat)
)
```

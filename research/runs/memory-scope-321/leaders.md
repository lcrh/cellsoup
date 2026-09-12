## Variant 8035: 35 living, 36 births

Harvest 12610.73046875, depth 0.

```lisp
(seq
  (photosynthesize)
  (send (none) c2 (target-shield (nearest-corpse)))
  (let ((local0 (storage-bearing (temperature))))
    (store (receive c1))
  )
  (state ((state0 (tag)))
    (split)
  )
  (photosynthesize)
)
```

## Variant 10138: 30 living, 29 births

Harvest 10555.609375, depth 0.

```lisp
(seq
  (send (nearest-corpse) c0 (birth-result))
  (seq (photosynthesize) (nop))
  (photosynthesize)
  (let ((local5 (rotation)))
    (do (split) (photosynthesize))
  )
  (unlink
    (let ((local4 (tag)))
      (none)
    )
  )
  (state ((state4 (do (eat) (tag))))
    (turn (storage-slope (sunlight-slope)))
  )
)
```

## Variant 9635: 29 living, 28 births

Harvest 9591.0390625, depth 1.

```lisp
(seq
  (eat)
  (photosynthesize)
  (photosynthesize)
  (link
    (state ((state3 (temperature)))
      (self)
    )
  )
  (bud)
  (photosynthesize)
)
```

## Variant 3908: 20 living, 44 births

Harvest 13550.88671875, depth 0.

```lisp
(seq
  (state ((state1 (listen c1)))
    (do (photosynthesize) (split))
  )
  (if
    (< (temperature) (tag))
    (bud)
    (color-set (rotation))
  )
  (eat)
  (let ((local7 (target-bearing (bond c1))))
    (photosynthesize)
  )
)
```

## Variant 10332: 12 living, 11 births

Harvest 4011.765625, depth 1.

```lisp
(seq
  (send (nearest-cell) c3 (energy))
  (photosynthesize)
  (bud)
  (if
    true
    (move (storage-slope (linked_storage)))
    (eat)
  )
  (photosynthesize)
)
```

## Variant 9536: 12 living, 13 births

Harvest 10639.2109375, depth 1.

```lisp
(seq
  (shield
    (target-distance (do (photosynthesize) (none)))
  )
  (if (do (split) (> 5 (birth-result))) (nop) (bud))
  (attack
    (state ((state6 (bonds)))
      (do (photosynthesize) (self))
    )
    (generation)
  )
)
```

## Variant 10573: 8 living, 7 births

Harvest 3367.1328125, depth 0.

```lisp
(seq
  (state ((state1 (listen c1)))
    (do (photosynthesize) (split))
  )
  (if
    (< (temperature) (tag))
    (bud)
    (color-set (rotation))
  )
  (eat)
  (let ((local7 (target-bearing (bond c1))))
    (photosynthesize)
  )
)
```

## Variant 2143: 8 living, 885 births

Harvest 134134.93359375, depth 0.

```lisp
(seq
  (if false (split) (split))
  (color-set (linked_temperature))
  (color-set (bonds))
  (eat)
  (seq (photosynthesize) (move 1))
  (color-set (energy))
)
```

## Variant 10472: 4 living, 3 births

Harvest 3223.0390625, depth 1.

```lisp
(seq
  (send (nearest-corpse) c0 (birth-result))
  (seq (photosynthesize) (nop))
  (photosynthesize)
  (let ((local5 (rotation)))
    (do (split) (photosynthesize))
  )
  (state ((state4 (do (eat) (tag))))
    (turn (storage-slope (sunlight-slope)))
  )
)
```

## Variant 10343: 2 living, 1 births

Harvest 1239.8203125, depth 1.

```lisp
(seq
  (send (nearest-corpse) c0 (birth-result))
  (seq (photosynthesize) (nop))
  (photosynthesize)
  (let ((local5 (rotation)))
    (do (split) (photosynthesize))
  )
  (unlink
    (let ((local4 (tag)))
      (none)
    )
  )
  (state ((state4 (do (eat) (tag))))
    (turn (storage-slope (linked_temperature)))
  )
)
```

## Variant 9976: 2 living, 1 births

Harvest 899.18359375, depth 1.

```lisp
(seq
  (eat)
  (photosynthesize)
  (photosynthesize)
  (link
    (state ((state3 (temperature)))
      (if
        (= (sunlight-slope) (birth-result))
        (if
          (alive (none))
          (nearest-cell)
          (scan-color (color) (linked_storage))
        )
        (self)
      )
    )
  )
  (bud)
  (photosynthesize)
)
```

## Variant 5595: 2 living, 2 births

Harvest 1829.87109375, depth 0.

```lisp
(seq
  (seq (link (none)) (photosynthesize))
  (turn (linked_storage))
  (do (photosynthesize) (do (split) (eat)))
  (turn
    (mod
      (rotation)
      (storage-bearing (sunlight-bearing))
    )
  )
  (let ((local1 (target-bonds (self))))
    (photosynthesize)
  )
  (shield (generation))
)
```

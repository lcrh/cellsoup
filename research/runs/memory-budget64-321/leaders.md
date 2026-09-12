## Variant 5790: 404 living, 480 births

Harvest 71919.08203125, depth 0.

```lisp
(seq
  (color-set
    (target-storage
      (if false (bond c1) (nearest-cell))
    )
  )
  (do (do (eat) (photosynthesize)) (bud))
  (give
    (do (tag-set (linked_temperature)) (nearest-cell))
    (target-distance (nearest-cell))
  )
  (let ((local5 (do (seq (photosynthesize) (nop)) (energy))))
    (tag-set (target-temperature (none)))
  )
)
```

## Variant 8667: 89 living, 396 births

Harvest 44747.62109375, depth 1.

```lisp
(seq
  (unlink (nearest-corpse))
  (seq (photosynthesize) (eat))
  (move (temperature))
  (turn (crowding))
  (bud)
)
```

## Variant 2489: 60 living, 60 births

Harvest 20041.83984375, depth 0.

```lisp
(seq
  (color-set (tag))
  (photosynthesize)
  (tag-set (tag))
  (split)
  (link (self))
  (photosynthesize)
)
```

## Variant 10162: 29 living, 30 births

Harvest 11080.578125, depth 1.

```lisp
(seq
  (shield
    (target-distance (do (photosynthesize) (none)))
  )
  (if
    (do (split) (> 5 (target-bonds (nearest-corpse))))
    (nop)
    (bud)
  )
  (attack
    (state ((state6 (bonds)))
      (do (photosynthesize) (self))
    )
    (generation)
  )
  (turn (generation))
)
```

## Variant 6718: 16 living, 53 births

Harvest 15464.4453125, depth 0.

```lisp
(seq
  (if false (photosynthesize) (photosynthesize))
  (eat)
  (tag-set (target-color (do (split) (nearest-cell))))
  (tag-set
    (target-tag (do (photosynthesize) (nearest-cell)))
  )
  (let ((local0 (bonds)))
    (tag-set (birth-result))
  )
  (split)
  (state ((state2 (crowding)))
    (photosynthesize)
  )
)
```

## Variant 10453: 14 living, 13 births

Harvest 5491.13671875, depth 1.

```lisp
(seq
  (turn (linked_temperature))
  (photosynthesize)
  (state ((state6 (linked_temperature)))
    (seq (split) (eat))
  )
  (nop)
  (seq
    (photosynthesize)
    (move
      (do (link (self)) (target-bonds (nearest-cell)))
    )
  )
  (color-set (generation))
)
```

## Variant 10484: 13 living, 12 births

Harvest 5811.70703125, depth 1.

```lisp
(seq
  (photosynthesize)
  (nop)
  (let ((local1 (target-storage (nearest-corpse))))
    (mobilize (target-storage (bond c0)))
  )
  (split)
  (link
    (let ((local7 (target-bearing
        (if
          (state ((state5 (target-tag (nearest-corpse))))
            (and false false)
          )
          (nearest-cell)
          (nearest-corpse)
        )
      )))
      (self)
    )
  )
  (photosynthesize)
)
```

## Variant 9802: 12 living, 11 births

Harvest 3794.96875, depth 0.

```lisp
(seq
  (photosynthesize)
  (bud)
  (link
    (scan
      (tag)
      (target-bearing
        (do
          (photosynthesize)
          (scan (bonds) (crowding))
        )
      )
    )
  )
  (attack (none) (bonds))
)
```

## Variant 10088: 9 living, 14 births

Harvest 4472.39453125, depth 0.

```lisp
(seq
  (shield
    (target-distance (do (photosynthesize) (none)))
  )
  (if (do (split) (> 5 (birth-result))) (eat) (bud))
  (attack
    (state ((state6 (bonds)))
      (do (photosynthesize) (self))
    )
    (generation)
  )
  (turn (generation))
)
```

## Variant 9542: 8 living, 35 births

Harvest 9017.11328125, depth 1.

```lisp
(seq
  (nop)
  (color-set (target-shield (nearest-cell)))
  (state ((state3 (target-bonds (none))))
    (photosynthesize)
  )
  (eat)
  (move (energy))
  (do
    (if false (photosynthesize) (bud))
    (let ((local1 (storage-slope (sunlight-bearing))))
      (photosynthesize)
    )
  )
)
```

## Variant 9717: 5 living, 17 births

Harvest 7920.58203125, depth 0.

```lisp
(seq
  (photosynthesize)
  (nop)
  (let ((local1 (target-storage (nearest-corpse))))
    (eat)
  )
  (split)
  (link
    (let ((local7 (sunlight)))
      (self)
    )
  )
  (photosynthesize)
)
```

## Variant 4619: 4 living, 3 births

Harvest 1453.59375, depth 0.

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
    (turn (storage-bearing (sunlight-slope)))
  )
)
```

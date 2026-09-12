## Variant 3343: 148 living, 2619 births

Harvest 131749.6875, depth 0.

```lisp
(seq
  (turn
    (storage-bearing (target-bearing (nearest-cell)))
  )
  (if
    (do (eat) (alive (self)))
    (do (move (temperature)) (split))
    (send (nearest-cell) c1 (temperature))
  )
  (store
    (/
      (target-color
        (scan-color (birth-result) (sunlight))
      )
      (max
        (storage)
        (target-distance
          (scan-color (tag) (sunlight-slope))
        )
      )
    )
  )
)
```

## Variant 1653: 75 living, 441 births

Harvest 33983.8203125, depth 0.

```lisp
(seq
  (attack (self) (linked_temperature))
  (eat)
  (photosynthesize)
  (move (color))
  (do (split) (move (listen c1)))
)
```

## Variant 1802: 68 living, 97 births

Harvest 14357.85546875, depth 0.

```lisp
(seq
  (move (target-storage (nearest-corpse)))
  (split)
  (seq (if true (nop) (nop)) (move (tag)))
  (eat)
  (photosynthesize)
)
```

## Variant 5925: 45 living, 200 births

Harvest 18391.765625, depth 0.

```lisp
(seq
  (give (bond c3) 10)
  (eat)
  (move (sunlight-bearing))
  (tag-set
    (random (storage-slope (target-bonds (bond c2))))
  )
  (photosynthesize)
  (split)
)
```

## Variant 3556: 16 living, 18 births

Harvest 3125.0390625, depth 0.

```lisp
(seq
  (mobilize (target-temperature (do (eat) (self))))
  (set m4 (storage))
  (bud)
  (move
    (storage-bearing
      (target-tag
        (scan (storage) (linked_temperature))
      )
    )
  )
  (photosynthesize)
)
```

## Variant 7449: 16 living, 50 births

Harvest 5855.7578125, depth 0.

```lisp
(seq
  (emit c3 (abs (temperature)))
  (eat)
  (send (nearest-corpse) c1 (random (birth-result)))
  (set m1 (abs (energy)))
  (let ((local6 (bonds)))
    (seq (photosynthesize) (bud))
  )
  (move (storage-slope (bonds)))
)
```

## Variant 3784: 11 living, 28 births

Harvest 3133.296875, depth 0.

```lisp
(seq
  (seq (photosynthesize) (bud))
  (eat)
  (move (temperature))
)
```

## Variant 8665: 9 living, 8 births

Harvest 1706.73046875, depth 0.

```lisp
(seq
  (seq (photosynthesize) (bud))
  (eat)
  (photosynthesize)
)
```

## Variant 9292: 8 living, 7 births

Harvest 231.96484375, depth 0.

```lisp
(seq
  (move (temperature))
  (tag-set (target-storage (bond c1)))
  (let ((local3 (target-storage (nearest-corpse))))
    (bud)
  )
  (eat)
  (give
    (nearest-cell)
    (if (not true) (crowding) (bonds))
  )
  (photosynthesize)
)
```

## Variant 9196: 8 living, 9 births

Harvest 485.984375, depth 0.

```lisp
(seq
  (turn
    (storage-bearing (target-bearing (nearest-cell)))
  )
  (if
    (do (eat) (alive (self)))
    (do (move (temperature)) (split))
    (send (nearest-cell) c1 (temperature))
  )
  (store
    (/
      (target-color
        (scan-color (birth-result) (sunlight))
      )
      (max
        (storage)
        (target-distance
          (scan-color (tag) (sunlight-slope))
        )
      )
    )
  )
)
```

## Variant 309: 8 living, 7 births

Harvest 1125.68359375, depth 0.

```lisp
(seq
  (state ((state6 (generation)))
    (photosynthesize)
  )
  (color-set (linked_storage))
  (nop)
  (if
    (alive (self))
    (bud)
    (tag-set (linked_temperature))
  )
  (mobilize
    (target-shield
      (let ((local7 (target-tag (nearest-cell))))
        (self)
      )
    )
  )
  (photosynthesize)
)
```

## Variant 419: 8 living, 9 births

Harvest 1445.9140625, depth 0.

```lisp
(seq
  (tag-set (/ (sunlight) (generation)))
  (tag-set (target-bearing (nearest-cell)))
  (do (photosynthesize) (split))
  (mobilize (target-energy (none)))
  (unlink
    (state ((state4 (storage-bearing (crowding))))
      (nearest-corpse)
    )
  )
  (photosynthesize)
)
```

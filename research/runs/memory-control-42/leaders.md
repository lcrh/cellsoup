## Variant 8951: 635 living, 2003 births

Harvest 467960.23828125, depth 1.

```lisp
(seq
  (mobilize (target-temperature (do (eat) (self))))
  (set m6 (storage))
  (seq
    (photosynthesize)
    (move (color))
    (do (split) (move (listen c1)))
  )
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

## Variant 9865: 23 living, 277 births

Harvest 62436.60546875, depth 2.

```lisp
(seq
  (mobilize (target-temperature (do (eat) (self))))
  (state ((state0 (abs (linked_storage))))
    (link (none))
  )
  (seq
    (photosynthesize)
    (move (color))
    (do (split) (move (listen c1)))
  )
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

## Variant 10161: 6 living, 24 births

Harvest 5054.98828125, depth 1.

```lisp
(seq
  (mobilize
    (target-temperature
      (do (if false (split) (eat)) (self))
    )
  )
  (set m6 (storage))
  (seq
    (photosynthesize)
    (move (color))
    (do (split) (move (listen c1)))
  )
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

## Variant 9995: 4 living, 38 births

Harvest 8745.03515625, depth 2.

```lisp
(seq
  (mobilize (target-temperature (do (eat) (self))))
  (set m6 (storage))
  (seq
    (photosynthesize)
    (move (color))
    (do (split) (move (listen c3)))
  )
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

## Variant 9829: 3 living, 26 births

Harvest 6519.57421875, depth 2.

```lisp
(seq
  (mobilize (target-temperature (do (eat) (self))))
  (set m6 (storage))
  (seq
    (photosynthesize)
    (move (color))
    (do (split) (move (listen c1)))
  )
  (move
    (storage-bearing (target-tag (nearest-corpse)))
  )
  (photosynthesize)
)
```

## Variant 8719: 1 living, 0 births

Harvest 1790.6640625, depth 1.

```lisp
(seq
  (eat)
  (move (color))
  (photosynthesize)
  (unlink
    (if
      false
      (state ((state5 (target-tag
          (do
            (mobilize (listen c0))
            (state ((state0 (abs (birth-result))))
              (if
                false
                (nearest-cell)
                (nearest-corpse)
              )
            )
          )
        )))
        (scan-color (color) (age))
      )
      (nearest-cell)
    )
  )
)
```

## Variant 9390: 1 living, 0 births

Harvest 1598.3046875, depth 1.

```lisp
(seq
  (seq
    (unlink (self))
    (unlink
      (state ((state6 (tag)))
        (self)
      )
    )
  )
  (move
    (target-storage
      (state ((state1 (age)))
        (self)
      )
    )
  )
  (unlink (if false (self) (nearest-cell)))
  (do
    (seq (eat) (photosynthesize))
    (tag-set (generation))
  )
  (link (nearest-corpse))
)
```

## Variant 9391: 1 living, 0 births

Harvest 1319.7890625, depth 1.

```lisp
(seq
  (seq (photosynthesize) (shield (crowding)))
  (eat)
  (move (temperature))
)
```

## Variant 9557: 1 living, 0 births

Harvest 930.890625, depth 0.

```lisp
(seq
  (photosynthesize)
  (mobilize (energy))
  (set
    m6
    (target-bearing
      (scan-color (sunlight-slope) (generation))
    )
  )
  (state ((state1 (if
      (not (< 90 (storage)))
      (max (linked_storage) (energy))
      (energy)
    )))
    (send
      (if (alive (none)) (bond c3) (self))
      c2
      (crowding)
    )
  )
)
```

## Variant 6175: 1 living, 0 births

Harvest 1557.953125, depth 0.

```lisp
(seq
  (turn (+ (sunlight-bearing) (target-tag (none))))
  (if
    (do (unlink (nearest-corpse)) true)
    (photosynthesize)
    (unlink (nearest-cell))
  )
  (move (color))
  (attack
    (do (shield (bonds)) (nearest-corpse))
    (do (bud) 3)
  )
)
```

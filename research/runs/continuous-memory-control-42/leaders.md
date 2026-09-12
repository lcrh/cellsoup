## Variant 25490: 3306 living, 5078 births

Harvest 2048783.93359375, depth 4.

```lisp
(seq
  (seq (photosynthesize) (bud))
  (move
    (target-storage
      (state ((state1 (age)))
        (nearest-cell)
      )
    )
  )
  (unlink (if false (self) (nearest-cell)))
  (do
    (seq (eat) (photosynthesize))
    (tag-set
      (target-storage
        (state ((state0 (target-temperature (bond c3))))
          (none)
        )
      )
    )
  )
  (link (nearest-corpse))
)
```

## Variant 17840: 1302 living, 4654 births

Harvest 1714294.6640625, depth 3.

```lisp
(seq
  (seq (photosynthesize) (bud))
  (move
    (target-storage
      (state ((state1 (age)))
        (nearest-cell)
      )
    )
  )
  (unlink (if false (self) (nearest-cell)))
  (do
    (seq (eat) (photosynthesize))
    (tag-set
      (target-storage
        (state ((state3 (target-temperature (bond c3))))
          (none)
        )
      )
    )
  )
  (link (nearest-corpse))
)
```

## Variant 28151: 1214 living, 3522 births

Harvest 1404909.47265625, depth 3.

```lisp
(seq
  (seq (photosynthesize) (bud))
  (move
    (target-storage
      (state ((state1 (age)))
        (nearest-cell)
      )
    )
  )
  (unlink (if false (self) (nearest-cell)))
  (do
    (seq (eat) (photosynthesize))
    (tag-set
      (target-storage
        (state ((state3 (target-temperature (bond c3))))
          (none)
        )
      )
    )
  )
  (link (nearest-corpse))
)
```

## Variant 27336: 1017 living, 1628 births

Harvest 916103.6796875, depth 4.

```lisp
(seq
  (photosynthesize)
  (split)
  (seq
    (if
      true
      (move (target-storage (self)))
      (give
        (state ((state6 (target-distance (nearest-corpse))))
          (self)
        )
        (linked_temperature)
      )
    )
    (move
      (if
        (do (set m4 (sunlight)) false)
        (crowding)
        (sunlight-slope)
      )
    )
  )
  (eat)
  (photosynthesize)
)
```

## Variant 22331: 906 living, 3301 births

Harvest 1101316.84375, depth 3.

```lisp
(seq
  (move (temperature))
  (seq
    (eat)
    (photosynthesize)
    (state ((state2 (storage-slope (temperature))))
      (link (bond c2))
    )
  )
  (let ((local3 (target-storage (nearest-corpse))))
    (bud)
  )
  (eat)
  (photosynthesize)
)
```

## Variant 21844: 415 living, 3395 births

Harvest 1804454.8515625, depth 3.

```lisp
(seq
  (photosynthesize)
  (split)
  (seq
    (if
      true
      (move (target-storage (self)))
      (give
        (scan-color
          (linked_temperature)
          (target-bearing
            (scan (birth-result) (birth-result))
          )
        )
        (linked_temperature)
      )
    )
    (move
      (if
        (alive (bond c0))
        (crowding)
        (sunlight-slope)
      )
    )
  )
  (eat)
  (photosynthesize)
)
```

## Variant 28536: 385 living, 542 births

Harvest 276540.2421875, depth 4.

```lisp
(seq
  (store (target-bearing (bond c2)))
  (do
    (unlink
      (state ((state6 (age)))
        (none)
      )
    )
    (photosynthesize)
  )
  (state ((state6 (temperature)))
    (split)
  )
  (photosynthesize)
  (nop)
  (attack (nearest-corpse) (birth-result))
  (eat)
)
```

## Variant 25157: 373 living, 466 births

Harvest 304943.8984375, depth 2.

```lisp
(seq
  (photosynthesize)
  (split)
  (seq
    (if
      true
      (move (target-storage (self)))
      (give
        (scan-color
          (linked_temperature)
          (target-bearing
            (scan (birth-result) (birth-result))
          )
        )
        (linked_temperature)
      )
    )
    (move
      (if
        (do (set m4 (sunlight)) false)
        (crowding)
        (sunlight-slope)
      )
    )
  )
  (eat)
  (photosynthesize)
)
```

## Variant 29863: 316 living, 867 births

Harvest 300980.1953125, depth 3.

```lisp
(seq
  (photosynthesize)
  (seq
    (eat)
    (photosynthesize)
    (state ((state5 (storage-slope (temperature))))
      (link (bond c1))
    )
  )
  (let ((local3 (target-storage (nearest-corpse))))
    (bud)
  )
  (eat)
  (photosynthesize)
)
```

## Variant 30804: 295 living, 541 births

Harvest 173012.5, depth 3.

```lisp
(seq
  (seq (photosynthesize) (bud))
  (move
    (target-storage
      (state ((state1 (age)))
        (nearest-cell)
      )
    )
  )
  (unlink (if false (self) (nearest-cell)))
  (do
    (seq (eat) (photosynthesize))
    (tag-set
      (target-storage
        (state ((state3 (target-temperature (bond c3))))
          (none)
        )
      )
    )
  )
  (link (nearest-corpse))
)
```

## Variant 22319: 277 living, 3535 births

Harvest 427530.21875, depth 1.

```lisp
(seq
  (turn (storage-bearing (age)))
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
        (do
          (photosynthesize)
          (target-color (nearest-cell))
        )
      )
    )
  )
)
```

## Variant 26285: 231 living, 473 births

Harvest 291315.375, depth 2.

```lisp
(seq
  (seq
    (tag-set
      (let ((local4 (energy)))
        (bonds)
      )
    )
    (unlink (bond c1))
    (photosynthesize)
    (bud)
    (photosynthesize)
  )
  (photosynthesize)
  (eat)
)
```

## Variant 16769: 6348 living, 16400 births

Harvest 5793316.2890625, depth 3.

```lisp
(seq
  (link
    (scan
      (target-energy
        (scan (sunlight-bearing) (color))
      )
      (do (photosynthesize) (rotation))
    )
  )
  (unlink (scan-color (temperature) (storage)))
  (split)
  (eat)
  (move (- (generation) (temperature)))
  (photosynthesize)
)
```

## Variant 16514: 3731 living, 11385 births

Harvest 3986824.50390625, depth 3.

```lisp
(seq
  (state ((state5 (rotation)))
    (eat)
  )
  (seq
    (set
      m0
      (storage-bearing
        (target-storage (nearest-cell))
      )
    )
    (move (birth-result))
  )
  (seq (nop) (photosynthesize))
  (split)
  (photosynthesize)
)
```

## Variant 13755: 2361 living, 20331 births

Harvest 6562261.0703125, depth 2.

```lisp
(seq
  (link
    (scan
      (target-energy
        (scan (sunlight-bearing) (color))
      )
      (do (photosynthesize) (rotation))
    )
  )
  (unlink (scan-color (temperature) (color)))
  (split)
  (eat)
  (move (- (generation) (temperature)))
  (photosynthesize)
)
```

## Variant 17114: 912 living, 5688 births

Harvest 1885566.76953125, depth 3.

```lisp
(seq
  (link
    (scan
      (target-energy
        (scan (sunlight-bearing) (color))
      )
      (do (photosynthesize) (rotation))
    )
  )
  (eat)
  (split)
  (eat)
  (move (- (generation) (temperature)))
  (photosynthesize)
)
```

## Variant 18063: 783 living, 6982 births

Harvest 2509420.7734375, depth 3.

```lisp
(seq
  (state ((state5 (rotation)))
    (eat)
  )
  (seq
    (attack
      (nearest-corpse)
      (let ((local2 (memory m7)))
        (birth-result)
      )
    )
    (move (birth-result))
  )
  (seq (nop) (photosynthesize))
  (split)
  (photosynthesize)
)
```

## Variant 16264: 505 living, 8974 births

Harvest 3231019.94921875, depth 3.

```lisp
(seq
  (link
    (scan
      (target-energy
        (scan (sunlight-bearing) (color))
      )
      (do (photosynthesize) (rotation))
    )
  )
  (unlink
    (scan-color
      (random
        (max
          (target-temperature (nearest-corpse))
          (target-distance (self))
        )
      )
      (color)
    )
  )
  (split)
  (eat)
  (move (- (generation) (temperature)))
  (photosynthesize)
)
```

## Variant 17016: 502 living, 2104 births

Harvest 730323.3515625, depth 2.

```lisp
(seq
  (link
    (scan
      (target-energy
        (scan (sunlight-bearing) (color))
      )
      (do (photosynthesize) (rotation))
    )
  )
  (unlink (scan-color (temperature) (color)))
  (split)
  (eat)
  (move (- (generation) (temperature)))
  (photosynthesize)
)
```

## Variant 17009: 479 living, 1223 births

Harvest 437604.96484375, depth 2.

```lisp
(seq
  (link
    (scan
      (target-energy
        (scan (sunlight-bearing) (color))
      )
      (do (photosynthesize) (rotation))
    )
  )
  (unlink (scan-color (temperature) (color)))
  (split)
  (eat)
  (move (- (generation) (temperature)))
  (photosynthesize)
)
```

## Variant 24607: 434 living, 2090 births

Harvest 928752.125, depth 2.

```lisp
(seq
  (move (sunlight-bearing))
  (move (energy))
  (mobilize
    (target-color
      (do
        (photosynthesize)
        (let ((local3 (linked_temperature)))
          (do (seq (split) (photosynthesize)) (self))
        )
      )
    )
  )
)
```

## Variant 25605: 395 living, 500 births

Harvest 129066.98046875, depth 3.

```lisp
(seq
  (link
    (scan
      (target-energy
        (state ((state1 (sunlight)))
          (bond c3)
        )
      )
      (do (photosynthesize) (rotation))
    )
  )
  (unlink (scan-color (temperature) (color)))
  (split)
  (eat)
  (move
    (-
      (generation)
      (state ((state7 (sunlight)))
        (target-bearing (nearest-cell))
      )
    )
  )
  (photosynthesize)
)
```

## Variant 18174: 272 living, 906 births

Harvest 308600.2578125, depth 3.

```lisp
(seq
  (link
    (scan
      (random (storage-slope (linked_temperature)))
      (do (photosynthesize) (rotation))
    )
  )
  (unlink (scan-color (temperature) (color)))
  (split)
  (eat)
  (move (- (generation) (temperature)))
  (photosynthesize)
)
```

## Variant 26555: 249 living, 293 births

Harvest 112133.0546875, depth 2.

```lisp
(seq
  (seq (unlink (none)) (photosynthesize))
  (tag-set (do (bud) (sunlight-bearing)))
  (photosynthesize)
  (unlink (none))
  (eat)
  (mobilize (energy))
)
```

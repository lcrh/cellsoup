## Variant 13530: 3998 living, 56093 births

Harvest 16777215.99609375, depth 2.

```lisp
(seq
  (seq (photosynthesize) (split))
  (eat)
  (move (target-energy (do (photosynthesize) (self))))
)
```

## Variant 28376: 1801 living, 1972 births

Harvest 786634.23046875, depth 3.

```lisp
(seq
  (photosynthesize)
  (split)
  (eat)
  (seq
    (eat)
    (give
      (nearest-cell)
      (if (not true) (crowding) (bonds))
    )
    (photosynthesize)
  )
  (state ((state4 (storage-slope (temperature))))
    (give (self) (+ (tag) (temperature)))
  )
)
```

## Variant 27183: 1429 living, 1477 births

Harvest 483663.32421875, depth 4.

```lisp
(seq
  (photosynthesize)
  (split)
  (eat)
  (seq
    (eat)
    (give
      (nearest-cell)
      (if (not true) (crowding) (bonds))
    )
    (photosynthesize)
  )
  (state ((state4 (storage-slope (temperature))))
    (give
      (self)
      (+
        (tag)
        (-
          (storage-bearing (birth-result))
          (target-energy (bond c2))
        )
      )
    )
  )
)
```

## Variant 26332: 1375 living, 1602 births

Harvest 478822.30078125, depth 0.

```lisp
(seq
  (eat)
  (seq
    (eat)
    (state ((state3 (temperature)))
      (photosynthesize)
    )
  )
  (do (if (alive (none)) (bud) (bud)) (nop))
  (photosynthesize)
  (unlink
    (let ((local1 (sunlight-slope)))
      (do
        (give (self) (storage))
        (do (photosynthesize) (nearest-cell))
      )
    )
  )
)
```

## Variant 16994: 1153 living, 4772 births

Harvest 1856910.83984375, depth 2.

```lisp
(seq
  (seq (color-set (storage)) (photosynthesize))
  (seq (eat) (move (age)))
  (seq
    (bud)
    (unlink
      (scan
        (birth-result)
        (target-distance
          (let ((local1 (- (bonds) 10)))
            (state ((state2 (rotation)))
              (self)
            )
          )
        )
      )
    )
  )
  (photosynthesize)
)
```

## Variant 26805: 1010 living, 1235 births

Harvest 534373.1015625, depth 1.

```lisp
(seq
  (tag-set (/ (sunlight) (generation)))
  (tag-set (target-bearing (nearest-cell)))
  (do (photosynthesize) (split))
  (mobilize (target-energy (self)))
  (photosynthesize)
  (photosynthesize)
)
```

## Variant 28141: 875 living, 1015 births

Harvest 452159.48046875, depth 0.

```lisp
(seq
  (do
    (do (photosynthesize) (do (split) (eat)))
    (photosynthesize)
  )
  (color-set (temperature))
  (photosynthesize)
)
```

## Variant 28730: 794 living, 1109 births

Harvest 365848.91796875, depth 3.

```lisp
(seq
  (seq (photosynthesize) (split))
  (eat)
  (photosynthesize)
)
```

## Variant 27559: 790 living, 852 births

Harvest 314242.84375, depth 3.

```lisp
(seq
  (tag-set
    (let ((local4 (energy)))
      (bonds)
    )
  )
  (unlink
    (if
      (or
        (alive
          (scan-color (energy) 123.61995697021484)
        )
        (and
          (< (sunlight-bearing) (storage))
          (> (generation) (tag))
        )
      )
      (none)
      (nearest-corpse)
    )
  )
  (photosynthesize)
  (bud)
  (photosynthesize)
)
```

## Variant 26898: 633 living, 832 births

Harvest 379146.28515625, depth 3.

```lisp
(seq
  (tag-set (target-bearing (none)))
  (unlink
    (if
      (or
        (alive
          (scan-color (energy) 123.61995697021484)
        )
        (and
          (< (generation) (sunlight))
          (> (generation) (tag))
        )
      )
      (none)
      (nearest-corpse)
    )
  )
  (photosynthesize)
  (bud)
  (photosynthesize)
)
```

## Variant 13365: 259 living, 4666 births

Harvest 1807162.53515625, depth 1.

```lisp
(seq
  (move (temperature))
  (photosynthesize)
  (let ((local3 (target-storage (nearest-corpse))))
    (split)
  )
  (eat)
  (give
    (nearest-cell)
    (if (not true) (crowding) (bonds))
  )
  (photosynthesize)
)
```

## Variant 27992: 146 living, 2058 births

Harvest 1029949.71484375, depth 2.

```lisp
(seq
  (seq (photosynthesize) (split))
  (eat)
  (move (target-energy (do (photosynthesize) (self))))
)
```

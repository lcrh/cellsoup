## Variant 12512: 17821 living, 59014 births

Harvest 16777215.99609375, depth 2.

```lisp
(seq
  (photosynthesize)
  (split)
  (move (crowding))
  (eat)
  (photosynthesize)
  (give
    (none)
    (let ((local5 (target-tag (none))))
      (storage-slope local5)
    )
  )
)
```

## Variant 10199: 4964 living, 22903 births

Harvest 16777215.99609375, depth 1.

```lisp
(seq
  (if false (photosynthesize) (photosynthesize))
  (eat)
  (move (storage-slope (sunlight-slope)))
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

## Variant 12123: 2572 living, 27436 births

Harvest 16777215.99609375, depth 1.

```lisp
(seq
  (turn (crowding))
  (photosynthesize)
  (state ((state6 (linked_temperature)))
    (seq (split) (eat))
  )
  (nop)
  (seq
    (photosynthesize)
    (move (do (link (self)) (energy)))
  )
  (color-set (generation))
)
```

## Variant 9659: 1237 living, 9660 births

Harvest 7210355.43359375, depth 1.

```lisp
(seq
  (photosynthesize)
  (split)
  (move (storage))
  (eat)
  (photosynthesize)
  (give
    (none)
    (let ((local5 (target-tag (none))))
      (storage-slope local5)
    )
  )
)
```

## Variant 10943: 1030 living, 5537 births

Harvest 4667439.25390625, depth 2.

```lisp
(seq
  (photosynthesize)
  (split)
  (move (storage))
  (eat)
  (photosynthesize)
  (photosynthesize)
)
```

## Variant 12233: 522 living, 10429 births

Harvest 6116739.15625, depth 1.

```lisp
(seq
  (turn (crowding))
  (photosynthesize)
  (state ((state6 (linked_temperature)))
    (seq (split) (eat))
  )
  (nop)
  (seq
    (photosynthesize)
    (move
      (do
        (move (temperature))
        (target-bonds (nearest-cell))
      )
    )
  )
  (color-set (linked_storage))
)
```

## Variant 12718: 369 living, 3957 births

Harvest 2667196.1328125, depth 2.

```lisp
(seq
  (photosynthesize)
  (split)
  (move (storage))
  (eat)
  (photosynthesize)
  (give
    (none)
    (let ((local5 (temperature)))
      (storage-slope local5)
    )
  )
)
```

## Variant 20540: 327 living, 570 births

Harvest 395514.3203125, depth 2.

```lisp
(seq
  (if false (photosynthesize) (photosynthesize))
  (eat)
  (move (storage-slope (sunlight)))
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

## Variant 15635: 317 living, 628 births

Harvest 585241.65234375, depth 1.

```lisp
(seq
  (eat)
  (move (storage-slope (sunlight-slope)))
  (tag-set
    (target-tag (do (photosynthesize) (nearest-cell)))
  )
  (let ((local0 (bonds)))
    (store (mod 360 (rotation)))
  )
  (split)
  (state ((state2 (crowding)))
    (photosynthesize)
  )
)
```

## Variant 15597: 256 living, 341 births

Harvest 258930.5078125, depth 2.

```lisp
(seq
  (if false (photosynthesize) (photosynthesize))
  (eat)
  (move (storage-slope (sunlight-slope)))
  (tag-set
    (target-tag
      (do
        (if true (photosynthesize) (nop))
        (nearest-cell)
      )
    )
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

## Variant 11594: 213 living, 4925 births

Harvest 4120840.65625, depth 2.

```lisp
(seq
  (seq
    (photosynthesize)
    (let ((local1 (tag)))
      (tag-set
        (max
          (temperature)
          (target-temperature
            (state ((state3 (sunlight-slope)))
              (nearest-corpse)
            )
          )
        )
      )
    )
  )
  (split)
  (move (storage))
  (eat)
  (photosynthesize)
  (give
    (none)
    (let ((local5 (target-tag (none))))
      (storage-slope local5)
    )
  )
)
```

## Variant 14333: 164 living, 927 births

Harvest 599286.0703125, depth 2.

```lisp
(seq
  (turn
    (random
      (*
        (color)
        (min
          (target-energy (nearest-cell))
          (* (tag) (temperature))
        )
      )
    )
  )
  (photosynthesize)
  (state ((state6 (linked_temperature)))
    (seq (split) (eat))
  )
  (nop)
  (seq
    (photosynthesize)
    (move (do (link (self)) (energy)))
  )
  (color-set (generation))
)
```

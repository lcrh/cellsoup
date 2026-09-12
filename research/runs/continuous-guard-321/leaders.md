## Variant 9471: 15143 living, 109623 births

Harvest 16777215.99609375, depth 1.

```lisp
(seq
  (if false (photosynthesize) (photosynthesize))
  (eat)
  (tag-set (target-color (do (split) (nearest-cell))))
  (tag-set
    (target-tag (do (photosynthesize) (nearest-cell)))
  )
  (move (birth-result))
)
```

## Variant 12763: 3820 living, 10670 births

Harvest 9541614.97265625, depth 1.

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

## Variant 8772: 1142 living, 19802 births

Harvest 10231382.4921875, depth 1.

```lisp
(seq
  (if
    (state ((state1 (if
        false
        (rotation)
        (abs (target-bearing (none)))
      )))
      false
    )
    (photosynthesize)
    (photosynthesize)
  )
  (eat)
  (tag-set (target-color (do (split) (nearest-cell))))
  (move (sunlight-bearing))
  (photosynthesize)
)
```

## Variant 27428: 853 living, 1378 births

Harvest 872151.734375, depth 2.

```lisp
(seq
  (photosynthesize)
  (link (nearest-corpse))
  (do
    (if
      (kin (bond c3))
      (give
        (let ((local3 (sunlight-slope)))
          (nearest-cell)
        )
        (color)
      )
      (nop)
    )
    (eat)
  )
  (seq
    (split)
    (do
      (attack (nearest-corpse) (random (crowding)))
      (photosynthesize)
    )
  )
  (color-set (memory m6))
)
```

## Variant 14519: 851 living, 2412 births

Harvest 2349508.74609375, depth 1.

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
        (if
          (alive (nearest-cell))
          (nop)
          (link (self))
        )
        (target-bonds (nearest-cell))
      )
    )
  )
  (color-set (generation))
)
```

## Variant 15197: 812 living, 2154 births

Harvest 1815575.078125, depth 2.

```lisp
(seq
  (do (photosynthesize) (split))
  (photosynthesize)
  (store (tag))
  (give
    (nearest-cell)
    (let ((local3 (do (if false (nop) (nop)) (storage))))
      (tag)
    )
  )
  (do
    (nop)
    (attack
      (do (eat) (none))
      (target-color
        (scan-color 1 (target-temperature (self)))
      )
    )
  )
)
```

## Variant 15104: 657 living, 2094 births

Harvest 1714194.33203125, depth 1.

```lisp
(seq
  (photosynthesize)
  (link (nearest-corpse))
  (do
    (if
      (kin (bond c3))
      (give
        (let ((local3 (sunlight-slope)))
          (nearest-cell)
        )
        (generation)
      )
      (nop)
    )
    (eat)
  )
  (seq
    (split)
    (do
      (attack (nearest-corpse) (random (crowding)))
      (photosynthesize)
    )
  )
  (color-set (memory m6))
)
```

## Variant 11109: 577 living, 1538 births

Harvest 1358181.31640625, depth 1.

```lisp
(seq
  (state ((state1 (listen c1)))
    (do
      (if
        (do (tag-set (crowding)) true)
        (photosynthesize)
        (nop)
      )
      (split)
    )
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

## Variant 21098: 454 living, 939 births

Harvest 537719.7734375, depth 2.

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
        (if
          (alive (nearest-cell))
          (nop)
          (link (scan-color (crowding) (energy)))
        )
        (target-bonds (nearest-cell))
      )
    )
  )
  (color-set (generation))
)
```

## Variant 12765: 376 living, 3155 births

Harvest 3106833.23828125, depth 1.

```lisp
(seq
  (photosynthesize)
  (eat)
  (if
    (kin
      (do
        (tag-set (generation))
        (scan-color
          (sunlight)
          (if (not true) (age) (linked_temperature))
        )
      )
    )
    (let ((local1 (target-storage (nearest-corpse))))
      (eat)
    )
    (nop)
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

## Variant 15048: 332 living, 733 births

Harvest 760952.8203125, depth 1.

```lisp
(seq
  (photosynthesize)
  (nop)
  (let ((local1 (target-storage (nearest-corpse))))
    (eat)
  )
  (split)
  (if
    (and
      (> (sunlight) (temperature))
      (kin
        (scan-color
          -1
          (state ((state2 (age)))
            (color)
          )
        )
      )
    )
    (nop)
    (link
      (let ((local7 (sunlight)))
        (self)
      )
    )
  )
  (photosynthesize)
)
```

## Variant 15595: 329 living, 1119 births

Harvest 849519.625, depth 2.

```lisp
(seq
  (do (photosynthesize) (split))
  (photosynthesize)
  (store (tag))
  (give
    (nearest-cell)
    (let ((local3 (do (nop) (storage))))
      (tag)
    )
  )
  (do
    (state ((state5 (energy)))
      (eat)
    )
    (attack
      (do (eat) (none))
      (target-color
        (scan-color 1 (target-temperature (self)))
      )
    )
  )
)
```

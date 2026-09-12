## Variant 9437: 1009 living, 3378 births

Harvest 958005.86328125, depth 0.

```lisp
(seq
  (give (self) (generation))
  (give (nearest-corpse) (crowding))
  (photosynthesize)
  (do
    (move (sunlight-bearing))
    (seq
      (mobilize
        (target-color (scan-color 2 (crowding)))
      )
      (split)
      (photosynthesize)
    )
  )
  (nop)
  (eat)
)
```

## Variant 9621: 49 living, 48 births

Harvest 29440.33203125, depth 1.

```lisp
(seq
  (seq (turn (storage)) (photosynthesize))
  (tag-set (do (bud) (sunlight-bearing)))
  (photosynthesize)
  (link (nearest-corpse))
  (mobilize (energy))
)
```

## Variant 9739: 30 living, 29 births

Harvest 24549.40625, depth 1.

```lisp
(seq
  (seq (eat) (photosynthesize))
  (tag-set (do (bud) (sunlight-bearing)))
  (photosynthesize)
  (link (nearest-corpse))
  (eat)
  (mobilize (energy))
)
```

## Variant 9580: 16 living, 16 births

Harvest 7357.1171875, depth 0.

```lisp
(seq
  (seq (turn (storage)) (photosynthesize))
  (tag-set (do (bud) (sunlight-bearing)))
  (photosynthesize)
  (link (nearest-corpse))
  (eat)
  (mobilize (energy))
)
```

## Variant 10207: 16 living, 15 births

Harvest 11015.44140625, depth 1.

```lisp
(seq
  (emit c0 (min (sunlight-bearing) 90))
  (photosynthesize)
  (bud)
  (set m0 (storage-slope -1))
  (photosynthesize)
)
```

## Variant 10139: 12 living, 29 births

Harvest 24431.625, depth 1.

```lisp
(seq
  (seq (turn (storage)) (photosynthesize))
  (tag-set (do (bud) (sunlight-bearing)))
  (photosynthesize)
  (color-set
    (target-storage
      (let ((local5 (target-color (none))))
        (state ((state5 (receive c0)))
          (self)
        )
      )
    )
  )
  (eat)
  (mobilize (energy))
)
```

## Variant 8977: 1 living, 0 births

Harvest 1983.37890625, depth 1.

```lisp
(seq
  (if true (photosynthesize) (nop))
  (move (color))
  (set m2 (sunlight))
  (nop)
  (unlink
    (do
      (eat)
      (state ((state6 (tag)))
        (nearest-cell)
      )
    )
  )
  (unlink
    (let ((local5 (if
        (kin (nearest-cell))
        (sunlight-slope)
        (bonds)
      )))
      (none)
    )
  )
)
```

## Variant 10230: 1 living, 0 births

Harvest 1357.19140625, depth 0.

```lisp
(seq (turn (linked_storage)) (photosynthesize) (nop))
```

## Variant 10458: 1 living, 0 births

Harvest 1269.984375, depth 0.

```lisp
(seq
  (photosynthesize)
  (if
    true
    (tag-set 3)
    (turn
      (target-distance
        (if
          (kin (none))
          (bond c3)
          (if false (nearest-cell) (none))
        )
      )
    )
  )
)
```

## Variant 9870: 1 living, 0 births

Harvest 1303.0234375, depth 0.

```lisp
(seq
  (store (sunlight-bearing))
  (photosynthesize)
  (tag-set
    (storage-slope
      (/
        (target-distance
          (if false (nearest-corpse) (none))
        )
        (sunlight-bearing)
      )
    )
  )
)
```

## Variant 6924: 1 living, 1484 births

Harvest 194442.08203125, depth 0.

```lisp
(seq
  (if true (photosynthesize) (nop))
  (move (color))
  (set m2 (sunlight))
  (nop)
  (unlink
    (do
      (eat)
      (state ((state6 (tag)))
        (nearest-cell)
      )
    )
  )
  (let ((local3 (min (sunlight-slope) (rotation))))
    (if (kin (nearest-corpse)) (bud) (split))
  )
)
```

## Variant 10290: 1 living, 0 births

Harvest 1169.78515625, depth 0.

```lisp
(seq
  (move (bonds))
  (set m1 (crowding))
  (unlink (nearest-cell))
  (photosynthesize)
)
```

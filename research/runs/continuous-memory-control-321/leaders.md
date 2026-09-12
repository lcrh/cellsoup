## Variant 12839: 11398 living, 41093 births

Harvest 16777215.99609375, depth 1.

```lisp
(seq
  (photosynthesize)
  (nop)
  (let ((local1 (target-storage (nearest-corpse))))
    (turn (random (crowding)))
  )
  (split)
  (seq
    (move (energy))
    (do
      (mobilize (sunlight))
      (do (photosynthesize) (eat))
    )
    (split)
  )
  (photosynthesize)
)
```

## Variant 10015: 6882 living, 47809 births

Harvest 16777215.99609375, depth 1.

```lisp
(seq
  (photosynthesize)
  (nop)
  (let ((local1 (target-storage (nearest-corpse))))
    (turn (random (crowding)))
  )
  (split)
  (seq
    (move (storage-bearing 0.25))
    (do
      (mobilize (sunlight))
      (do (photosynthesize) (eat))
    )
    (split)
  )
  (photosynthesize)
)
```

## Variant 11665: 1133 living, 6092 births

Harvest 3782772.0625, depth 2.

```lisp
(seq
  (photosynthesize)
  (if (kin (self)) (nop) (split))
  (let ((local1 (target-storage (nearest-corpse))))
    (turn (random (crowding)))
  )
  (split)
  (seq
    (move (storage-bearing 0.25))
    (do
      (mobilize (sunlight))
      (do (photosynthesize) (eat))
    )
    (split)
  )
  (photosynthesize)
)
```

## Variant 14216: 1124 living, 6434 births

Harvest 3969593.2421875, depth 1.

```lisp
(seq
  (photosynthesize)
  (nop)
  (let ((local1 (target-storage (nearest-corpse))))
    (turn (random (crowding)))
  )
  (split)
  (seq
    (move (storage-bearing 0.25))
    (do
      (mobilize (sunlight))
      (do (photosynthesize) (eat))
    )
    (split)
  )
  (photosynthesize)
)
```

## Variant 13990: 762 living, 4182 births

Harvest 2769739.79296875, depth 2.

```lisp
(seq
  (photosynthesize)
  (nop)
  (let ((local1 (target-storage (nearest-corpse))))
    (turn (random (crowding)))
  )
  (split)
  (seq
    (move (storage-bearing 0.25))
    (do
      (mobilize (sunlight))
      (do (photosynthesize) (eat))
    )
    (state ((state0 (temperature)))
      (photosynthesize)
    )
  )
  (photosynthesize)
)
```

## Variant 16461: 695 living, 1267 births

Harvest 888927.515625, depth 2.

```lisp
(seq
  (photosynthesize)
  (split)
  (move (storage))
  (eat)
  (photosynthesize)
  (give (nearest-corpse) (bonds))
)
```

## Variant 11712: 526 living, 3948 births

Harvest 3132024.24609375, depth 2.

```lisp
(seq
  (photosynthesize)
  (split)
  (move (storage))
  (eat)
  (photosynthesize)
  (give
    (none)
    (let ((local5 (mod
        (storage-slope 360)
        (target-tag (do (eat) (nearest-cell)))
      )))
      (storage-slope local5)
    )
  )
)
```

## Variant 11753: 503 living, 3508 births

Harvest 2043893.04296875, depth 1.

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
  (unlink (nearest-corpse))
  (move (sunlight-bearing))
  (photosynthesize)
)
```

## Variant 13644: 445 living, 3012 births

Harvest 1940203.265625, depth 2.

```lisp
(seq
  (photosynthesize)
  (split)
  (move (storage))
  (eat)
  (photosynthesize)
  (give
    (none)
    (let ((local5 (target-tag (nearest-cell))))
      (storage-slope local5)
    )
  )
)
```

## Variant 11553: 438 living, 4432 births

Harvest 3014984.73046875, depth 2.

```lisp
(seq
  (photosynthesize)
  (split)
  (move (storage))
  (eat)
  (photosynthesize)
  (give
    (none)
    (let ((local5 (color)))
      (storage-slope local5)
    )
  )
)
```

## Variant 12073: 416 living, 2351 births

Harvest 1510196.66015625, depth 1.

```lisp
(seq
  (photosynthesize)
  (nop)
  (let ((local1 (target-storage (nearest-corpse))))
    (turn (random (crowding)))
  )
  (split)
  (seq
    (move (storage-bearing 0.25))
    (do
      (mobilize (sunlight))
      (do (photosynthesize) (eat))
    )
    (split)
  )
  (photosynthesize)
)
```

## Variant 11358: 374 living, 1712 births

Harvest 1253892.37890625, depth 2.

```lisp
(seq
  (photosynthesize)
  (split)
  (move (storage))
  (eat)
  (photosynthesize)
  (give (none) (memory m5))
)
```

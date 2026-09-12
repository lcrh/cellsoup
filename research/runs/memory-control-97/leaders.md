## Variant 10024: 1658 living, 1827 births

Harvest 637317.0625, depth 1.

```lisp
(seq
  (if true (photosynthesize) (nop))
  (move (color))
  (set m2 (sunlight))
  (nop)
  (eat)
  (bud)
  (photosynthesize)
)
```

## Variant 7838: 24 living, 102 births

Harvest 26348.359375, depth 0.

```lisp
(seq
  (if (alive (self)) (photosynthesize) (bud))
  (if (alive (none)) (bud) (bud))
  (if (kin (self)) (move (sunlight-slope)) (nop))
  (photosynthesize)
  (eat)
)
```

## Variant 3885: 5 living, 5 births

Harvest 5581.8828125, depth 0.

```lisp
(seq
  (do (photosynthesize) (link (none)))
  (split)
  (photosynthesize)
  (turn (sunlight-bearing))
  (photosynthesize)
  (move
    (+
      (do
        (emit c2 (linked_temperature))
        (temperature)
      )
      (color)
    )
  )
)
```

## Variant 442: 3 living, 86 births

Harvest 28971.71484375, depth 0.

```lisp
(seq
  (eat)
  (photosynthesize)
  (send
    (scan (temperature) (linked_temperature))
    c0
    (target-bearing (self))
  )
  (split)
  (photosynthesize)
)
```

## Variant 9122: 1 living, 0 births

Harvest 1574.8984375, depth 1.

```lisp
(seq
  (nop)
  (move (max (sunlight) (temperature)))
  (eat)
  (move (birth-result))
  (photosynthesize)
)
```

## Variant 9822: 1 living, 0 births

Harvest 1384.03125, depth 0.

```lisp
(seq
  (unlink (scan (rotation) (sunlight-slope)))
  (color-set (+ (sunlight) (generation)))
  (if
    (kin
      (let ((local5 (bonds)))
        (self)
      )
    )
    (photosynthesize)
    (eat)
  )
)
```

## Variant 9983: 1 living, 0 births

Harvest 1422.58984375, depth 1.

```lisp
(seq
  (link (self))
  (move (max (sunlight) (temperature)))
  (eat)
  (send
    (if
      (not (= (sunlight) (generation)))
      (bond c3)
      (nearest-corpse)
    )
    c1
    (target-energy (bond c1))
  )
  (photosynthesize)
)
```

## Variant 9252: 1 living, 0 births

Harvest 1521.78125, depth 1.

```lisp
(seq
  (give (nearest-corpse) (memory m2))
  (seq (photosynthesize) (color-set (sunlight-slope)))
  (attack (nearest-corpse) (memory m2))
)
```

## Variant 10532: 1 living, 0 births

Harvest 1344.578125, depth 0.

```lisp
(seq
  (send (self) c0 (target-bonds (none)))
  (emit c0 (target-tag (none)))
  (do
    (mobilize (tag))
    (give (nearest-corpse) (temperature))
  )
  (mobilize (target-color (bond c3)))
  (state ((state1 (listen c1)))
    (photosynthesize)
  )
)
```

## Variant 9277: 1 living, 0 births

Harvest 1298.9609375, depth 0.

```lisp
(seq
  (tag-set (energy))
  (give
    (do
      (photosynthesize)
      (scan-color (target-distance (nearest-cell)) -1)
    )
    (target-color (self))
  )
  (do (send (none) c0 (tag)) (tag-set (color)))
  (nop)
)
```

## Variant 8712: 1 living, 0 births

Harvest 2058.27734375, depth 1.

```lisp
(seq
  (if true (photosynthesize) (nop))
  (move (color))
  (set m2 (sunlight))
  (nop)
  (eat)
)
```

## Variant 10592: 1 living, 0 births

Harvest 665.296875, depth 0.

```lisp
(seq
  (tag-set (sunlight))
  (photosynthesize)
  (split)
  (if
    true
    (set
      m3
      (max
        (target-storage (scan (generation) (tag)))
        (generation)
      )
    )
    (give (bond c0) (energy))
  )
)
```

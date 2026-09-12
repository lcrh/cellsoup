## Variant 10311: 642 living, 828 births

Harvest 144958.4453125, depth 1.

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
        (link (self))
        (let ((local2 60))
          (generation)
        )
      )
    )
  )
  (color-set (generation))
)
```

## Variant 5790: 218 living, 319 births

Harvest 56091.515625, depth 0.

```lisp
(seq
  (color-set
    (target-storage
      (if false (bond c1) (nearest-cell))
    )
  )
  (do (do (eat) (photosynthesize)) (bud))
  (give
    (do (tag-set (linked_temperature)) (nearest-cell))
    (target-distance (nearest-cell))
  )
  (let ((local5 (do (seq (photosynthesize) (nop)) (energy))))
    (tag-set (target-temperature (none)))
  )
)
```

## Variant 9847: 111 living, 128 births

Harvest 16084.9296875, depth 1.

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
        (link (self))
        (do
          (turn (- (linked_storage) (sunlight)))
          (* (generation) (random (generation)))
        )
      )
    )
  )
  (color-set (generation))
)
```

## Variant 2489: 42 living, 47 births

Harvest 15971.125, depth 0.

```lisp
(seq
  (color-set (tag))
  (photosynthesize)
  (tag-set (tag))
  (split)
  (link (self))
  (photosynthesize)
)
```

## Variant 10398: 39 living, 41 births

Harvest 6909.01953125, depth 1.

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
  (let ((local7 (tag)))
    (photosynthesize)
  )
)
```

## Variant 10586: 27 living, 30 births

Harvest 7992.57421875, depth 2.

```lisp
(seq
  (if false (photosynthesize) (photosynthesize))
  (eat)
  (tag-set (target-color (do (split) (nearest-cell))))
  (tag-set
    (target-tag (do (photosynthesize) (nearest-cell)))
  )
  (let ((local0 (birth-result)))
    (tag-set (birth-result))
  )
  (photosynthesize)
)
```

## Variant 9101: 21 living, 23 births

Harvest 9920.01171875, depth 0.

```lisp
(seq
  (let ((local7 (rotation)))
    (photosynthesize)
  )
  (move (target-storage (nearest-corpse)))
  (mobilize (target-tag (bond c1)))
  (split)
  (photosynthesize)
  (unlink
    (do
      (if (not false) (eat) (bud))
      (let ((local6 (if false (sunlight) (storage))))
        (none)
      )
    )
  )
)
```

## Variant 9291: 17 living, 38 births

Harvest 10673, depth 0.

```lisp
(seq
  (if false (photosynthesize) (photosynthesize))
  (eat)
  (tag-set (target-color (do (split) (nearest-cell))))
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

## Variant 9365: 14 living, 13 births

Harvest 1740.4375, depth 0.

```lisp
(seq
  (photosynthesize)
  (tag-set (birth-result))
  (nop)
  (seq
    (bud)
    (do
      (attack (self) (bonds))
      (seq
        (mobilize (target-color (nearest-corpse)))
        (photosynthesize)
      )
    )
  )
  (shield (storage))
)
```

## Variant 10577: 12 living, 14 births

Harvest 4841.1171875, depth 1.

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
  (let ((local7 (target-bearing (bond c0))))
    (photosynthesize)
  )
)
```

## Variant 10477: 10 living, 9 births

Harvest 2066.21875, depth 1.

```lisp
(seq
  (turn (crowding))
  (photosynthesize)
  (bud)
  (nop)
  (seq
    (photosynthesize)
    (move
      (do (link (self)) (target-bonds (nearest-cell)))
    )
  )
  (color-set (generation))
)
```

## Variant 8889: 9 living, 35 births

Harvest 20046.40625, depth 1.

```lisp
(seq
  (if false (photosynthesize) (photosynthesize))
  (eat)
  (tag-set (target-color (do (split) (nearest-cell))))
  (tag-set
    (target-tag (do (photosynthesize) (nearest-cell)))
  )
)
```

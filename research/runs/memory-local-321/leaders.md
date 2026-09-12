## Variant 5790: 648 living, 841 births

Harvest 106427.640625, depth 0.

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

## Variant 8971: 47 living, 46 births

Harvest 17256.8984375, depth 1.

```lisp
(seq
  (nop)
  (color-set (target-shield (nearest-cell)))
  (state ((state3 (target-bonds (scan-color (energy) (generation)))))
    (photosynthesize)
  )
  (eat)
  (move (energy))
  (do
    (if false (photosynthesize) (bud))
    (let ((local1 (storage-slope (sunlight-bearing))))
      (if false (photosynthesize) (photosynthesize))
    )
  )
)
```

## Variant 10420: 31 living, 39 births

Harvest 12627.30859375, depth 2.

```lisp
(seq
  (photosynthesize)
  (nop)
  (let ((local7 (target-storage (nearest-corpse))))
    (eat)
  )
  (split)
  (link
    (let ((local3 (sunlight)))
      (self)
    )
  )
  (photosynthesize)
)
```

## Variant 10072: 30 living, 29 births

Harvest 11449.47265625, depth 1.

```lisp
(seq
  (turn (crowding))
  (photosynthesize)
  (state ((state6 (linked_temperature)))
    (seq (split) (nop))
  )
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

## Variant 10032: 28 living, 27 births

Harvest 8367.98046875, depth 0.

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

## Variant 10249: 21 living, 20 births

Harvest 3220.296875, depth 2.

```lisp
(seq
  (if false (photosynthesize) (photosynthesize))
  (eat)
  (tag-set (target-color (do (split) (nearest-cell))))
  (tag-set
    (target-tag (do (photosynthesize) (nearest-cell)))
  )
  (let ((local0 (bonds)))
    (turn (birth-result))
  )
  (if
    (not (not (alive (nearest-cell))))
    (photosynthesize)
    (photosynthesize)
  )
)
```

## Variant 9666: 20 living, 40 births

Harvest 9920.7734375, depth 1.

```lisp
(seq
  (if false (photosynthesize) (photosynthesize))
  (eat)
  (tag-set (target-color (do (split) (none))))
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

## Variant 6718: 16 living, 80 births

Harvest 22276.203125, depth 0.

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

## Variant 2489: 13 living, 12 births

Harvest 6997.265625, depth 0.

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

## Variant 10101: 13 living, 15 births

Harvest 5434.375, depth 1.

```lisp
(seq
  (photosynthesize)
  (photosynthesize)
  (state ((state6 (linked_temperature)))
    (seq (split) (eat))
  )
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

## Variant 8814: 8 living, 23 births

Harvest 8860.73828125, depth 0.

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

## Variant 9300: 7 living, 32 births

Harvest 4522.6875, depth 1.

```lisp
(seq
  (eat)
  (unlink
    (if (do (bud) true) (nearest-corpse) (self))
  )
  (move 10)
  (photosynthesize)
)
```

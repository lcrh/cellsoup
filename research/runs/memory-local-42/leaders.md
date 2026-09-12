## Variant 10388: 143 living, 148 births

Harvest 75523.10546875, depth 1.

```lisp
(seq
  (turn (sunlight-slope))
  (do (photosynthesize) (split))
  (mobilize (target-energy (none)))
  (unlink
    (state ((state4 (storage-bearing (crowding))))
      (scan
        (temperature)
        (+
          (target-bonds
            (if
              (if true true false)
              (nearest-corpse)
              (nearest-cell)
            )
          )
          (tag)
        )
      )
    )
  )
  (photosynthesize)
)
```

## Variant 10360: 28 living, 36 births

Harvest 18539.20703125, depth 0.

```lisp
(seq
  (tag-set (/ (sunlight) (abs 0.10000000149011612)))
  (tag-set (target-bearing (nearest-cell)))
  (do (photosynthesize) (split))
  (mobilize (target-energy (none)))
  (unlink
    (state ((state4 (storage-bearing (crowding))))
      (nearest-corpse)
    )
  )
  (photosynthesize)
)
```

## Variant 10530: 22 living, 33 births

Harvest 15279.1328125, depth 1.

```lisp
(seq
  (turn (rotation))
  (do (photosynthesize) (split))
  (mobilize (target-energy (none)))
  (unlink
    (state ((state4 (storage-bearing (crowding))))
      (nearest-corpse)
    )
  )
  (photosynthesize)
)
```

## Variant 9643: 6 living, 6 births

Harvest 4434.4140625, depth 1.

```lisp
(seq
  (split)
  (nop)
  (let ((local2 (sunlight)))
    (give (none) (energy))
  )
  (seq (eat) (do (turn (sunlight-bearing)) (nop)))
  (photosynthesize)
  (move (sunlight))
)
```

## Variant 10259: 6 living, 5 births

Harvest 1275.23828125, depth 1.

```lisp
(seq
  (tag-set (/ (sunlight) (abs 0.10000000149011612)))
  (tag-set (target-bearing (nearest-cell)))
  (do (photosynthesize) (split))
  (mobilize (target-energy (none)))
  (unlink
    (state ((state4 (storage-bearing (energy))))
      (nearest-corpse)
    )
  )
  (photosynthesize)
)
```

## Variant 10347: 4 living, 3 births

Harvest 2530.48828125, depth 1.

```lisp
(seq
  (tag-set
    (let ((local4 (energy)))
      (bonds)
    )
  )
  (link (if false (none) (nearest-corpse)))
  (photosynthesize)
  (bud)
  (photosynthesize)
)
```

## Variant 9557: 3 living, 14 births

Harvest 6513.15234375, depth 1.

```lisp
(seq
  (tag-set (/ (sunlight) (generation)))
  (tag-set (target-bearing (nearest-cell)))
  (do (photosynthesize) (split))
  (mobilize (target-energy (none)))
  (unlink
    (state ((state4 (storage-bearing (crowding))))
      (self)
    )
  )
  (photosynthesize)
)
```

## Variant 10471: 1 living, 0 births

Harvest 870.4140625, depth 0.

```lisp
(seq
  (let ((local2 (tag)))
    (eat)
  )
  (photosynthesize)
  (split)
  (split)
  (photosynthesize)
)
```

## Variant 9709: 1 living, 0 births

Harvest 716.87890625, depth 1.

```lisp
(seq
  (move (target-storage (nearest-corpse)))
  (eat)
  (seq (if true (nop) (nop)) (move (tag)))
  (eat)
  (photosynthesize)
)
```

## Variant 9476: 1 living, 0 births

Harvest 1743.08984375, depth 1.

```lisp
(seq
  (seq (photosynthesize) (shield (crowding)))
  (eat)
  (move (temperature))
)
```

## Variant 10085: 1 living, 0 births

Harvest 1608.5859375, depth 1.

```lisp
(seq
  (eat)
  (move (color))
  (photosynthesize)
  (link (self))
  (link
    (state ((state3 (do (bud) (receive c3))))
      (if
        (kin (bond c1))
        (self)
        (state ((state0 (* (sunlight-bearing) (color))))
          (scan (rotation) (generation))
        )
      )
    )
  )
)
```

## Variant 4122: 1 living, 0 births

Harvest 2903.16796875, depth 0.

```lisp
(seq
  (nop)
  (mobilize (linked_storage))
  (eat)
  (move (age))
  (set m4 (target-energy (scan (color) (crowding))))
  (photosynthesize)
)
```

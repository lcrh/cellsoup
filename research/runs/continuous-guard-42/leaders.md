## Variant 14783: 3473 living, 14040 births

Harvest 5903444.84375, depth 3.

```lisp
(seq
  (seq
    (photosynthesize)
    (tag-set (generation))
    (split)
    (photosynthesize)
    (if
      (state ((state0 (abs (sunlight-bearing))))
        (kin (none))
      )
      (nop)
      (seq (bud) (photosynthesize))
    )
  )
  (eat)
  (if false (nop) (move (temperature)))
)
```

## Variant 29648: 1355 living, 1419 births

Harvest 467923.4921875, depth 2.

```lisp
(if
  (kin (none))
  (nop)
  (seq
    (if
      false
      (nop)
      (tag-set
        (let ((local4 (energy)))
          (bonds)
        )
      )
    )
    (unlink (if false (none) (nearest-corpse)))
    (photosynthesize)
    (bud)
    (photosynthesize)
  )
)
```

## Variant 26437: 943 living, 1053 births

Harvest 364903.26171875, depth 0.

```lisp
(seq
  (attack (bond c2) (listen c0))
  (do (eat) (photosynthesize))
  (state ((state4 (target-shield (nearest-corpse))))
    (color-set (bonds))
  )
  (split)
  (if
    true
    (photosynthesize)
    (emit c2 (- (tag) (bonds)))
  )
)
```

## Variant 13531: 896 living, 7879 births

Harvest 3655148.08984375, depth 1.

```lisp
(seq
  (seq
    (photosynthesize)
    (tag-set
      (let ((local4 (energy)))
        (bonds)
      )
    )
    (unlink (if false (none) (nearest-corpse)))
    (photosynthesize)
    (if
      (state ((state0 (abs (sunlight-bearing))))
        (kin (none))
      )
      (nop)
      (seq (bud) (photosynthesize))
    )
  )
  (eat)
  (move (temperature))
)
```

## Variant 26924: 506 living, 686 births

Harvest 309938.171875, depth 3.

```lisp
(seq
  (seq
    (photosynthesize)
    (tag-set
      (let ((local4 360))
        (bonds)
      )
    )
    (unlink (if false (none) (none)))
    (photosynthesize)
    (if
      (state ((state0 (abs (sunlight-bearing))))
        (kin (none))
      )
      (nop)
      (seq (bud) (photosynthesize))
    )
  )
  (eat)
  (store (bonds))
)
```

## Variant 22331: 492 living, 893 births

Harvest 451890.43359375, depth 2.

```lisp
(seq
  (attack (self) (linked_temperature))
  (eat)
  (photosynthesize)
  (give
    (self)
    (random (mod (target-color (self)) (generation)))
  )
  (do
    (split)
    (do
      (send
        (do (photosynthesize) (nearest-cell))
        c2
        (sunlight)
      )
      (color-set (sunlight-bearing))
    )
  )
)
```

## Variant 28543: 478 living, 517 births

Harvest 232918.88671875, depth 3.

```lisp
(seq
  (tag-set (/ (sunlight) (color)))
  (tag-set (target-bearing (nearest-cell)))
  (do (photosynthesize) (split))
  (if (and (alive (self)) false) (link (none)) (nop))
  (unlink
    (state ((state4 (storage-bearing (crowding))))
      (nearest-corpse)
    )
  )
  (photosynthesize)
)
```

## Variant 12023: 408 living, 6139 births

Harvest 2916860.24609375, depth 2.

```lisp
(seq
  (seq
    (photosynthesize)
    (tag-set
      (let ((local4 (energy)))
        (linked_temperature)
      )
    )
    (unlink (if false (none) (nearest-corpse)))
    (photosynthesize)
    (if
      (state ((state0 (abs (sunlight-bearing))))
        (kin (none))
      )
      (nop)
      (seq (bud) (photosynthesize))
    )
  )
  (eat)
  (move (temperature))
)
```

## Variant 30245: 405 living, 421 births

Harvest 117766.828125, depth 1.

```lisp
(seq
  (photosynthesize)
  (split)
  (link (if false (nearest-corpse) (nearest-corpse)))
  (photosynthesize)
  (if
    (kin (self))
    (seq
      (photosynthesize)
      (mobilize
        (target-distance
          (scan-color (color) (target-bearing (self)))
        )
      )
    )
    (nop)
  )
)
```

## Variant 14135: 383 living, 3375 births

Harvest 1508661.640625, depth 3.

```lisp
(seq
  (seq
    (photosynthesize)
    (tag-set
      (let ((local4 (energy)))
        (bonds)
      )
    )
    (unlink (if true (none) (none)))
    (photosynthesize)
    (if
      (state ((state0 (abs (sunlight-bearing))))
        (kin (none))
      )
      (nop)
      (seq (bud) (photosynthesize))
    )
  )
  (eat)
  (move (temperature))
)
```

## Variant 28077: 362 living, 373 births

Harvest 135364.16796875, depth 2.

```lisp
(if
  (kin (none))
  (nop)
  (seq
    (if
      (and
        (kin (self))
        (or false (do (nop) (alive (none))))
      )
      (tag-set
        (let ((local4 (energy)))
          (bonds)
        )
      )
      (nop)
    )
    (unlink (if false (none) (nearest-corpse)))
    (photosynthesize)
    (bud)
    (photosynthesize)
  )
)
```

## Variant 12092: 340 living, 9657 births

Harvest 4642913.48046875, depth 2.

```lisp
(seq
  (seq
    (photosynthesize)
    (tag-set
      (let ((local4 (energy)))
        (bonds)
      )
    )
    (unlink (if false (none) (none)))
    (photosynthesize)
    (if
      (state ((state0 (abs (sunlight-bearing))))
        (kin (none))
      )
      (nop)
      (seq (bud) (photosynthesize))
    )
  )
  (eat)
  (move (temperature))
)
```

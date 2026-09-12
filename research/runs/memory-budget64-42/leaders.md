## Variant 10550: 245 living, 244 births

Harvest 32744.48828125, depth 1.

```lisp
(seq
  (seq (photosynthesize) (bud))
  (eat)
  (move (target-energy (do (photosynthesize) (self))))
)
```

## Variant 10480: 167 living, 230 births

Harvest 79355.1796875, depth 1.

```lisp
(seq
  (nop)
  (unlink (if false (none) (nearest-corpse)))
  (photosynthesize)
  (bud)
  (photosynthesize)
)
```

## Variant 10374: 4 living, 3 births

Harvest 2704.59765625, depth 0.

```lisp
(seq
  (tag-set
    (let ((local4 (energy)))
      (bonds)
    )
  )
  (unlink (if false (none) (nearest-corpse)))
  (photosynthesize)
  (bud)
  (photosynthesize)
)
```

## Variant 10284: 1 living, 0 births

Harvest 1329.58203125, depth 0.

```lisp
(seq
  (seq (color-set (linked_storage)) (photosynthesize))
  (turn (abs (/ (tag) (abs (temperature)))))
  (shield
    (let ((local6 (sunlight)))
      (color)
    )
  )
  (unlink (nearest-corpse))
  (link
    (scan-color
      (generation)
      (max
        (target-tag (nearest-cell))
        (storage-slope (abs (sunlight)))
      )
    )
  )
)
```

## Variant 10002: 1 living, 0 births

Harvest 1339.63671875, depth 1.

```lisp
(seq
  (eat)
  (move (color))
  (photosynthesize)
  (link (self))
  (link
    (let ((local3 (target-distance
        (scan (crowding) (storage-slope (energy)))
      )))
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

## Variant 9900: 1 living, 0 births

Harvest 1200.09765625, depth 0.

```lisp
(seq
  (unlink (bond c2))
  (seq
    (link
      (do (photosynthesize) (if false (self) (self)))
    )
    (attack
      (nearest-corpse)
      (random (target-bearing (nearest-cell)))
    )
  )
  (eat)
)
```

## Variant 6175: 1 living, 0 births

Harvest 1558.0546875, depth 0.

```lisp
(seq
  (turn (+ (sunlight-bearing) (target-tag (none))))
  (if
    (do (unlink (nearest-corpse)) true)
    (photosynthesize)
    (unlink (nearest-cell))
  )
  (move (color))
  (attack
    (do (shield (bonds)) (nearest-corpse))
    (do (bud) 3)
  )
)
```

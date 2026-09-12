## Variant 9034: 1 living, 0 births

Harvest 1507.62109375, depth 1.

```lisp
(seq
  (do
    (do (eat) (mobilize (tag)))
    (move (target-storage (self)))
  )
  (attack (scan (sunlight-bearing) 3) (energy))
  (photosynthesize)
)
```

## Variant 10285: 1 living, 0 births

Harvest 994.03515625, depth 0.

```lisp
(seq
  (nop)
  (nop)
  (give
    (none)
    (*
      (sunlight)
      (min
        (sunlight-bearing)
        (*
          (rotation)
          (target-distance (nearest-cell))
        )
      )
    )
  )
  (photosynthesize)
)
```

## Variant 10569: 1 living, 0 births

Harvest 1365.828125, depth 0.

```lisp
(seq
  (store (sunlight-bearing))
  (unlink
    (let ((local2 (bonds)))
      (nearest-cell)
    )
  )
  (set m6 (storage))
  (photosynthesize)
)
```

## Variant 9392: 1 living, 0 births

Harvest 841.1171875, depth 0.

```lisp
(seq
  (move (birth-result))
  (state ((state5 (target-color (self))))
    (photosynthesize)
  )
  (shield
    (if
      true
      (min (rotation) (crowding))
      (linked_temperature)
    )
  )
)
```

## Variant 9557: 1 living, 0 births

Harvest 918.3984375, depth 0.

```lisp
(seq
  (do (emit c3 (sunlight)) (set m3 (sunlight)))
  (attack (nearest-cell) (listen c2))
  (attack (self) (sunlight-slope))
  (photosynthesize)
)
```

## Variant 10188: 1 living, 0 births

Harvest 764.69921875, depth 0.

```lisp
(seq
  (turn (tag))
  (link (nearest-corpse))
  (link
    (scan-color
      (color)
      (*
        (target-storage (scan-color (color) (tag)))
        (target-bearing
          (scan (sunlight) (sunlight-bearing))
        )
      )
    )
  )
  (photosynthesize)
)
```

## Variant 1640: 1 living, 1293 births

Harvest 124943.71484375, depth 0.

```lisp
(seq
  (attack (self) (linked_temperature))
  (eat)
  (photosynthesize)
  (move (color))
  (do (split) (move (listen c1)))
)
```

## Variant 4979: 1 living, 0 births

Harvest 1728.6484375, depth 0.

```lisp
(seq
  (mobilize (bonds))
  (send (none) c1 (energy))
  (move
    (target-distance
      (scan-color (color) (sunlight-bearing))
    )
  )
  (mobilize (color))
  (attack
    (scan
      (linked_storage)
      (mod (linked_storage) (sunlight-slope))
    )
    (temperature)
  )
  (photosynthesize)
)
```

## Variant 6128: 1 living, 0 births

Harvest 1552.0546875, depth 0.

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

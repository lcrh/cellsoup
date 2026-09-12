## Variant 442: 3 living, 78 births

Harvest 29157.18359375, depth 0.

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

## Variant 10115: 1 living, 0 births

Harvest 1246.04296875, depth 0.

```lisp
(seq
  (unlink (nearest-corpse))
  (mobilize
    (*
      (if
        (do
          (photosynthesize)
          (< (storage) (birth-result))
        )
        (rotation)
        (max
          (target-color (self))
          (target-distance (nearest-corpse))
        )
      )
      (sunlight-slope)
    )
  )
)
```

## Variant 10116: 1 living, 0 births

Harvest 1302.640625, depth 0.

```lisp
(seq
  (shield
    (- (target-storage (nearest-corpse)) (listen c0))
  )
  (color-set
    (target-bonds
      (state ((state7 (storage)))
        (bond c3)
      )
    )
  )
  (state ((state5 (linked_temperature)))
    (tag-set (color))
  )
  (photosynthesize)
)
```

## Variant 10170: 1 living, 0 births

Harvest 1245.32421875, depth 0.

```lisp
(seq
  (shield
    (let ((local6 (target-color (nearest-cell))))
      (storage-slope (target-bonds (nearest-corpse)))
    )
  )
  (link
    (if
      (if false false (alive (self)))
      (self)
      (scan-color 3 (generation))
    )
  )
  (photosynthesize)
)
```

## Variant 9883: 1 living, 0 births

Harvest 1163.015625, depth 0.

```lisp
(seq
  (give (self) (generation))
  (if
    (alive (nearest-corpse))
    (shield (storage))
    (photosynthesize)
  )
  (give (none) 0)
  (turn (sunlight-slope))
  (move (sunlight-bearing))
)
```

## Variant 10577: 1 living, 0 births

Harvest 1297.859375, depth 0.

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

## Variant 9021: 1 living, 5 births

Harvest 2037.203125, depth 1.

```lisp
(seq
  (if true (photosynthesize) (nop))
  (move (color))
  (set m2 (sunlight))
  (nop)
  (unlink
    (do
      (eat)
      (state ((state2 (tag)))
        (nearest-cell)
      )
    )
  )
  (let ((local3 (sunlight-bearing)))
    (if (kin (nearest-corpse)) (bud) (split))
  )
)
```

## Variant 10400: 1 living, 0 births

Harvest 1192.8984375, depth 0.

```lisp
(seq
  (move (bonds))
  (set m1 (crowding))
  (unlink (nearest-cell))
  (photosynthesize)
)
```

## Variant 10075: 1 living, 0 births

Harvest 1614.02734375, depth 0.

```lisp
(seq
  (eat)
  (do
    (move (target-storage (self)))
    (do (set m4 (crowding)) (photosynthesize))
  )
  (nop)
  (send
    (let ((local0 (linked_temperature)))
      (let ((local0 (random (target-energy (none)))))
        (scan-color (bonds) (tag))
      )
    )
    c2
    (target-color (nearest-cell))
  )
)
```

## Variant 10232: 1 living, 0 births

Harvest 1381.984375, depth 0.

```lisp
(seq
  (contract (crowding))
  (unlink
    (state ((state0 10))
      (nearest-cell)
    )
  )
  (nop)
  (move (abs (storage-slope (rotation))))
  (color-set
    (state ((state7 (age)))
      (linked_storage)
    )
  )
  (do (photosynthesize) (shield (age)))
)
```

## Variant 10526: 1 living, 0 births

Harvest 1152.98828125, depth 0.

```lisp
(seq
  (seq
    (unlink (self))
    (do (nop) (seq (nop) (set m4 (sunlight-bearing))))
  )
  (unlink
    (scan (do (photosynthesize) (color)) (color))
  )
  (set m6 (sunlight))
)
```

## Variant 7838: 1 living, 15 births

Harvest 6988.49609375, depth 0.

```lisp
(seq
  (if (alive (self)) (photosynthesize) (bud))
  (if (alive (none)) (bud) (bud))
  (if (kin (self)) (move (sunlight-slope)) (nop))
  (photosynthesize)
  (eat)
)
```

## Variant 10455: 7836 living, 76328 births

Harvest 16777215.99609375, depth 2.

```lisp
(seq
  (move (temperature))
  (photosynthesize)
  (let ((local3 (target-storage (nearest-corpse))))
    (bud)
  )
  (eat)
  (state ((state4 (target-distance (bond c3))))
    (set m6 (sunlight-bearing))
  )
  (photosynthesize)
)
```

## Variant 11116: 5160 living, 180073 births

Harvest 16777215.99609375, depth 2.

```lisp
(seq
  (move (temperature))
  (photosynthesize)
  (let ((local3 (target-storage (nearest-corpse))))
    (bud)
  )
  (eat)
  (give
    (scan 0 (target-energy (nearest-cell)))
    (if (not true) (crowding) (bonds))
  )
  (photosynthesize)
)
```

## Variant 31359: 1636 living, 1652 births

Harvest 122894.90625, depth 4.

```lisp
(seq
  (send
    (nearest-cell)
    c0
    (storage-bearing
      (random (mod (sunlight) (energy)))
    )
  )
  (photosynthesize)
  (let ((local3 (target-storage (nearest-corpse))))
    (bud)
  )
  (eat)
  (give
    (scan 0 (target-energy (nearest-cell)))
    (bonds)
  )
  (photosynthesize)
)
```

## Variant 20731: 635 living, 8707 births

Harvest 1950501.375, depth 3.

```lisp
(seq
  (send
    (nearest-cell)
    c0
    (storage-bearing
      (random (mod (sunlight) (energy)))
    )
  )
  (photosynthesize)
  (let ((local3 (target-storage (nearest-corpse))))
    (bud)
  )
  (eat)
  (give
    (scan 0 (target-energy (nearest-cell)))
    (if (not true) (crowding) (bonds))
  )
  (photosynthesize)
)
```

## Variant 10344: 461 living, 46786 births

Harvest 9204976.5078125, depth 1.

```lisp
(seq
  (attack (self) (linked_temperature))
  (eat)
  (photosynthesize)
  (move (color))
  (do
    (split)
    (let ((local7 (crowding)))
      (photosynthesize)
    )
  )
)
```

## Variant 27947: 405 living, 3572 births

Harvest 415351.8828125, depth 3.

```lisp
(seq
  (move
    (target-bearing
      (let ((local0 (* (storage) (generation))))
        (self)
      )
    )
  )
  (photosynthesize)
  (let ((local3 (target-storage (nearest-corpse))))
    (bud)
  )
  (eat)
  (give
    (scan 0 (target-energy (nearest-cell)))
    (if (not true) (crowding) (bonds))
  )
  (photosynthesize)
)
```

## Variant 28863: 272 living, 368 births

Harvest 89677.06640625, depth 1.

```lisp
(seq
  (photosynthesize)
  (split)
  (link
    (if
      false
      (let ((local7 (target-distance
          (let ((local7 (storage)))
            (if false (nearest-corpse) (nearest-cell))
          )
        )))
        (none)
      )
      (nearest-corpse)
    )
  )
  (photosynthesize)
  (photosynthesize)
  (mobilize
    (target-distance
      (scan-color (color) (target-bearing (self)))
    )
  )
)
```

## Variant 17121: 209 living, 637 births

Harvest 268030.83984375, depth 3.

```lisp
(seq
  (move (temperature))
  (photosynthesize)
  (let ((local6 (target-storage (nearest-corpse))))
    (bud)
  )
  (eat)
  (photosynthesize)
  (photosynthesize)
)
```

## Variant 24994: 158 living, 208 births

Harvest 49113.5078125, depth 3.

```lisp
(seq
  (seq (photosynthesize) (mobilize (sunlight)))
  (state ((state5 (color)))
    (eat)
  )
  (split)
  (tag-set
    (state ((state5 (target-shield (self))))
      (abs
        (do (photosynthesize) (linked_temperature))
      )
    )
  )
  (color-set (linked_temperature))
  (eat)
)
```

## Variant 28324: 147 living, 198 births

Harvest 49432.66796875, depth 2.

```lisp
(seq
  (seq
    (photosynthesize)
    (do (set m7 (receive c2)) (split))
  )
  (eat)
  (photosynthesize)
)
```

## Variant 28735: 145 living, 197 births

Harvest 69089.10546875, depth 5.

```lisp
(seq
  (do
    (do
      (seq (photosynthesize) (mobilize (sunlight)))
      (mobilize (tag))
    )
    (move (target-storage (bond c3)))
  )
  (seq
    (attack (self) (linked_temperature))
    (eat)
    (photosynthesize)
    (move (age))
    (do
      (bud)
      (let ((local7 (crowding)))
        (photosynthesize)
      )
    )
  )
  (nop)
)
```

## Variant 28427: 119 living, 129 births

Harvest 27522.8671875, depth 6.

```lisp
(seq
  (photosynthesize)
  (split)
  (eat)
  (state ((state4 (storage-slope (storage-bearing (crowding)))))
    (give
      (if
        (do
          (photosynthesize)
          (let ((local5 (linked_storage)))
            (>
              (temperature)
              (/ (sunlight-slope) (storage))
            )
          )
        )
        (nearest-corpse)
        (bond c1)
      )
      (memory m5)
    )
  )
)
```

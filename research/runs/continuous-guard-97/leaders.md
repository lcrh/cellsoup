## Variant 12053: 15693 living, 68511 births

Harvest 16777215.99609375, depth 1.

```lisp
(seq
  (move (color))
  (eat)
  (photosynthesize)
  (send
    (scan
      (target-color
        (let ((local7 (if false (sunlight-slope) (generation))))
          (none)
        )
      )
      (linked_temperature)
    )
    c0
    (target-bearing (self))
  )
  (split)
  (photosynthesize)
)
```

## Variant 27720: 647 living, 1349 births

Harvest 415012.953125, depth 3.

```lisp
(seq
  (mobilize
    (let ((local6 (generation)))
      (bonds)
    )
  )
  (if
    (or
      true
      (<
        (sunlight)
        (do (photosynthesize) (storage-slope (tag)))
      )
    )
    (seq
      (move 0.25)
      (send
        (scan-color (age) (sunlight))
        c0
        (target-tag (none))
      )
      (photosynthesize)
      (split)
      (photosynthesize)
    )
    (nop)
  )
)
```

## Variant 28198: 621 living, 647 births

Harvest 157392.703125, depth 3.

```lisp
(seq
  (mobilize (generation))
  (if
    (or
      true
      (<
        (sunlight)
        (do (photosynthesize) (storage-slope (tag)))
      )
    )
    (seq
      (move 0.25)
      (send
        (scan-color (generation) (sunlight))
        c0
        (target-tag (none))
      )
      (photosynthesize)
      (split)
      (photosynthesize)
    )
    (nop)
  )
)
```

## Variant 14978: 620 living, 2313 births

Harvest 869860.8359375, depth 1.

```lisp
(seq
  (move (color))
  (eat)
  (photosynthesize)
  (send
    (scan
      (target-color
        (let ((local7 (if false (sunlight-slope) (generation))))
          (none)
        )
      )
      (linked_temperature)
    )
    c0
    (target-bearing (self))
  )
  (split)
  (photosynthesize)
)
```

## Variant 25488: 555 living, 649 births

Harvest 178905.15625, depth 3.

```lisp
(seq
  (mobilize
    (let ((local6 (generation)))
      (bonds)
    )
  )
  (if
    (or
      true
      (<
        (sunlight)
        (do (photosynthesize) (storage-slope (tag)))
      )
    )
    (seq
      (move 0.25)
      (send
        (scan-color (generation) (sunlight))
        c0
        (target-energy (nearest-corpse))
      )
      (photosynthesize)
      (split)
      (photosynthesize)
    )
    (nop)
  )
)
```

## Variant 14843: 464 living, 1835 births

Harvest 743909.12109375, depth 1.

```lisp
(seq
  (move (color))
  (eat)
  (photosynthesize)
  (send
    (scan
      (target-color
        (let ((local7 (if false (sunlight-slope) (generation))))
          (none)
        )
      )
      (linked_temperature)
    )
    c0
    (target-bearing (self))
  )
  (split)
  (photosynthesize)
)
```

## Variant 15453: 384 living, 3044 births

Harvest 1814131.1484375, depth 2.

```lisp
(seq
  (state ((state4 (rotation)))
    (eat)
  )
  (if
    (or
      false
      (not
        (>
          (rotation)
          (target-bonds
            (state ((state3 (birth-result)))
              (nearest-corpse)
            )
          )
        )
      )
    )
    (seq
      (photosynthesize)
      (mobilize
        (target-color (scan-color 2 (crowding)))
      )
      (split)
      (photosynthesize)
    )
    (nop)
  )
)
```

## Variant 17612: 328 living, 5697 births

Harvest 2969260.6875, depth 2.

```lisp
(seq
  (move (storage-bearing (listen c2)))
  (eat)
  (photosynthesize)
  (if
    (= (generation) (tag))
    (nop)
    (send
      (scan
        (target-color
          (let ((local7 (if false (sunlight-slope) (generation))))
            (none)
          )
        )
        (linked_temperature)
      )
      c0
      (target-bearing (self))
    )
  )
  (split)
  (photosynthesize)
)
```

## Variant 14200: 311 living, 6726 births

Harvest 2260283.59375, depth 1.

```lisp
(seq
  (move (color))
  (eat)
  (photosynthesize)
  (send
    (scan
      (target-color
        (let ((local7 (if false (sunlight-slope) (generation))))
          (none)
        )
      )
      (linked_temperature)
    )
    c0
    (target-bearing (self))
  )
  (split)
  (photosynthesize)
)
```

## Variant 15956: 302 living, 919 births

Harvest 372267.375, depth 2.

```lisp
(seq
  (move (color))
  (eat)
  (photosynthesize)
  (send
    (scan
      (target-color
        (scan-color (tag) (linked_temperature))
      )
      (linked_temperature)
    )
    c0
    (target-bearing (self))
  )
  (split)
  (photosynthesize)
)
```

## Variant 32013: 275 living, 274 births

Harvest 67753.7890625, depth 4.

```lisp
(seq
  (mobilize
    (let ((local6 (/ (crowding) (color))))
      (temperature)
    )
  )
  (move 0.25)
  (send
    (scan-color (generation) (sunlight))
    c0
    (sunlight-slope)
  )
  (photosynthesize)
  (split)
  (if
    (not (and (alive (nearest-cell)) true))
    (set m7 (sunlight-slope))
    (photosynthesize)
  )
)
```

## Variant 15521: 253 living, 943 births

Harvest 347602.73828125, depth 1.

```lisp
(seq
  (move (color))
  (eat)
  (photosynthesize)
  (send
    (scan
      (target-color
        (let ((local7 (age)))
          (none)
        )
      )
      (linked_temperature)
    )
    c0
    (target-bearing (self))
  )
  (split)
  (photosynthesize)
)
```

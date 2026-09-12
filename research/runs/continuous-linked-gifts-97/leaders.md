## Variant 18382: 20212 living, 127552 births

Harvest 16777215.99609375, depth 0.

```lisp
(seq
  (send (self) c3 (birth-result))
  (nop)
  (move (age))
  (give (bond c2) (bonds))
  (photosynthesize)
  (do
    (state ((state0 (temperature)))
      (bud)
    )
    (photosynthesize)
  )
)
```

## Variant 17026: 4456 living, 100412 births

Harvest 16777215.99609375, depth 0.

```lisp
(seq
  (send (self) c3 (birth-result))
  (nop)
  (move (age))
  (give (bond c2) (bonds))
  (photosynthesize)
  (do
    (state ((state0 (temperature)))
      (bud)
    )
    (photosynthesize)
  )
)
```

## Variant 21026: 2563 living, 18330 births

Harvest 5274335.46484375, depth 0.

```lisp
(seq
  (send (self) c3 (birth-result))
  (nop)
  (move (receive c0))
  (give (bond c2) (bonds))
  (photosynthesize)
  (do
    (state ((state0 (temperature)))
      (bud)
    )
    (photosynthesize)
  )
)
```

## Variant 13190: 380 living, 10721 births

Harvest 2345656.49609375, depth 2.

```lisp
(seq
  (state ((state4 (rotation)))
    (eat)
  )
  (seq
    (seq
      (if false (eat) (eat))
      (photosynthesize)
      (link (nearest-corpse))
    )
    (move (birth-result))
  )
  (mobilize (target-color (scan-color 2 (crowding))))
  (split)
  (photosynthesize)
)
```

## Variant 11125: 311 living, 11784 births

Harvest 3433399.953125, depth 1.

```lisp
(seq
  (state ((state4 (rotation)))
    (eat)
  )
  (seq
    (seq
      (if false (bud) (eat))
      (photosynthesize)
      (link (nearest-corpse))
    )
    (move (birth-result))
  )
  (mobilize (target-color (scan-color 2 (crowding))))
  (split)
  (photosynthesize)
)
```

## Variant 22546: 300 living, 1496 births

Harvest 324833.375, depth 2.

```lisp
(seq
  (move (+ (generation) (tag)))
  (eat)
  (photosynthesize)
  (send
    (state ((state0 (sunlight-slope)))
      (bond c3)
    )
    c0
    (target-bearing (self))
  )
  (split)
  (photosynthesize)
)
```

## Variant 17962: 272 living, 4038 births

Harvest 810763.27734375, depth 2.

```lisp
(seq
  (move (+ (generation) (tag)))
  (eat)
  (photosynthesize)
  (send
    (state ((state0 (sunlight-slope)))
      (bond c3)
    )
    c0
    (target-bearing (self))
  )
  (split)
  (photosynthesize)
)
```

## Variant 17967: 248 living, 1964 births

Harvest 427308.015625, depth 2.

```lisp
(seq
  (move (+ (generation) (tag)))
  (eat)
  (photosynthesize)
  (send
    (let ((local0 (rotation)))
      (scan-color (color) (color))
    )
    c1
    (target-bearing (self))
  )
  (split)
  (photosynthesize)
)
```

## Variant 12877: 69 living, 2261 births

Harvest 639878.49609375, depth 1.

```lisp
(seq
  (state ((state4 (rotation)))
    (eat)
  )
  (seq
    (seq
      (if false (bud) (eat))
      (photosynthesize)
      (link (nearest-corpse))
    )
    (move (birth-result))
  )
  (mobilize (target-color (scan-color 2 (crowding))))
  (split)
  (photosynthesize)
)
```

## Variant 19234: 62 living, 279 births

Harvest 80230.81640625, depth 2.

```lisp
(seq
  (move (+ (generation) (tag)))
  (eat)
  (photosynthesize)
  (send
    (let ((local0 (rotation)))
      (scan-color (color) (tag))
    )
    c0
    (target-bearing (self))
  )
  (split)
  (photosynthesize)
)
```

## Variant 23636: 62 living, 252 births

Harvest 59016.85546875, depth 3.

```lisp
(seq
  (move (+ (generation) (tag)))
  (eat)
  (photosynthesize)
  (send
    (state ((state5 (sunlight-slope)))
      (bond c3)
    )
    c0
    (target-bearing (self))
  )
  (split)
  (photosynthesize)
)
```

## Variant 17438: 55 living, 763 births

Harvest 156189.89453125, depth 2.

```lisp
(seq
  (move (+ (generation) (tag)))
  (eat)
  (photosynthesize)
  (give
    (state ((state2 (temperature)))
      (bond c2)
    )
    (target-tag
      (scan
        (temperature)
        (target-bearing
          (if false (self) (nearest-corpse))
        )
      )
    )
  )
  (split)
  (photosynthesize)
)
```

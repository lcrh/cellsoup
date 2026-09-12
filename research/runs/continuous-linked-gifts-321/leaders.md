## Variant 10865: 18461 living, 83084 births

Harvest 16777215.99609375, depth 1.

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
        (max (sunlight-bearing) (linked_temperature))
      )
    )
  )
  (color-set (generation))
)
```

## Variant 12667: 2057 living, 6475 births

Harvest 3502194.640625, depth 2.

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
        (storage-bearing (sunlight-slope))
      )
    )
  )
  (color-set (+ (age) (crowding)))
)
```

## Variant 18850: 1959 living, 4546 births

Harvest 2800756.92578125, depth 2.

```lisp
(seq
  (do (photosynthesize) (seq (nop) (nop) (split)))
  (move (/ (sunlight) (max (age) (linked_storage))))
  (photosynthesize)
  (state ((state6 (abs 0)))
    (if
      (and true (> (sunlight-slope) (tag)))
      (eat)
      (set m2 (birth-result))
    )
  )
)
```

## Variant 15830: 943 living, 2468 births

Harvest 1580617.76171875, depth 3.

```lisp
(seq
  (seq
    (eat)
    (unlink
      (if
        (>
          (crowding)
          (target-tag
            (scan-color
              (/ (sunlight-slope) (rotation))
              (target-tag
                (state ((state3 (age)))
                  (none)
                )
              )
            )
          )
        )
        (nearest-corpse)
        (self)
      )
    )
    (move (temperature))
    (photosynthesize)
  )
  (bud)
  (photosynthesize)
)
```

## Variant 16179: 860 living, 3607 births

Harvest 2101385.5390625, depth 2.

```lisp
(seq
  (turn (crowding))
  (photosynthesize)
  (state ((state6 (listen c1)))
    (seq (split) (eat))
  )
  (nop)
  (seq
    (photosynthesize)
    (move
      (do
        (let ((local7 (rotation)))
          (photosynthesize)
        )
        (max (sunlight-bearing) (linked_temperature))
      )
    )
  )
  (color-set (generation))
)
```

## Variant 25191: 505 living, 2107 births

Harvest 1133293.14453125, depth 2.

```lisp
(seq
  (turn (birth-result))
  (unlink
    (if
      (do (seq (photosynthesize) (split)) true)
      (nearest-corpse)
      (self)
    )
  )
  (move (sunlight-bearing))
  (photosynthesize)
)
```

## Variant 18273: 445 living, 2134 births

Harvest 1280373.54296875, depth 1.

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
        (max (sunlight-bearing) (linked_temperature))
      )
    )
  )
  (color-set (generation))
)
```

## Variant 15243: 441 living, 1194 births

Harvest 840170.1171875, depth 2.

```lisp
(seq
  (photosynthesize)
  (nop)
  (let ((local1 (target-storage (nearest-corpse))))
    (eat)
  )
  (split)
  (link
    (let ((local7 (+
        (- (sunlight-slope) (rotation))
        (abs (storage-slope (linked_storage)))
      )))
      (self)
    )
  )
  (photosynthesize)
)
```

## Variant 18816: 350 living, 1401 births

Harvest 853744.0546875, depth 1.

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
        (max (sunlight-bearing) (linked_temperature))
      )
    )
  )
  (color-set (generation))
)
```

## Variant 17910: 307 living, 759 births

Harvest 494362.6796875, depth 2.

```lisp
(seq
  (do (photosynthesize) (seq (nop) (nop) (split)))
  (move (birth-result))
  (photosynthesize)
  (state ((state6 (abs 0)))
    (if
      (and true (> (sunlight-slope) (tag)))
      (eat)
      (set m2 (birth-result))
    )
  )
)
```

## Variant 20600: 298 living, 530 births

Harvest 312308.2578125, depth 2.

```lisp
(seq
  (turn (linked_temperature))
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
        (max (sunlight-bearing) (linked_temperature))
      )
    )
  )
  (color-set (generation))
)
```

## Variant 12168: 263 living, 7319 births

Harvest 3138457.25390625, depth 2.

```lisp
(seq
  (seq
    (eat)
    (unlink
      (if
        (>
          (crowding)
          (target-tag
            (scan-color
              (/ (sunlight-slope) (rotation))
              (target-tag
                (state ((state3 (age)))
                  (none)
                )
              )
            )
          )
        )
        (nearest-corpse)
        (self)
      )
    )
    (move (sunlight-bearing))
    (photosynthesize)
  )
  (bud)
  (photosynthesize)
)
```

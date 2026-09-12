## Variant 17780: 2387 living, 7613 births

Harvest 2940375.59765625, depth 3.

```lisp
(seq
  (link (self))
  (move
    (do
      (unlink (do (photosynthesize) (nearest-corpse)))
      (-
        (+
          (target-energy (nearest-corpse))
          (linked_storage)
        )
        (sunlight-slope)
      )
    )
  )
  (eat)
  (seq
    (photosynthesize)
    (do (move (sunlight-bearing)) (bud))
    (nop)
    (eat)
  )
  (photosynthesize)
)
```

## Variant 15333: 1420 living, 10364 births

Harvest 3866720.30078125, depth 0.

```lisp
(seq
  (give (bond c2) (bonds))
  (photosynthesize)
  (do
    (state ((state0 (temperature)))
      (seq
        (eat)
        (move (- (generation) (temperature)))
        (bud)
      )
    )
    (photosynthesize)
  )
)
```

## Variant 13628: 829 living, 19454 births

Harvest 7151117.19921875, depth 2.

```lisp
(seq
  (link (self))
  (move
    (do
      (unlink (do (photosynthesize) (nearest-corpse)))
      (color)
    )
  )
  (eat)
  (bud)
  (photosynthesize)
)
```

## Variant 13777: 817 living, 25047 births

Harvest 9341077.02734375, depth 1.

```lisp
(seq
  (send
    (none)
    c3
    (if
      (kin
        (let ((local5 (storage)))
          (self)
        )
      )
      (energy)
      (linked_storage)
    )
  )
  (move (energy))
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

## Variant 26857: 425 living, 496 births

Harvest 193463, depth 3.

```lisp
(seq
  (do
    (photosynthesize)
    (link
      (if
        (let ((local0 (sunlight)))
          (<
            (max (sunlight) (sunlight-bearing))
            (target-storage (self))
          )
        )
        (nearest-corpse)
        (bond c0)
      )
    )
  )
  (split)
  (photosynthesize)
  (nop)
)
```

## Variant 16407: 413 living, 8194 births

Harvest 2650887.125, depth 2.

```lisp
(seq
  (send
    (none)
    c3
    (if
      (kin
        (let ((local5 (storage)))
          (self)
        )
      )
      (energy)
      (linked_storage)
    )
  )
  (move (random 0.75))
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

## Variant 21043: 355 living, 2375 births

Harvest 837666.01953125, depth 1.

```lisp
(seq
  (give (bond c2) (bonds))
  (photosynthesize)
  (do
    (state ((state0 (temperature)))
      (seq
        (eat)
        (move
          (-
            (generation)
            (target-distance
              (state ((state2 (+ (target-tag (self)) (generation))))
                (bond c0)
              )
            )
          )
        )
        (bud)
      )
    )
    (photosynthesize)
  )
)
```

## Variant 15092: 267 living, 4557 births

Harvest 1631286.3125, depth 2.

```lisp
(seq
  (send
    (none)
    c3
    (if
      (kin
        (let ((local5 (storage)))
          (self)
        )
      )
      (energy)
      (linked_storage)
    )
  )
  (move (energy))
  (eat)
  (photosynthesize)
  (send
    (scan (temperature) (linked_temperature))
    c0
    (target-bearing (nearest-cell))
  )
  (split)
  (photosynthesize)
)
```

## Variant 26622: 251 living, 404 births

Harvest 156059.22265625, depth 1.

```lisp
(seq
  (seq (turn (storage)) (photosynthesize))
  (tag-set (do (split) (sunlight-bearing)))
  (photosynthesize)
  (link (nearest-corpse))
  (eat)
  (mobilize (energy))
)
```

## Variant 15343: 250 living, 2680 births

Harvest 823660.0859375, depth 2.

```lisp
(seq
  (send
    (none)
    c3
    (if
      (kin
        (let ((local5 (storage)))
          (self)
        )
      )
      (energy)
      (linked_storage)
    )
  )
  (move (energy))
  (eat)
  (photosynthesize)
  (send
    (scan (temperature) (linked_temperature))
    c1
    (target-bearing (self))
  )
  (split)
  (photosynthesize)
)
```

## Variant 21467: 224 living, 428 births

Harvest 180324.5390625, depth 2.

```lisp
(seq
  (seq
    (seq
      (photosynthesize)
      (color-set (generation))
      (turn (birth-result))
    )
    (photosynthesize)
  )
  (tag-set (do (split) (sunlight-bearing)))
  (photosynthesize)
  (link (nearest-corpse))
  (eat)
  (mobilize (energy))
)
```

## Variant 20243: 179 living, 1755 births

Harvest 1351551.62890625, depth 2.

```lisp
(seq
  (seq
    (move (target-shield (self)))
    (photosynthesize)
  )
  (tag-set (do (split) (sunlight-bearing)))
  (photosynthesize)
  (link (nearest-corpse))
  (eat)
  (mobilize (energy))
)
```

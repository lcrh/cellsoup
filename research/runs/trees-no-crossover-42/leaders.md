## Variant 9954: 17 living, 65 births

Harvest 11851.14453125, depth 0.

```lisp
(seq
  (eat)
  (photosynthesize)
  (seq (bud) (eat))
  (set m7 (target-temperature (self)))
  (photosynthesize)
)
```

## Variant 1770: 2 living, 1240 births

Harvest 148724.35546875, depth 0.

```lisp
(seq
  (split)
  (move (temperature))
  (photosynthesize)
  (eat)
)
```

## Variant 10380: 1 living, 0 births

Harvest 574.4375, depth 0.

```lisp
(photosynthesize)
```

## Variant 10389: 1 living, 0 births

Harvest 1353.23828125, depth 0.

```lisp
(seq (eat) (photosynthesize))
```

## Variant 10583: 1 living, 0 births

Harvest 1221.0546875, depth 0.

```lisp
(seq
  (photosynthesize)
  (shield (target-bonds (bond c2)))
  (tag-set
    (target-distance
      (scan (rotation) (linked_storage))
    )
  )
  (mobilize (linked_storage))
)
```

## Variant 8947: 1 living, 0 births

Harvest 1560.43359375, depth 1.

```lisp
(seq
  (unlink (bond c1))
  (seq (color-set (sunlight)) (eat))
  (give (self) (abs (tag)))
  (mobilize (memory m2))
  (if (not true) (photosynthesize) (photosynthesize))
  (move (temperature))
  (attack (none) (sunlight))
)
```

## Variant 4591: 1 living, 0 births

Harvest 2686.98828125, depth 0.

```lisp
(seq
  (move (max (storage) (bonds)))
  (give (bond c2) (target-tag (self)))
  (if false (mobilize (storage-bearing 2)) (nop))
  (if
    false
    (store (sunlight-bearing))
    (photosynthesize)
  )
  (eat)
)
```

## Variant 4618: 1 living, 0 births

Harvest 2907.77734375, depth 0.

```lisp
(seq
  (color-set (target-temperature (bond c1)))
  (move (storage))
  (photosynthesize)
  (eat)
  (unlink (self))
)
```

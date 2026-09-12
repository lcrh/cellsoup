## Variant 9143: 74 living, 95 births

Harvest 18447.0546875, depth 1.

```lisp
(seq (eat) (seq (photosynthesize) (seq (seq (bud) (eat)) (seq (set m7 (target-temperature (nearest-corpse))) (photosynthesize)))))
```

## Variant 10098: 6 living, 48 births

Harvest 26494.14453125, depth 1.

```lisp
(seq (eat) (seq (photosynthesize) (seq (seq (bud) (eat)) (seq (set m0 (target-temperature (self))) (photosynthesize)))))
```

## Variant 2337: 2 living, 1847 births

Harvest 186084.47265625, depth 0.

```lisp
(seq (eat) (seq (turn (storage)) (seq (photosynthesize) (seq (split) (seq (move (- (listen c3) (- (energy) (target-tag (self))))) (turn (storage)))))))
```

## Variant 10255: 1 living, 0 births

Harvest 1442.015625, depth 0.

```lisp
(seq (turn (target-color (bond c1))) (seq (send (none) c3 (target-shield (scan (storage) (target-tag (nearest-cell))))) (seq (give (if (< (age) (energy)) (self) (self)) (energy)) (photosynthesize))))
```

## Variant 10388: 1 living, 0 births

Harvest 1387.0625, depth 0.

```lisp
(seq (link (if (kin (none)) (nearest-cell) (nearest-cell))) (seq (unlink (nearest-cell)) (seq (photosynthesize) (shield (storage-bearing (age))))))
```

## Variant 10167: 1 living, 0 births

Harvest 1397.68359375, depth 0.

```lisp
(seq (attack (nearest-corpse) (target-bearing (bond c1))) (seq (link (nearest-cell)) (seq (tag-set (storage)) (seq (nop) (seq (turn (* (storage-bearing (linked_storage)) (temperature))) (photosynthesize))))))
```

## Variant 10259: 1 living, 0 births

Harvest 786.97265625, depth 0.

```lisp
(seq (photosynthesize) (seq (give (nearest-corpse) (energy)) (give (bond c1) (min (age) (storage-bearing (target-distance (nearest-corpse)))))))
```

## Variant 10380: 1 living, 0 births

Harvest 576.6328125, depth 0.

```lisp
(photosynthesize)
```

# Cell Soup 0.9.3 — logarithmic energy filling

Newcomers at capacity now favor replacing cells with **low usable energy**.
The replacement weight is `1 / max(energy, 1/4096)`. A cell with four times
another cell's energy has one quarter of its replacement weight. Sampling is
without replacement, and high-energy cells remain eligible. Stored reserves do
not affect this weight. Existing genome-allocation safeguards still apply; a
world containing only corpses reclaims them uniformly.

## Filling energy and reserves

Both pools use the integrated logarithmic rule:

```text
credited = K × log(1 + (incoming / K) × exp(-current / K))
new pool = current + credited
```

This integrates `d(pool)/d(incoming) = exp(-pool/K)`. Intake is approximately
linear near empty; its marginal efficiency is about 37% at K, 14% at 2K and 5%
at 3K. A larger K makes diminishing returns gentler. With no spending or other
state changes between inputs, splitting an input into smaller pieces has the
same mathematical result as processing it at once.

**Energy fill scale K** and **Reserves fill scale K** are independent sliders.
Both default to 100; 0 explicitly selects linear filling. Random worlds use
energy scales from 40–140 and reserve scales from 40–240. The existing upper-limit
controls remain available for deliberately capped worlds; random worlds keep
both limits at 3,895, far above their normal operating scales. This bound preserves
exact integer accounting in GPU Float32 storage, including up to 200 additional
units of corpse material or barrier absorption. The implementation therefore has
a finite numerical ceiling even though the mathematical curve does not.

The GPU uses a stable small-input logarithm approximation and preserves fractional
credits separately for each pool. Division shares those fractions; new or reused
cell slots start fresh. The fill curve’s subquantum credits carry between calls instead of being
discarded. Color views use three times the relevant fill scale so generous
upper limits do not hide ordinary energy differences. Inspector tooltips show
marginal fill efficiency.

## Where the curve applies

- Photosynthesis applies conversion and specialization efficiency, then fills
  usable energy through its curve.
- Eating removes the consumed corpse material once, applies conversion and
  specialization efficiency, then fills usable energy. Returns and harvest
  counters report the amount actually gained.
- Storing spends usable energy and fills reserves through the reserve curve.
- Mobilizing consumes reserves, applies conversion and specialization efficiency,
  and fills usable energy through the energy curve.
- Nonlinear gifts debit the donor's full transfer. All incoming gifts are pooled,
  then the recipient's energy curve applies once, after its outgoing donation.
  Unretained energy dissipates. Gifts do not count as harvested energy or change
  specialization. Linear mode retains the previous capacity/refund behavior.
- Linked reserve sharing conserves existing stored value; redistribution itself
  does not apply another fill penalty.

These losses do not create extra heat in this version. Storage/mobilization and
transfer cycles cannot create energy. Direct division and newcomer initialization
retain their explicit energy-allocation rules.

## Validation

Node tests cover the mathematical curve, chunk equivalence, weighted replacement
probabilities, constrained sampling, configuration and shareable world settings.
Native GPU checks cover fractional credits, full donor debits, pooled gifts whose
raw total exceeds a 32-bit sum, corpse consumption, conversion cycles, division,
slot reuse, conservative linked sharing and maximum-balance attack arithmetic.
Unrelated lifecycle fixtures explicitly select linear fill to keep their original
assertions meaningful. This is an incentive change, not evidence that more complex
behavior has already evolved.

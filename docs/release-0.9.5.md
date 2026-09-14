# Cell Soup 0.9.5 — predation and energy histories

Confirmed kills now sit beside landed attacks in the main statistics. Two
history plots show attacks and kills as cumulative totals or rates per
simulated minute. A kill counts one victim whose usable energy was depleted
by attack damage. Concurrent attackers cannot count the same victim twice.
Shield-only hits coinciding with starvation or overheating no longer count as
kills; old-age deaths and scavenging are also excluded.

Stacked energy plots show the sources and destinations of usable energy:

- Intake: photosynthesis, scavenging, mobilized reserves, received gifts, and
  the energy brought in by founders and newcomers.
- Expenditure: movement, shields, attacks, reproduction, storage deposits,
  metabolism, computation, communication and linking, gifts sent, energy lost
  to attacks, and usable energy discarded at population turnover.

The amounts measure actual energy credited or debited, including the effects
of efficiency and logarithmic filling. Mobilization and storage transfer
between pools; gifts transfer between cells. They are shown explicitly rather
than described as new production or destruction. Reproduction counts its
energy cost, not the parent's energy passed to its child. Shield absorption
does not count as a loss of the victim's usable energy. Reserve diffusion and
corpse decay are outside this usable-energy view.

All histories share the recent population-history window (up to 480 samples).
Rates average the actual simulated interval between samples, so playback speed
does not change their units. Totals start at world creation, even when the
displayed window has moved forward. A new world clears the history. Different
plots use separate, labeled vertical scales; legend values give the most
recent interval or current cumulative total.

"""Plot measured ecology and an optional whole-colony observation. Requires matplotlib."""
import json
import math
import sys
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

run_path, output = Path(sys.argv[1]), Path(sys.argv[2])
run = json.loads(run_path.read_text())
rows = run["records"]
minutes = [r["seconds"] / 60 for r in rows]
plt.rcParams.update({"font.size": 10, "axes.spines.top": False, "axes.spines.right": False})
fig, axes = plt.subplots(3, 1, figsize=(9, 7.2), sharex=True, layout="constrained")
axes[0].plot(minutes, [r["living"] for r in rows], color="#176b59", label="Living cells")
axes[0].plot(minutes, [r["bornInWorld"] for r in rows], color="#bd7520", label="Born by division", linestyle="--")
axes[0].set_ylabel("Cells")
axes[0].legend(frameon=False, loc="upper right")
axes[1].plot(minutes, [r["movingBodies"] for r in rows], color="#3268a8")
axes[1].set_ylabel("Moving groups")
axes[2].plot(minutes, [r["meanTemperature"] for r in rows], color="#b34c36")
axes[2].axhline(run["config"]["safeTemperature"], color="#666666", linestyle=":", label="Heat-stress threshold")
axes[2].set_ylabel("Mean temperature")
axes[2].set_xlabel("Simulated minutes")
axes[2].legend(frameon=False)
for ax in axes:
    ax.grid(axis="y", alpha=.18)
    ax.set_xlim(0, minutes[-1])
fig.suptitle(f"Continuous evolution · seed {run['config']['seed']}\nEight arrivals per second; no population-floor replenishment", fontsize=14)
fig.savefig(str(output) + ".png", dpi=170)
fig.savefig(str(output) + ".svg")
plt.close(fig)

if len(sys.argv) > 3:
    observation_path = Path(sys.argv[3])
    observation = json.loads(observation_path.read_text())
    source_metadata = json.loads((observation_path.parent / "progress.json").read_text())
    colony_seed = source_metadata["config"]["seed"]
    bodies = [b for b in observation["colonies"] if b.get("cells")]
    body = max(bodies, key=lambda b: b["size"])
    cells = body["cells"]
    world = observation["world"]
    origin = cells[0]
    delta = lambda x: x - math.floor(x / world + .5) * world
    xy = {c["slot"]: (delta(c["x"] - origin["x"]), delta(c["y"] - origin["y"])) for c in cells}
    fig, ax = plt.subplots(figsize=(8, 7), layout="constrained")
    for c in cells:
        for other in c["links"]:
            if c["slot"] < other:
                a, b = xy[c["slot"]], xy[other]
                ax.plot([a[0], b[0]], [a[1], b[1]], color="#7d9290", linewidth=1.5, zorder=1)
    dots = ax.scatter([xy[c["slot"]][0] for c in cells], [xy[c["slot"]][1] for c in cells],
                      c=[c["energy"] for c in cells], cmap="viridis", s=55, zorder=3, edgecolor="white", linewidth=.5)
    ax.quiver([xy[c["slot"]][0] for c in cells], [xy[c["slot"]][1] for c in cells],
              [c["vx"] for c in cells], [c["vy"] for c in cells], angles="xy", scale_units="xy", scale=5,
              width=.003, color="#303a40", alpha=.65, zorder=2)
    fig.colorbar(dots, ax=ax, label="Usable energy", shrink=.65)
    variants = len({c["genomeSlot"] for c in cells})
    ax.set_title(f"{body['size']}-cell moving colony · seed {colony_seed} · {observation['seconds'] / 60:g} min\n"
                 f"{variants} genome · speed {body['speed']:.1f} units/second", fontsize=13)
    ax.set_aspect("equal")
    ax.set_xlabel("Relative position (world units)")
    ax.set_ylabel("Relative position (world units)")
    ax.text(.02, .02, "Links and cells from a simulation snapshot.\nArrows show velocity, not a claim of coordination.",
            transform=ax.transAxes, fontsize=8, va="bottom")
    colony_output = output.parent / f"colony-{colony_seed}-{observation['seconds']}"
    fig.savefig(str(colony_output) + ".png", dpi=170)
    fig.savefig(str(colony_output) + ".svg")

# Keep generated vector artifacts clean in diffs; newlines retain SVG token separation.
for svg_path in [Path(str(output) + ".svg")] + ([Path(str(colony_output) + ".svg")] if len(sys.argv) > 3 else []):
    svg_path.write_text("\n".join(line.rstrip() for line in svg_path.read_text().splitlines()) + "\n")

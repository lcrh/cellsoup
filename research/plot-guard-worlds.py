"""Plot the six measured trajectories from compare-guard-worlds.mjs."""
import json
import sys
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

source, output = map(Path, sys.argv[1:3])
report = json.loads(source.read_text())
plt.rcParams.update({'font.size': 10, 'axes.spines.top': False, 'axes.spines.right': False})
fig, axes = plt.subplots(2, 3, figsize=(12, 6.5), sharex=True, layout='constrained')
for column, seed in enumerate([42, 97, 321]):
    for sampler, color, label in [('control', '#316f9c', 'Published sampler'), ('guard', '#b85f38', 'Condition insertion')]:
        trial = next(t for t in report['trials'] if t['seed'] == seed and t['sampler'] == sampler)
        x = [r['seconds'] / 60 for r in trial['series']]
        for row, key in enumerate(['movingBodyCells', 'largestMovingBody']):
            axes[row, column].plot(x, [r[key] for r in trial['series']], color=color, label=label, linewidth=1.6)
    axes[0, column].set_title(f'Seed {seed}')
    axes[1, column].set_xlabel('Simulated minutes')
    for ax in axes[:, column]:
        ax.set_xlim(0, 60)
        ax.grid(axis='y', alpha=.2)
        ax.set_ylim(bottom=0)
axes[0, 0].set_ylabel('Cells in moving groups')
axes[1, 0].set_ylabel('Largest moving group (cells)')
axes[0, 0].legend(frameon=False)
fig.suptitle('Can condition-inserting mutations sustain structured populations?\nOne trajectory per seed and sampler; moving means ≥4 linked cells and centroid speed >2', fontsize=13)
fig.savefig(str(output)+'.png', dpi=170)
fig.savefig(str(output)+'.svg')
svg = Path(str(output)+'.svg')
svg.write_text('\n'.join(line.rstrip() for line in svg.read_text().splitlines())+'\n')
plt.close(fig)

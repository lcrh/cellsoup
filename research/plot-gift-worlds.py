"""Plot fresh contact-gift / linked-gift continuous evolution comparisons."""
import json
import sys
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
source, output = map(Path, sys.argv[1:3])
report = json.loads(source.read_text())
plt.rcParams.update({'font.size': 10, 'axes.spines.top': False, 'axes.spines.right': False})
fig, axes = plt.subplots(3, 3, figsize=(12, 8.5), sharex=True, layout='constrained')
for col, seed in enumerate([42, 97, 321]):
    for rule, color, label in [('contact', '#316f9c', 'Contact gifts'), ('linked', '#b85f38', 'Gifts through links')]:
        t = next(t for t in report['trials'] if t['seed'] == seed and t['rule'] == rule)
        x = [r['seconds']/60 for r in t['series']]
        for row, key in enumerate(['living', 'movingBodyCellsWithRecentThrust', 'largestMovingBodyWithRecentThrust']):
            axes[row,col].plot(x,[r[key] for r in t['series']], color=color,label=label,linewidth=1.6)
    axes[0,col].set_title(f'Seed {seed}')
    axes[2,col].set_xlabel('Simulated minutes')
    for ax in axes[:,col]:
        ax.set_xlim(0,60)
        ax.set_ylim(bottom=0)
        ax.grid(axis='y',alpha=.2)
axes[0,0].set_ylabel('Living cells')
axes[1,0].set_ylabel('Cells in moving groups\nwith recent thrust')
axes[2,0].set_ylabel('Largest such group (cells)')
axes[0,0].legend(frameon=False)
fig.suptitle('Does giving through links sustain more colony structure?\nThree trajectories per rule; motion with thrust does not establish coordination', fontsize=13)
fig.savefig(str(output)+'.png',dpi=170)
fig.savefig(str(output)+'.svg')
svg=Path(str(output)+'.svg')
svg.write_text('\n'.join(line.rstrip() for line in svg.read_text().splitlines())+'\n')
plt.close(fig)

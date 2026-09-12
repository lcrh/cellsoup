"""Visualize the measured input pulse and all ecological control assignments."""
import json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

root = Path(__file__).parent / 'results'
pulse = json.loads((root / 'crowding-pulse.json').read_text())
comparison = json.loads((root / 'history-crowding-comparison.json').read_text())
fig, axes = plt.subplots(3, 1, figsize=(10, 9), gridspec_kw={'height_ratios': [1, 1.3, 2]})
rows = pulse['trials'][0]['rows']
axes[0].step([r['tick'] for r in rows], [r['crowding'] for r in rows], where='post', color='#667788')
axes[0].set(ylabel='Crowding input', title='A naturally evolved controller responds to changes in crowding', xlim=(1, 60))
for trial, label, color in zip(pulse['trials'], ['Original', 'No history', 'No extra delay', 'No change detector'], ['#126a83', '#888888', '#d58b23', '#964776']):
    rows = trial['rows']
    axes[1].plot([r['tick'] for r in rows], [r['inferredImpulse'] for r in rows], label=label, color=color, alpha=.85)
axes[1].set(xlabel='Simulation tick (60 ticks = 1 second)', ylabel='Inferred thrust impulse', xlim=(1, 60))
axes[1].legend(ncol=2, fontsize=9, loc='upper right')
labels = ['No history', 'No extra delay', 'No change detector', 'Constant forward', 'Identical control']
for index, treatment in enumerate(['all', 'lag', 'delta', 'forward', 'intact']):
    for t in comparison['trials']:
        if t['treatment'] != treatment:
            continue
        seed_index = [42, 97, 321].index(t['seed'])
        x = index + (seed_index-1)*.16 + (t['changedSlot']-.5)*.05
        axes[2].scatter(x, t['final']['intactShare']*100, color=['#126a83','#d58b23','#964776'][seed_index], marker=['o','x'][t['changedSlot']], s=45)
axes[2].axhline(50, color='#888888', linestyle='--', linewidth=1)
axes[2].set(xticks=range(5), xticklabels=labels, ylabel='Original share after 10 minutes (%)', ylim=(0,100), title='Useful history does not guarantee an advantage over simpler movement')
axes[2].tick_params(axis='x', labelsize=9)
for ax in axes:
    ax.spines[['top','right']].set_visible(False)
    ax.grid(axis='y', alpha=.15)
fig.text(.1, .015, 'Colors: three environmental seeds. Circle/cross: swapped cohort assignments.\nSelected-program competitions; authored interventions were never introduced into evolutionary worlds.', fontsize=9, color='#555555')
fig.tight_layout(rect=(0,.06,1,1), h_pad=2)
fig.savefig(root / 'crowding-history.png', dpi=170)

"""Plot the saved, paired sensory assay; no simulation or model fitting."""
import json
import sys
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

source, output = map(Path, sys.argv[1:])
report = json.loads(source.read_text())
labels = {
    'control-gradient-turn': 'Authored gradient steering',
    'control-straight': 'Authored straight swimmer',
    'control-idle-photo': 'Authored stationary cell',
    'evolved-97-31236': 'Evolved 97 / 31236 · 3 cells',
    'evolved-42-32994': 'Evolved 42 / 32994 · 2 cells',
    'evolved-97-14980': 'Evolved 97 / 14980 · 2,171 cells',
    'evolved-97-31278': 'Evolved 97 / 31278 · 64 cells',
}
plt.rcParams.update({'font.size': 10, 'axes.spines.top': False, 'axes.spines.right': False})
fig, axes = plt.subplots(1, 2, figsize=(11.2, 5.3), gridspec_kw={'width_ratios': [1.2, 1]})
programs = report['programs']
y = np.arange(len(programs))
a = axes[0]
a.barh(y-.16, [p['summary']['intactMeanSunlight'] for p in programs], height=.28, color='#1f8e81', label='Sensor intact')
a.barh(y+.16, [p['summary']['blindMeanSunlight'] for p in programs], height=.28, color='#9ba6b3', label='Directional sensor zeroed')
a.set(yticks=y, yticklabels=[labels[p['id']] for p in programs], xlim=(0, 1), xlabel='Mean sunlight encountered (0–1)', title='Does sensing help the cell reach light?')
a.invert_yaxis()
a.legend(loc='lower right', fontsize=8)
a.grid(axis='x', alpha=.15)
a.set_axisbelow(True)
b = axes[1]
best = next(p for p in programs if p['id']=='evolved-97-31236')
for mode, color, label in [('intact','#1f8e81','Sensor intact'), ('blind','#9ba6b3','Directional sensor zeroed')]:
    traces = np.array([[r['upGradient'] for r in t[mode]['trajectory']] for t in best['trials']])
    seconds = np.array([r['tick']/60 for r in best['trials'][0][mode]['trajectory']])
    b.fill_between(seconds, traces.min(axis=0), traces.max(axis=0), alpha=.15, color=color)
    b.plot(seconds, traces.mean(axis=0), color=color, label=label)
b.axhline(512, color='#b5a270', ls=':', lw=1)
b.text(.5, 531, 'Brightest band', color='#756a4c', fontsize=9)
b.set(xlabel='Simulated seconds', ylabel='Displacement toward brighter band', title='Evolved 31236: mean and full range')
b.grid(alpha=.15)
fig.suptitle('Useful perception can have an unchanged execution trace', fontsize=15, x=.5, y=.98)
fig.text(.02, .025, '16 balanced heading / light-direction pairs per program; 15 seconds, no reproduction. All paired 4.27-second instruction traces were identical.\nSource-world cell counts describe rarity, not replicate counts. Single-cell assays do not test linked behavior.', fontsize=9, color='#535d68')
fig.tight_layout(rect=(0,.12,1,.93))
fig.savefig(output, dpi=170, facecolor='white')
fig.savefig(output.with_suffix('.svg'), facecolor='white')

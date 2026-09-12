"""Plot the exact initial geometry of the three observed-fragment assays."""
import json, math, sys
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.lines import Line2D
source, output = map(Path, sys.argv[1:3])
r = json.loads(source.read_text())
fig, axes = plt.subplots(1, 3, figsize=(11, 4.8), layout='constrained')
for ax, seed in zip(axes, [42, 97, 321]):
    t = next(t for t in r['trials'] if t['seed']==seed and t['light']=='dim' and t['genotype']=='giving' and t['mode']=='connected')
    cells=t['fragment']['cells']
    positions=[(c['x']-1024,c['y']-1024) for c in cells]
    for i,c in enumerate(cells):
        for h in c['links']:
            if h and i<h-1:
                a,b=positions[i],positions[h-1]
                ax.plot([a[0],b[0]],[a[1],b[1]],color='#b7c3c3',lw=2,zorder=1)
        if c['links'][2]:
            a,b=positions[i],positions[c['links'][2]-1]
            distance=math.dist(a,b)
            color='#218454' if distance<=18 else '#bd523e'
            ax.annotate('',xy=b,xytext=a,arrowprops={'arrowstyle':'->','color':color,'lw':1.8,'shrinkA':7,'shrinkB':7},zorder=3)
    ax.scatter(*zip(*positions),s=100,color='#275870',edgecolor='white',zorder=4)
    for i,(x,y) in enumerate(positions):ax.annotate(str(i+1),(x,y),ha='center',va='center',fontsize=8,color='white',zorder=5)
    ax.set_aspect('equal',adjustable='datalim')
    ax.set_title(f'Source seed {seed}')
    ax.set_xlabel('Relative position')
    ax.spines[['top','right']].set_visible(False)
    ax.margins(.2)
axes[0].set_ylabel('Relative position')
fig.suptitle('Eight-cell fragments retain their grown link geometry\nArrows identify the program’s c2 gift targets, not completed transfers',fontsize=13)
fig.legend(handles=[Line2D([0],[0],color='#b7c3c3',lw=2,label='Retained link'),Line2D([0],[0],color='#218454',lw=2,label='Gift target within 18 units'),Line2D([0],[0],color='#bd523e',lw=2,label='Gift target outside 18 units')],loc='outside lower center',ncol=3,frameon=False)
fig.savefig(str(output)+'.png',dpi=170)
fig.savefig(str(output)+'.svg')
p=Path(str(output)+'.svg');p.write_text('\n'.join(line.rstrip() for line in p.read_text().splitlines())+'\n')
plt.close(fig)

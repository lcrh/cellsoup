"""Plot the competition assay, including both monoculture controls."""
import json
import sys
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
source, output = map(Path,sys.argv[1:3])
report=json.loads(source.read_text())
assert report['complete'] and len(report['trials'])==9
plt.rcParams.update({'font.size':10,'axes.spines.top':False,'axes.spines.right':False})
fig,axes=plt.subplots(1,3,figsize=(12,4.5),sharey=True,layout='constrained')
for ax,seed in zip(axes,[42,97,321]):
    for condition in ['colonial','solitary','mixed']:
        t=next(t for t in report['trials'] if t['seed']==seed and t['condition']==condition)
        assert t['complete'] and t['records'][-1]['seconds']==600
        for g,color,label in [(0,'#257c70','Colonial'),(1,'#b75f43','Solitary')]:
            if (condition=='colonial' and g==1) or (condition=='solitary' and g==0):continue
            ax.plot([r['seconds']/60 for r in t['records']],[r['populations'][g] for r in t['records']],color=color,linestyle='-' if condition=='mixed' else ':',linewidth=1.8,label=label+(' in mixture' if condition=='mixed' else ' alone'))
    ax.set_title(f'Seed {seed}')
    ax.set_xlabel('Simulated minutes')
    ax.set_xlim(0,10)
    ax.set_ylim(0,4096)
    ax.grid(axis='y',alpha=.2)
axes[0].set_ylabel('Living cells of each genotype')
handles,labels=axes[0].get_legend_handles_labels()
fig.legend(handles,labels,loc='outside lower center',ncol=4,frameon=False)
fig.suptitle('Can the observed colonial lineage compete with a solitary lineage?\n64 fresh founders total; mixtures start with 32 of each; no mutations or arrivals',fontsize=13)
fig.savefig(str(output)+'.png',dpi=170)
fig.savefig(str(output)+'.svg')
p=Path(str(output)+'.svg');p.write_text('\n'.join(s.rstrip() for s in p.read_text().splitlines())+'\n')
plt.close(fig)

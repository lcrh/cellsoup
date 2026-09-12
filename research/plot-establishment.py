"""Render completed clonal establishment and cadence experiments."""
import json
import sys
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
source, output = map(Path, sys.argv[1:])
r = json.loads(source.read_text())
plt.rcParams.update({'font.size': 10, 'axes.spines.top': False, 'axes.spines.right': False})
fig, axes = plt.subplots(1, 3, figsize=(13.8, 4.9))
colors = ['#b56354', '#288794']
for ax, program, treatments, labels, title in [
    (axes[0], 'evolved-97-31236', ['zero','no-heat-damage'], ['Normal heat damage','Heat damage disabled'], '31236: light seeking creates a heat trap'),
    (axes[1], 'evolved-97-14980', ['zero','forward'], ['Compared with zero thrust','Compared with forward thrust'], '14980: sensing is useful in this ecology')]:
    for treatment, label, color in zip(treatments, labels, colors):
        ts = [t for t in r['trials'] if t['program']==program and t['treatment']==treatment]
        values = np.array([[row['intactShare'] for row in t['rows']] for t in ts], dtype=float)
        time = np.array([row['seconds']/60 for row in ts[0]['rows']])
        ax.fill_between(time, np.nanmin(values,axis=0),np.nanmax(values,axis=0),color=color,alpha=.13)
        ax.plot(time,np.nanmean(values,axis=0),color=color,label=label,lw=2)
    ax.axhline(.5,color='#959595',ls=':',lw=1)
    ax.set(xlabel='Simulated minutes',ylabel='Intact share of living cells',ylim=(0,1),title=title)
    ax.legend(fontsize=8,loc='lower left' if ax==axes[1] else 'center left')
    ax.grid(alpha=.12)
a=axes[2]
for treatment,label,color in zip(['zero','no-implicit-wait'],['Original compiler','Hidden pause removed'],colors):
    ts=[t for t in r['trials'] if t['program']=='control-straight-division' and t['treatment']==treatment]
    values=np.array([[row['intact']['births']+row['changed']['births'] for row in t['rows']] for t in ts])
    time=np.array([row['seconds']/60 for row in ts[0]['rows']])
    a.fill_between(time,values.min(axis=0),values.max(axis=0),color=color,alpha=.13)
    a.plot(time,values.mean(axis=0),color=color,label=label,lw=2)
a.set(xlabel='Simulated minutes',ylabel='Cumulative births',title='An accidental barrier to simple reproduction')
a.grid(alpha=.12);a.legend(fontsize=8,loc='upper left')
fig.suptitle('Useful complexity cannot be judged by light exposure alone',fontsize=15,y=.98)
fig.text(.015,.02,'Lines: mean across three seeds × two assignment swaps. Shading: full range, not confidence intervals. 64 founders; no arrivals or mutation.\nThese are clonal replays of selected programs. Compiler and heat interventions remain experimental; no general complexity claim follows.',fontsize=9,color='#555')
fig.tight_layout(rect=(0,.13,1,.93))
fig.savefig(output,dpi=160,facecolor='white')

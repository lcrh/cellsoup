// Compare only completed, matched ecological assays; source programs are retained.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
const [originalPath, alivePath, kinPath, output] = process.argv.slice(2);
if (!output) throw Error('Usage: node research/compare-gift-guards.mjs original.json alive.json kin.json output.json');
const reports = await Promise.all([originalPath, alivePath, kinPath].map(async path => JSON.parse(await readFile(path, 'utf8'))));
for (const report of reports) assert.equal(report.complete, true);
const [, alive, kin] = reports;
assert.equal(alive.guard, 'alive');
assert.equal(kin.guard, 'kin');
assert.deepEqual(alive.guardComparison, kin.guardComparison);
assert.equal(alive.guardComparison.instructions, 20);
assert.equal(alive.guardComparison.originalInstructions, 23);
assert.deepEqual(alive.programTrees[1], kin.programTrees[1]);
const result = {
  scope: 'Three mixed-culture trajectories per variant. Alive and kin guards differ in exactly one sensed bytecode field at equal instruction length; original is an observed 23-instruction program, both authored controls are 20 instructions. Compare alive versus kin to isolate the guard, not original versus kin. Exact genome identity is used for kinship. Same seed and founder placement do not make GPU trajectories deterministic. Late means use six snapshots from minute 5 through 10. Population, movement and program syntax are not epiplexity or evidence of coordinated behavior. No authored program is injected into autonomous evolution.',
  sources: { original: originalPath, alive: alivePath, kin: kinPath },
  controls: alive.guardComparison,
  trials: []
};
for (const seed of [42, 97, 321]) {
  let reference;
  for (let index = 0; index < reports.length; index++) {
    const report = reports[index];
    assert.deepEqual(report.sourceGenomes, reports[0].sourceGenomes);
    const trial = report.trials.find(t => t.seed === seed && t.condition === 'mixed');
    assert.ok(trial?.complete);
    assert.deepEqual(trial.records.map(r => r.seconds), Array.from({length:11}, (_,i) => i*60));
    if (reference) {
      assert.deepEqual(trial.config, reference.config);
      assert.deepEqual(trial.founders, reference.founders);
      assert.equal(trial.kernel, reference.kernel);
    } else reference = trial;
    const series = trial.records.map(r => {
      assert.equal(r.living, r.populations[0]+r.populations[1]);
      assert.equal(r.living, 64+r.births-r.deaths);
      assert.equal(r.recentThrustWindowTicks, 60);
      return { seconds:r.seconds, colonial:r.populations[0], solitary:r.populations[1], colonialShare:r.living ? r.populations[0]/r.living : 0, movingThrustCells:r.movingBodyCellsWithRecentThrust, largestMovingThrustBody:r.largestMovingBodyWithRecentThrust };
    });
    const late = series.filter(r => r.seconds >= 300);
    const keys = ['colonial','solitary','colonialShare','movingThrustCells','largestMovingThrustBody'];
    result.trials.push({seed, guard:['original','alive','kin'][index], kernel:trial.kernel, final:series.at(-1), lateMean:Object.fromEntries(keys.map(key=>[key,late.reduce((sum,r)=>sum+r[key],0)/late.length])), series});
  }
}
await writeFile(output, JSON.stringify(result,null,2)+'\n');
for(const t of result.trials) console.log(JSON.stringify({seed:t.seed,guard:t.guard,final:t.final,lateMean:t.lateMean}));

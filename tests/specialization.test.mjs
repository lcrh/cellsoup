import test from 'node:test';
import assert from 'node:assert/strict';
import {specializationSummary} from '../web/gpu/specialization.js';
test('single-pathway intake is efficient; mixed intake has normalized entropy',()=>{
 for(const h of [[100,0,0],[0,100,0],[0,0,100]])assert.equal(specializationSummary(h,.8).efficiency,1);
 const mixed=specializationSummary([10,10,10],.8);
 assert.equal(mixed.entropy,1);assert.ok(Math.abs(mixed.efficiency-.2)<1e-12);
 assert.deepEqual(specializationSummary([0,0,0],.8),mixed);
 assert.deepEqual(specializationSummary([1,2,3],.5),specializationSummary([10,20,30],.5));
 assert.equal(specializationSummary([1,2,3],0).efficiency,1);
});

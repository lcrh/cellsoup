import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseTree,compileTree,packTree,unpackTree,printTree,formatTree,randomTree,mutateTree,treeRng} from '../web/gpu/trees.js';
const hasTemporal=t=>['lag','delta','smooth'].includes(t.op)||t.args.some(hasTemporal);
test('temporal expressions remain typed, serializable and private from explicit memory',()=>{
 for(const source of ['(move (lag (sunlight)))','(move (delta (lag (sunlight))))','(move (smooth 0.25 (temperature)))','(seq (set m0 7) (move (lag (memory m0))))']){
  const t=parseTree(source),before=JSON.stringify(t),code=compileTree(t),packed=packTree(t);
  assert.equal(JSON.stringify(t),before);assert.deepEqual(unpackTree(packed.data,packed.count),t);assert.equal(printTree(parseTree(formatTree(t))),printTree(t));
  const slots=code.statefulSlots.map(s=>s.slot);assert.equal(new Set(slots).size,slots.length);assert.ok(slots.every(s=>s>=0&&s<8));
 }
 assert.deepEqual(compileTree('(seq (set m0 7) (move (lag (memory m0))))').statefulSlots.map(s=>s.slot),[1]);
 assert.throws(()=>parseTree('(move (lag true))'),/Type mismatch/);
 assert.throws(()=>parseTree('(move (smooth (self) 1))'),/Type mismatch/);
});
test('every syntactic occurrence has its own history even with a shared AST object',()=>{
 const shared=parseTree('(move (lag (tag)))').args[0];
 const t={op:'seq',args:[{op:'move',args:[shared]},{op:'turn',args:[shared]}]};
 const code=compileTree(t);assert.equal(t.args[0].args[0],t.args[1].args[0]);
 assert.equal(code.statefulSlots.length,2);assert.notEqual(code.statefulSlots[0].slot,code.statefulSlots[1].slot);
});
test('temporal storage obeys the shared eight-slot bound',()=>{
 const nest=(count,input)=>Array.from({length:count}).reduce(s=>`(lag ${s})`,input);
 assert.equal(compileTree(`(move ${nest(8,'1')})`).statefulSlots.length,8);
 assert.throws(()=>compileTree(`(move ${nest(9,'1')})`),/memory limit/);
 assert.throws(()=>compileTree(`(move ${nest(8,'(memory m0)')})`),/memory limit/);
});
test('1000 random founders retain baseline trees, bytecode and packed node IDs',()=>{
 const rng=treeRng(904),treeHash=createHash('sha256'),codeHash=createHash('sha256'),packedHash=createHash('sha256');
 for(let i=0;i<1000;i++){
  const tree=randomTree(rng);assert.equal(hasTemporal(tree),false);
  treeHash.update(JSON.stringify(tree)+'\n');codeHash.update(compileTree(tree).source+'\n');packedHash.update(new Uint8Array(packTree(tree).data.buffer));
 }
 assert.equal(treeHash.digest('hex'),'31ba18bc2f759a386134e76d3f98558386e5fd333189707bfbe07dac31e9d3b0');
 assert.equal(codeHash.digest('hex'),'b969f48e3c6dd873b1afbcc9c346d72cf213c955ce7a7c05d66be5e5bc1d8f5c');
 assert.equal(packedHash.digest('hex'),'9f7d5b2db88266de18dcce9ba33f5ac6c8093b4ee811d17406169f764ced3a3f');
});
test('ordinary mutation can introduce each temporal expression without editing its parent',()=>{
 const tree=parseTree('(seq (photosynthesize) (move (storage)) (split) (photosynthesize))'),before=JSON.stringify(tree),rng=treeRng(831);
 const found=new Set();
 function visit(t){if(['lag','delta','smooth'].includes(t.op))found.add(t.op);t.args.forEach(visit);}
 for(let i=0;i<2000;i++){const mutant=mutateTree(tree,rng,{temporalWeight:1});compileTree(mutant);visit(mutant);}
 assert.equal(JSON.stringify(tree),before);assert.deepEqual([...found].sort(),['delta','lag','smooth']);
});

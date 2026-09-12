import test from "node:test";
import assert from "node:assert/strict";
import {
  parseTree,
  printTree,
  formatTree,
  checkTree,
  compileTree,
  packTree,
  unpackTree,
  randomTree,
  mutateTree,
  crossoverTrees,
  sampleTreeArrival,
  treeRng,
} from "../web/gpu/trees.js";

test("typed programs reject invalid connections and compile persistent ReLU memory", () => {
  assert.throws(() => parseTree("(move true)"), /Type mismatch/);
  assert.throws(() => parseTree("(attack 3 1)"), /Type mismatch/);
  assert.throws(() => parseTree("(set c0 1)"), /Type mismatch/);
  const code = compileTree("(set m0 (max 0 (+ (* (memory m1) 2) -3)))");
  assert.match(code.source, /mem_load r[0-7] 1/);
  assert.match(code.source, /mem_save 0 r0/);
  assert.match(compileTree("(set m0 (receive c2))").source, /receive r0 r1 2/);
});

test("random trees, mutations and same-type crossovers remain bounded and serializable", () => {
  const rng = treeRng(617);
  let previous = randomTree(rng),
    crossed = 0;
  for (let i = 0; i < 1000; i++) {
    const tree = randomTree(rng),
      original = printTree(tree),
      parent = printTree(previous);
    const mutated = mutateTree(tree, rng);
    assert.notEqual(printTree(mutated), original);
    const child = crossoverTrees(tree, previous, rng);
    assert.equal(printTree(tree), original);
    assert.equal(printTree(previous), parent);
    if (child.crossed) {
      crossed++;
      assert.notEqual(printTree(child.tree), original);
      assert.notEqual(printTree(child.tree), parent);
      assert.ok(child.recipientPath.length > 0);
    }
    for (const candidate of [tree, mutated, child.tree]) {
      assert.ok(checkTree(candidate).count <= 32);
      assert.ok(compileTree(candidate).length <= 64);
      assert.equal(
        printTree(parseTree(formatTree(candidate))),
        printTree(candidate),
      );
      const packed = packTree(candidate);
      assert.equal(
        printTree(unpackTree(packed.data, packed.count)),
        printTree(candidate),
      );
    }
    previous = tree;
  }
  assert.ok(crossed > 100);
});

test("crossover failure is explicit for indivisible or identical parents", () => {
  const a = parseTree("(photosynthesize)"),
    b = parseTree("(eat)");
  const result = crossoverTrees(a, b, treeRng(2));
  assert.equal(result.crossed, false);
  assert.deepEqual(result.tree, a);
  assert.notEqual(result.tree, a);
  assert.equal(crossoverTrees(a, a).crossed, false);
});

test("arrival crossover and subsequent mutation have independent controls and parent provenance", () => {
  const archive = [
    { id: 17, tree: parseTree("(seq (move 1) (photosynthesize))") },
    { id: 38, tree: parseTree("(seq (turn 90) (eat))") },
  ];
  const before = JSON.stringify(archive);
  const copy = sampleTreeArrival(archive, {
    rng: treeRng(9),
    archiveShare: 1,
    crossoverRate: 0,
    mutationRate: 0,
  });
  assert.equal(copy.source, "archive");
  assert.equal(copy.mutated, false);
  assert.equal(copy.crossed, false);
  assert.deepEqual(
    copy.tree,
    archive.find((p) => p.id === copy.parents[0]).tree,
  );
  const cross = sampleTreeArrival(archive, {
    rng: treeRng(9),
    archiveShare: 1,
    crossoverRate: 1,
    mutationRate: 0,
  });
  assert.equal(cross.crossed, true);
  assert.equal(cross.parents.length, 2);
  assert.equal(cross.mutated, false);
  const mutant = sampleTreeArrival(archive, {
    rng: treeRng(9),
    archiveShare: 1,
    crossoverRate: 1,
    mutationRate: 1,
  });
  assert.equal(mutant.crossed, true);
  assert.equal(mutant.mutated, true);
  assert.notDeepEqual(mutant.tree, cross.tree);
  assert.equal(
    sampleTreeArrival(archive, { archiveShare: 0 }).source,
    "random",
  );
  assert.equal(sampleTreeArrival([], { archiveShare: 1 }).source, "random");
  assert.equal(JSON.stringify(archive), before);
  assert.throws(
    () => sampleTreeArrival(archive, { crossoverRate: 1.1 }),
    /probability/,
  );
});

test("named state and let are numeric, scoped and bounded", () => {
  const tree = parseTree(
    "(state ((sum 0)) (let ((sample (sunlight))) (set! sum (+ sum sample))))",
  );
  assert.match(compileTree(tree).source, /mem_ready/);
  assert.match(formatTree(tree), /set! state0/);
  assert.equal(printTree(parseTree(formatTree(tree))), printTree(tree));
  assert.throws(() => parseTree("(set! missing 1)"), /bound variable/);
  assert.throws(
    () => parseTree("(state ((x 0) (x 1)) (move x))"),
    /Duplicate binding/,
  );
  assert.throws(() => parseTree("(let ((x true)) (move 1))"), /Type mismatch/);
  assert.throws(
    () => parseTree("(seq (let ((x 1)) (move x)) (move x))"),
    /Unbound variable/,
  );
  assert.throws(
    () =>
      parseTree(
        "(state ((a 0)(b 0)(c 0)(d 0)(e 0)(f 0)(g 0)(h 0)(i 0)) (move a))",
      ),
    /eight/,
  );
});

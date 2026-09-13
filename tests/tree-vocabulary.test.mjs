import test from "node:test";
import assert from "node:assert/strict";
import {
  TREE_SCHEMA,
  TREE_VM_OPS,
  TREE_SURFACE_FORMS,
  TREE_EVOLUTION_DEFAULTS,
  treeEvolutionOptions,
  insertTreeMutation,
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
  treeRng,
  functionEnabled,
} from "../web/gpu/trees.js";

function roundTrip(tree) {
  const compiled = compileTree(tree);
  assert.ok(compiled.length <= 64);
  assert.ok(checkTree(tree).count <= 32);
  assert.deepEqual(parseTree(formatTree(tree)), tree);
  const packed = packTree(tree);
  assert.deepEqual(unpackTree(packed.data, packed.count), tree);
}

test("composable selections and relative vector projections lower to typed queries", () => {
  const pairs = [
    [
      "(turn (orientation (nearest corpse)))",
      "(turn (target-bearing (nearest-corpse)))",
    ],
    [
      "(turn (orientation (nearest corpse 60)))",
      "(turn (target-bearing (nearby 60 (where (not (alive (candidate)))))))",
    ],
    [
      "(set m0 (storage (nearest living 80)))",
      "(set m0 (target-storage (nearby 80 (where (alive (candidate))))))",
    ],
    [
      "(turn (orientation (centroid living 80)))",
      "(turn (centroid-bearing 80 (where (alive (candidate)))))",
    ],
    [
      "(move (distance (centroid any 90)))",
      "(move (centroid-distance 90 (where true)))",
    ],
    [
      "(turn (orientation (separation living 40)))",
      "(turn (separation-bearing 40 (where (alive (candidate)))))",
    ],
    [
      "(move (strength (separation any 40)))",
      "(move (separation-strength 40 (where true)))",
    ],
    [
      "(turn (alignment living 80))",
      "(turn (alignment 80 (where (alive (candidate)))))",
    ],
    [
      "(move (count corpse 80))",
      "(move (neighbor-count 80 (where (not (alive (candidate))))))",
    ],
  ];
  for (const [surface, canonical] of pairs) {
    assert.deepEqual(parseTree(surface), parseTree(canonical));
    roundTrip(parseTree(surface));
  }
  for (const form of TREE_SURFACE_FORMS) {
    roundTrip(parseTree(form.example));
    for (const name of form.canonicalNames)
      assert.ok(
        TREE_SCHEMA.some((x) => x.name === name),
        name,
      );
  }
  assert.match(
    compileTree(
      "(link (nearest (and living (where (> (storage candidate) 4))) 80))",
    ).source,
    /filter_return/,
  );
  assert.match(
    compileTree(
      "(attack (nearest other 60 (where (< (energy candidate) 20))) 1)",
    ).source,
    /neighborhood r0 0/,
  );
});

test("selection filters apply consistently to link targets, channels and mailbox access", () => {
  const sources = [
    "(send-linked c2 (storage) kin)",
    "(move (linked-mean c0 (and living (where (> (energy candidate) 20)))))",
    "(move (linked-sum c3 corpse))",
    "(move (listen c1 80 living))",
    "(set m0 (receive c1 other))",
    "(link (nearest living 70))",
    "(seq (broadcast c2 1) (move (linked-mean c2)))",
  ];
  for (const source of sources) roundTrip(parseTree(source));
  assert.match(compileTree(sources[0]).source, /filtered_send 2 r0/);
  assert.match(compileTree(sources[1]).source, /neighborhood r0 10/);
  assert.match(compileTree(sources[2]).source, /neighborhood r0 17/);
  assert.match(compileTree(sources[3]).source, /neighborhood r0 19/);
  assert.match(compileTree(sources[4]).source, /filtered_receive r0 1/);
});

test("filters reject effects, nesting, computed filter selectors and out-of-scope candidates", () => {
  for (const expression of [
    "(> (random 1) 0)",
    "(> (lag 1) 0)",
    "(> (receive c0) 0)",
    "(> (do (eat) 1) 0)",
    "(alive (nearby 30 (where true)))",
  ])
    assert.throws(
      () => compileTree(`(move (neighbor-count 80 (where ${expression})))`),
      /Filters require pure expressions/,
    );
  assert.throws(
    () =>
      compileTree(
        "(move (neighbor-count 80 (if true (where true) (where false))))",
      ),
    /Index selectors/,
  );
  assert.throws(
    () => compileTree("(attack (candidate) 1)"),
    /Filter candidate/,
  );
  assert.throws(
    () => compileTree("(link (nearest unknown))"),
    /unknown operation/,
  );
  roundTrip(
    parseTree(
      "(move (neighbor-count 80 (where (> (relu (- (target-energy (candidate)) (energy))) 0))))",
    ),
  );
});

test("query predicates use a separate register frame and resume with the original result slot", () => {
  const source = compileTree(
    "(move (+ 7 (neighbor-count 80 (where (> (target-energy (candidate)) 2)))))",
  ).source;
  assert.match(
    source,
    /mov r0 7\nmov r1 80\nneighborhood r1 3 T\d+\njmp T\d+\nT\d+:\ncandidate r0/,
  );
  assert.match(source, /filter_return r0\nT\d+:\nadd r0 r1\nmove r0/);
  roundTrip(parseTree("(send (nearest living) c0 (+ 7 (count any 80)))"));
});

test("development, activation, oscillation, colony and zero gates compose and serialize", () => {
  for (const source of [
    "(seq (child-set m0 (* (memory m0) 0.8)) (child-turn 25) (bud))",
    "(move (relu (- (energy) 20)))",
    "(move (swish (- (storage) 2)))",
    "(turn (* 25 (sin (+ (* (time) 2) (memory m0)))))",
    "(move (cos (time)))",
    "(seq (resist 0.8) (contract 0.3))",
    "(if (> (colony-size) 4) (split) (photosynthesize))",
    "(if (= (energy) 0) (nop) (if (< (storage) 1) (eat) (mobilize 0.2)))",
  ])
    roundTrip(parseTree(source));
  assert.equal(TREE_VM_OPS[60][0], "sin");
  assert.equal(TREE_VM_OPS[61][0], "cos");
  assert.equal(TREE_VM_OPS[62][0], "resist");
  assert.match(compileTree("(resist 0.8)").source, /resist r0/);
});

function visit(tree, fn) {
  fn(tree);
  for (const child of tree.args) visit(child, fn);
}
test("all-feature random founders, every mutation operator and crossover preserve pure filter scope", () => {
  const rng = treeRng(181),
    options = {
      ...TREE_EVOLUTION_DEFAULTS,
      ...Object.fromEntries(
        Object.keys(TREE_EVOLUTION_DEFAULTS)
          .filter(
            (k) =>
              !k.startsWith("functionMask") &&
              ![
                "generationDepth",
                "founderActions",
                "literalScale",
                "numericMutationScale",
              ].includes(k),
          )
          .map((k) => [k, 1]),
      ),
    };
  let tree = parseTree(
    "(move (neighbor-count 80 (where (> (target-energy (candidate)) 2))))",
  );
  let filters = 0,
    candidates = 0;
  for (let i = 0; i < 1500; i++) {
    const donor = randomTree(rng, 32, options);
    const operator = [
      "mutationOrdinary",
      "mutationLocal",
      "mutationPoint",
      "mutationGuard",
      "mutationInsertion",
    ][i % 5];
    const mutationOptions = {
      ...options,
      mutationOrdinary: 0,
      mutationLocal: 0,
      mutationPoint: 0,
      mutationGuard: 0,
      mutationInsertion: 0,
      [operator]: 1,
    };
    tree = mutateTree(tree, rng, mutationOptions);
    roundTrip(tree);
    roundTrip(donor);
    roundTrip(crossoverTrees(tree, donor, rng).tree);
    visit(tree, (t) => {
      if (t.op === "where") filters++;
      if (t.op === "candidate") candidates++;
    });
    if (i % 10 === 0) tree = donor;
  }
  assert.ok(filters > 10);
  assert.ok(candidates > 10);
});

test("random function masks never generate disabled functions or uninhabitable filters", () => {
  const rng = treeRng(9271);
  for (let i = 0; i < 200; i++) {
    const options = Object.fromEntries(
      Object.keys(TREE_EVOLUTION_DEFAULTS).map((key) => [
        key,
        key.startsWith("functionMask")
          ? Math.floor(rng() * 4294967296)
          : [
                "generationDepth",
                "founderActions",
                "literalScale",
                "numericMutationScale",
              ].includes(key)
            ? TREE_EVOLUTION_DEFAULTS[key]
            : rng(),
      ]),
    );
    let tree = randomTree(rng, 32, options);
    for (let j = 0; j < 10; j++) {
      visit(tree, (t) => assert.ok(functionEnabled(t.op, options), t.op));
      roundTrip(tree);
      tree = mutateTree(tree, rng, options);
    }
  }
  const disabled = {
    functionMask0: 0,
    functionMask1: 0,
    functionMask2: 0,
    functionMask3: 0,
  };
  for (let i = 0; i < 20; i++) {
    const tree = randomTree(rng, 32, disabled);
    visit(tree, (t) => assert.ok(["nop", "seq"].includes(t.op)));
    roundTrip(tree);
  }
});

test("sampler controls bound initial structure and scale literals without changing the random stream", () => {
  for (const [key, values] of Object.entries({
    generationDepth: [0, 9, 1.5],
    founderActions: [0, 7, 1.5],
    literalScale: [0, 4.1],
    numericMutationScale: [-0.1, 2.1],
  }))
    for (const value of values)
      assert.throws(
        () => treeEvolutionOptions({ [key]: value }),
        new RegExp(key),
      );
  const shallow = treeRng(77);
  for (let i = 0; i < 50; i++)
    assert.equal(
      checkTree(
        randomTree(shallow, 32, { generationDepth: 1, founderActions: 1 }),
      ).count,
      1,
    );
  const base = treeRng(87),
    scaled = treeRng(87);
  for (let i = 0; i < 100; i++) {
    const original = randomTree(base),
      changed = randomTree(scaled, 32, { literalScale: 2 });
    const expected = structuredClone(original);
    visit(expected, (t) => {
      if (t.op === "number") t.value = Math.fround(t.value * 2);
    });
    assert.deepEqual(changed, expected);
    roundTrip(changed);
  }
  assert.equal(base(), scaled());
  const mutant = (scale) => {
    const samples = [0.75, 0.1, 0.75];
    return mutateTree(parseTree("(move 10)"), () => samples.shift(), {
      numericMutationScale: scale,
    });
  };
  assert.equal(mutant(1).args[0].value, 10.625);
  assert.equal(mutant(2).args[0].value, 11.25);
  const rng = treeRng(912);
  for (let i = 0; i < 100; i++) {
    const options = {
      generationDepth: 8,
      founderActions: 6,
      literalScale: 4,
      numericMutationScale: 2,
      neighborhoodWeight: 1,
      activationWeight: 1,
      developmentWeight: 1,
    };
    const tree = randomTree(rng, 32, options);
    roundTrip(tree);
    roundTrip(mutateTree(tree, rng, options));
    roundTrip(insertTreeMutation(tree, rng, { generationDepth: 1 }).tree);
  }
});

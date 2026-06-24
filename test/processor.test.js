"use strict";

const assert = require("assert");
const { processData } = require("../src/processor");

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`  FAIL  ${name}`);
    console.error(`        ${err.message}`);
    process.exitCode = 1;
  }
}

test("spec example: full end-to-end match", () => {
  const result = processData([
    "A->B", "A->C", "B->D", "C->E", "E->F",
    "X->Y", "Y->Z", "Z->X",
    "P->Q", "Q->R",
    "G->H", "G->H", "G->I",
    "hello", "1->2", "A->",
  ]);

  assert.deepStrictEqual(result.invalid_entries, ["hello", "1->2", "A->"]);
  assert.deepStrictEqual(result.duplicate_edges, ["G->H"]);
  assert.deepStrictEqual(result.summary, {
    total_trees: 3,
    total_cycles: 1,
    largest_tree_root: "A",
  });
  assert.deepStrictEqual(result.hierarchies.map((h) => h.root), ["A", "X", "P", "G"]);
  assert.deepStrictEqual(result.hierarchies[0].tree, {
    A: { B: { D: {} }, C: { E: { F: {} } } },
  });
  assert.strictEqual(result.hierarchies[0].depth, 4);
  assert.deepStrictEqual(result.hierarchies[1], { root: "X", tree: {}, has_cycle: true });
  assert.strictEqual("depth" in result.hierarchies[1], false);
  assert.deepStrictEqual(result.hierarchies[2].tree, { P: { Q: { R: {} } } });
  assert.strictEqual(result.hierarchies[2].depth, 3);
  assert.deepStrictEqual(result.hierarchies[3].tree, { G: { H: {}, I: {} } });
  assert.strictEqual(result.hierarchies[3].depth, 2);
});

test("rule 2: every invalid format example is rejected", () => {
  const cases = [
    ["hello", "not a node format"],
    ["1->2", "not uppercase"],
    ["AB->C", "multi-char parent"],
    ["A-B", "wrong separator"],
    ["A->", "missing child"],
    ["A->A", "self-loop"],
    ["", "empty string"],
    ["a->b", "lowercase"],
    ["A->b", "lowercase child"],
    ["A->BC", "multi-char child"],
    ["A->B->C", "chained"],
    ["->B", "missing parent"],
    ["A=>B", "wrong arrow"],
    ["A > B", "spaced arrow"],
  ];
  for (const [input, why] of cases) {
    const r = processData([input]);
    assert.deepStrictEqual(r.invalid_entries, [input], `expected ${input} invalid (${why})`);
    assert.strictEqual(r.hierarchies.length, 0, `no hierarchy for ${input}`);
  }
});

test("rule 2: whitespace is trimmed before validation", () => {
  const r = processData([" A->B ", "  C->D"]);
  assert.deepStrictEqual(r.invalid_entries, []);
  assert.strictEqual(r.summary.total_trees, 2);
});

test("rule 2: invalid entry with surrounding whitespace is trimmed in output", () => {
  const r = processData(["  hello  "]);
  assert.deepStrictEqual(r.invalid_entries, ["hello"]);
});

test("rule 3: repeated edge reported once regardless of count", () => {
  const r = processData(["A->B", "A->B", "A->B"]);
  assert.deepStrictEqual(r.duplicate_edges, ["A->B"]);
  assert.deepStrictEqual(r.hierarchies[0].tree, { A: { B: {} } });
});

test("rule 3: multiple distinct duplicates each listed once, in order", () => {
  const r = processData(["A->B", "C->D", "A->B", "C->D", "A->B"]);
  assert.deepStrictEqual(r.duplicate_edges, ["A->B", "C->D"]);
});

test("rule 4: a root never appears as a child", () => {
  const r = processData(["A->B", "B->C"]);
  assert.strictEqual(r.hierarchies[0].root, "A");
});

test("rule 4: multiple independent trees returned separately", () => {
  const r = processData(["A->B", "C->D", "E->F"]);
  assert.strictEqual(r.summary.total_trees, 3);
  assert.deepStrictEqual(r.hierarchies.map((h) => h.root).sort(), ["A", "C", "E"]);
});

test("rule 4: diamond/multi-parent - first parent wins, second discarded silently", () => {
  const r = processData(["A->D", "B->D"]);
  assert.deepStrictEqual(r.duplicate_edges, []);
  const a = r.hierarchies.find((h) => h.root === "A");
  const b = r.hierarchies.find((h) => h.root === "B");
  assert.deepStrictEqual(a.tree, { A: { D: {} } });
  assert.deepStrictEqual(b.tree, { B: {} });
});

test("rule 4: diamond with deeper structure keeps first parent", () => {
  const r = processData(["A->B", "A->C", "B->D", "C->D"]);
  const a = r.hierarchies.find((h) => h.root === "A");
  assert.deepStrictEqual(a.tree, { A: { B: { D: {} }, C: {} } });
});

test("rule 5: pure cycle -> has_cycle true, empty tree, no depth, smallest root", () => {
  const r = processData(["B->C", "C->A", "A->B"]);
  assert.strictEqual(r.hierarchies.length, 1);
  assert.strictEqual(r.hierarchies[0].root, "A");
  assert.strictEqual(r.hierarchies[0].has_cycle, true);
  assert.deepStrictEqual(r.hierarchies[0].tree, {});
  assert.strictEqual("depth" in r.hierarchies[0], false);
  assert.strictEqual(r.summary.total_cycles, 1);
  assert.strictEqual(r.summary.total_trees, 0);
});

test("rule 5: two separate cycles counted independently", () => {
  const r = processData(["A->B", "B->A", "D->E", "E->D"]);
  assert.strictEqual(r.summary.total_cycles, 2);
  assert.strictEqual(r.summary.total_trees, 0);
  assert.deepStrictEqual(r.hierarchies.map((h) => h.root).sort(), ["A", "D"]);
});

test("rule 5: trees and cycles coexist", () => {
  const r = processData(["A->B", "X->Y", "Y->X"]);
  assert.strictEqual(r.summary.total_trees, 1);
  assert.strictEqual(r.summary.total_cycles, 1);
});

test("rule 6: depth equals node count on longest path", () => {
  assert.strictEqual(processData(["A->B", "B->C"]).hierarchies[0].depth, 3);
  assert.strictEqual(processData(["A->B"]).hierarchies[0].depth, 2);
  assert.strictEqual(processData(["A->B", "A->C", "C->D"]).hierarchies[0].depth, 3);
});

test("rule 7: largest_tree_root tiebreak picks lexicographically smaller root", () => {
  const r = processData(["M->N", "C->D"]);
  assert.strictEqual(r.summary.largest_tree_root, "C");
});

test("rule 7: largest_tree_root picks the deeper tree", () => {
  const r = processData(["A->B", "P->Q", "Q->R"]);
  assert.strictEqual(r.summary.largest_tree_root, "P");
});

test("rule 7: total_trees excludes cyclic groups", () => {
  const r = processData(["A->B", "X->Y", "Y->Z", "Z->X"]);
  assert.strictEqual(r.summary.total_trees, 1);
});

test("edge: empty data array", () => {
  const r = processData([]);
  assert.deepStrictEqual(r.hierarchies, []);
  assert.deepStrictEqual(r.summary, {
    total_trees: 0,
    total_cycles: 0,
    largest_tree_root: null,
  });
});

test("edge: all invalid input", () => {
  const r = processData(["hello", "world", "123"]);
  assert.deepStrictEqual(r.invalid_entries, ["hello", "world", "123"]);
  assert.strictEqual(r.hierarchies.length, 0);
});

test("edge: non-string elements are coerced and treated as invalid", () => {
  const r = processData([123, null, true, "A->B"]);
  assert.strictEqual(r.summary.total_trees, 1);
  assert.ok(r.invalid_entries.includes("123"));
  assert.ok(r.invalid_entries.includes("true"));
  assert.ok(r.invalid_entries.includes(""));
});

test("edge: non-array data is handled safely", () => {
  const r = processData(undefined);
  assert.deepStrictEqual(r.hierarchies, []);
});

test("perf: 50-node chain processes quickly", () => {
  const letters = [];
  for (let i = 0; i < 26; i += 1) letters.push(String.fromCharCode(65 + i));
  const edges = [];
  for (let i = 0; i < 25; i += 1) edges.push(`${letters[i]}->${letters[i + 1]}`);
  const start = Date.now();
  const r = processData(edges);
  const elapsed = Date.now() - start;
  assert.strictEqual(r.hierarchies[0].depth, 26);
  assert.ok(elapsed < 3000, `processing took ${elapsed}ms`);
});

console.log(`\n${passed} passed, ${failed} failed.`);

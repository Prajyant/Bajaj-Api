'use strict';

const VALID_EDGE = /^[A-Z]->[A-Z]$/;

function normalizeEntry(entry) {
  if (typeof entry === 'string') return entry.trim();
  if (entry === null || entry === undefined) return '';
  return String(entry).trim();
}

function splitEdge(edge) {
  const [parent, child] = edge.split('->');
  return [parent, child];
}

function classifyEntries(data) {
  const invalidEntries = [];
  const duplicateEdges = [];
  const seenEdges = new Set();
  const reportedDuplicates = new Set();
  const uniqueEdges = [];
  const firstSeen = new Map();

  let order = 0;
  data.forEach((rawEntry) => {
    const entry = normalizeEntry(rawEntry);

    if (!VALID_EDGE.test(entry)) {
      invalidEntries.push(entry);
      return;
    }

    const [parent, child] = splitEdge(entry);

    if (parent === child) {
      invalidEntries.push(entry);
      return;
    }

    const canonical = `${parent}->${child}`;

    if (seenEdges.has(canonical)) {
      if (!reportedDuplicates.has(canonical)) {
        duplicateEdges.push(canonical);
        reportedDuplicates.add(canonical);
      }
      return;
    }

    seenEdges.add(canonical);
    uniqueEdges.push({ parent, child });

    if (!firstSeen.has(parent)) firstSeen.set(parent, order++);
    if (!firstSeen.has(child)) firstSeen.set(child, order++);
  });

  return { invalidEntries, duplicateEdges, uniqueEdges, firstSeen };
}

function buildGraph(uniqueEdges) {
  const children = new Map();
  const parentOf = new Map();
  const nodes = new Set();

  const ensure = (node) => {
    nodes.add(node);
    if (!children.has(node)) children.set(node, []);
  };

  uniqueEdges.forEach(({ parent, child }) => {
    ensure(parent);
    ensure(child);

    if (parentOf.has(child)) return;

    parentOf.set(child, parent);
    children.get(parent).push(child);
  });

  return { children, parentOf, nodes };
}

function buildSubtree(node, children) {
  const kids = children.get(node) || [];
  const tree = {};
  let maxChildDepth = 0;

  for (const kid of kids) {
    const result = buildSubtree(kid, children);
    tree[kid] = result.tree;
    if (result.depth > maxChildDepth) maxChildDepth = result.depth;
  }

  return { tree, depth: 1 + maxChildDepth };
}

function collectReachable(root, children, visited) {
  const stack = [root];
  while (stack.length) {
    const node = stack.pop();
    if (visited.has(node)) continue;
    visited.add(node);
    for (const kid of children.get(node) || []) stack.push(kid);
  }
}

function processData(data) {
  const safeData = Array.isArray(data) ? data : [];
  const { invalidEntries, duplicateEdges, uniqueEdges, firstSeen } =
    classifyEntries(safeData);
  const { children, parentOf, nodes } = buildGraph(uniqueEdges);

  const hierarchies = [];

  const inTree = new Set();
  const roots = [...nodes].filter((node) => !parentOf.has(node));

  for (const root of roots) {
    const { tree, depth } = buildSubtree(root, children);
    collectReachable(root, children, inTree);
    hierarchies.push({
      kind: 'tree',
      root,
      tree: { [root]: tree },
      depth,
      sortKey: firstSeen.has(root) ? firstSeen.get(root) : Number.MAX_SAFE_INTEGER,
    });
  }

  const visited = new Set();
  for (const node of nodes) {
    if (inTree.has(node) || visited.has(node)) continue;

    const group = new Set();
    const stack = [node];
    while (stack.length) {
      const current = stack.pop();
      if (group.has(current)) continue;
      group.add(current);
      visited.add(current);

      for (const kid of children.get(current) || []) {
        if (!inTree.has(kid)) stack.push(kid);
      }
      const parent = parentOf.get(current);
      if (parent && !inTree.has(parent)) stack.push(parent);
    }

    const groupNodes = [...group];
    const rootlessCandidates = groupNodes.filter((n) => !parentOf.has(n));
    const candidates = rootlessCandidates.length ? rootlessCandidates : groupNodes;
    const root = candidates.sort()[0];

    hierarchies.push({
      kind: 'cycle',
      root,
      tree: {},
      has_cycle: true,
      sortKey: firstSeen.has(root) ? firstSeen.get(root) : Number.MAX_SAFE_INTEGER,
    });
  }

  hierarchies.sort((a, b) => a.sortKey - b.sortKey);

  const publicHierarchies = hierarchies.map((h) => {
    if (h.kind === 'cycle') {
      return { root: h.root, tree: {}, has_cycle: true };
    }
    return { root: h.root, tree: h.tree, depth: h.depth };
  });

  const trees = hierarchies.filter((h) => h.kind === 'tree');
  const cycles = hierarchies.filter((h) => h.kind === 'cycle');

  let largestTreeRoot = null;
  for (const tree of trees) {
    if (
      largestTreeRoot === null ||
      tree.depth > largestTreeRoot.depth ||
      (tree.depth === largestTreeRoot.depth && tree.root < largestTreeRoot.root)
    ) {
      largestTreeRoot = { root: tree.root, depth: tree.depth };
    }
  }

  return {
    hierarchies: publicHierarchies,
    invalid_entries: invalidEntries,
    duplicate_edges: duplicateEdges,
    summary: {
      total_trees: trees.length,
      total_cycles: cycles.length,
      largest_tree_root: largestTreeRoot ? largestTreeRoot.root : null,
    },
  };
}

module.exports = { processData, VALID_EDGE };

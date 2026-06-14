'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const {
  Graph, bfs, dfs, dfsAll, reconstructPath,
  dijkstra, shortestPath, bellmanFord, floydWarshall, aStar,
  topologicalSort, topologicalSortDFS,
  hasCycle, findCycle,
  connectedComponents, stronglyConnectedComponents,
  kruskalMST, primMST, maxFlow, isBipartite, betweennessCentrality,
} = require('../src/index.js');

// ─── Graph basics ────────────────────────────────────────────────────────────

test('Graph: add/remove nodes and edges', () => {
  const g = new Graph();
  g.addNode('A').addNode('B').addEdge('A', 'B', 5);
  assert.strictEqual(g.nodeCount, 2);
  assert.strictEqual(g.edgeCount, 1);
  assert.ok(g.hasNode('A'));
  assert.ok(g.hasEdge('A', 'B'));
  assert.strictEqual(g.getEdge('A', 'B').weight, 5);

  g.removeEdge('A', 'B');
  assert.strictEqual(g.edgeCount, 0);
  assert.ok(!g.hasEdge('A', 'B'));
});

test('Graph: undirected adds both directions', () => {
  const g = new Graph({ directed: false });
  g.addEdge('A', 'B', 3);
  assert.ok(g.hasEdge('A', 'B'));
  assert.ok(g.hasEdge('B', 'A'));
  assert.strictEqual(g.edgeCount, 1);
});

test('Graph: removeNode removes all connected edges', () => {
  const g = new Graph();
  g.addEdge('A', 'B').addEdge('C', 'A').addEdge('B', 'C');
  g.removeNode('A');
  assert.ok(!g.hasNode('A'));
  assert.ok(!g.hasEdge('A', 'B'));
  assert.ok(!g.hasEdge('C', 'A'));
  assert.strictEqual(g.nodeCount, 2);
});

test('Graph: degree, inDegree, outDegree', () => {
  const g = new Graph({ directed: true });
  g.addEdge('A', 'B').addEdge('A', 'C').addEdge('B', 'C');
  assert.strictEqual(g.outDegree('A'), 2);
  assert.strictEqual(g.inDegree('C'), 2);
  assert.strictEqual(g.degree('A'), 2);
});

test('Graph: neighbors and edges', () => {
  const g = new Graph();
  g.addEdge('A', 'B', 2).addEdge('A', 'C', 3);
  assert.deepStrictEqual(g.neighbors('A').sort(), ['B', 'C']);
  assert.strictEqual(g.edges('A').length, 2);
});

test('Graph: clone produces independent copy', () => {
  const g = new Graph();
  g.addEdge('A', 'B', 1);
  const g2 = g.clone();
  g2.addEdge('B', 'C', 1);
  assert.ok(!g.hasNode('C'));
  assert.ok(g2.hasNode('C'));
});

test('Graph: toJSON / fromJSON roundtrip', () => {
  const g = new Graph({ directed: true });
  g.addEdge('A', 'B', 4).addEdge('B', 'C', 2);
  const json = g.toJSON();
  const g2 = Graph.fromJSON(json);
  assert.strictEqual(g2.nodeCount, 3);
  assert.ok(g2.hasEdge('A', 'B'));
  assert.strictEqual(g2.getEdge('A', 'B').weight, 4);
});

// ─── BFS ─────────────────────────────────────────────────────────────────────

test('BFS: distances and parent', () => {
  const g = new Graph();
  g.addEdge('A', 'B').addEdge('A', 'C').addEdge('B', 'D').addEdge('C', 'D');
  const { dist, parent } = bfs(g, 'A');
  assert.strictEqual(dist.get('A'), 0);
  assert.strictEqual(dist.get('B'), 1);
  assert.strictEqual(dist.get('C'), 1);
  assert.strictEqual(dist.get('D'), 2);
  assert.strictEqual(parent.get('A'), null);
});

test('BFS: visit callback can skip neighbors', () => {
  const g = new Graph();
  g.addEdge('A', 'B').addEdge('A', 'C').addEdge('B', 'D');
  const visited = [];
  bfs(g, 'A', (node) => {
    visited.push(node);
    if (node === 'B') return false; // skip B's neighbors
  });
  assert.ok(visited.includes('A'));
  assert.ok(visited.includes('B'));
  assert.ok(visited.includes('C'));
  assert.ok(!visited.includes('D')); // D only reachable through B
});

// ─── DFS ─────────────────────────────────────────────────────────────────────

test('DFS: discover and finish times', () => {
  const g = new Graph();
  g.addEdge('A', 'B').addEdge('B', 'C');
  const { discover, finish, visited } = dfs(g, 'A');
  assert.ok(visited.has('A'));
  assert.ok(visited.has('C'));
  assert.ok(discover.get('A') < discover.get('B'));
  assert.ok(finish.get('C') < finish.get('B'));
});

test('dfsAll: covers all components', () => {
  const g = new Graph({ directed: false });
  g.addEdge('A', 'B').addEdge('C', 'D');
  const { visited } = dfsAll(g);
  assert.strictEqual(visited.size, 4);
});

// ─── reconstructPath ─────────────────────────────────────────────────────────

test('reconstructPath: builds path from parent map', () => {
  const parent = new Map([['B', 'A'], ['C', 'B'], ['A', null]]);
  const path = reconstructPath(parent, 'A', 'C');
  assert.deepStrictEqual(path, ['A', 'B', 'C']);
});

test('reconstructPath: returns null when unreachable', () => {
  const parent = new Map([['A', null]]);
  const path = reconstructPath(parent, 'A', 'Z');
  assert.strictEqual(path, null);
});

// ─── Dijkstra ────────────────────────────────────────────────────────────────

test('Dijkstra: shortest distances', () => {
  const g = new Graph();
  g.addEdge('A', 'B', 4).addEdge('A', 'C', 2).addEdge('C', 'B', 1).addEdge('B', 'D', 5).addEdge('C', 'D', 8);
  const { dist } = dijkstra(g, 'A');
  assert.strictEqual(dist.get('A'), 0);
  assert.strictEqual(dist.get('C'), 2);
  assert.strictEqual(dist.get('B'), 3); // A→C→B = 2+1 = 3
  assert.strictEqual(dist.get('D'), 8); // A→C→B→D = 3+5 = 8
});

test('shortestPath: returns the actual path', () => {
  const g = new Graph();
  g.addEdge('A', 'B', 4).addEdge('A', 'C', 2).addEdge('C', 'B', 1).addEdge('B', 'D', 5);
  const path = shortestPath(g, 'A', 'D');
  assert.deepStrictEqual(path, ['A', 'C', 'B', 'D']);
});

test('shortestPath: returns null when no path', () => {
  const g = new Graph();
  g.addNode('A').addNode('B'); // disconnected
  const path = shortestPath(g, 'A', 'B');
  assert.strictEqual(path, null);
});

// ─── Bellman-Ford ────────────────────────────────────────────────────────────

test('Bellman-Ford: handles negative weights', () => {
  const g = new Graph();
  g.addEdge('A', 'B', 4).addEdge('A', 'C', -2).addEdge('C', 'B', 1).addEdge('B', 'D', 5);
  const { dist, hasNegativeCycle } = bellmanFord(g, 'A');
  assert.strictEqual(hasNegativeCycle, false);
  assert.strictEqual(dist.get('C'), -2);
  assert.strictEqual(dist.get('B'), -1); // A→C→B = -2+1 = -1
});

test('Bellman-Ford: detects negative cycle', () => {
  const g = new Graph();
  g.addEdge('A', 'B', 1).addEdge('B', 'C', -3).addEdge('C', 'A', 1);
  const { hasNegativeCycle } = bellmanFord(g, 'A');
  assert.strictEqual(hasNegativeCycle, true);
});

// ─── Floyd-Warshall ──────────────────────────────────────────────────────────

test('Floyd-Warshall: all-pairs shortest paths', () => {
  const g = new Graph();
  g.addEdge('A', 'B', 3).addEdge('B', 'C', -1).addEdge('A', 'C', 5);
  const { dist } = floydWarshall(g);
  assert.strictEqual(dist.get('A').get('A'), 0);
  assert.strictEqual(dist.get('A').get('B'), 3);
  assert.strictEqual(dist.get('A').get('C'), 2); // A→B→C = 3 + (-1) = 2
});

// ─── A* ──────────────────────────────────────────────────────────────────────

test('A*: finds shortest path with heuristic', () => {
  const g = new Graph();
  // Simple grid-like: 4 nodes in a line
  g.addEdge('S', 'A', 1).addEdge('A', 'B', 1).addEdge('B', 'G', 1).addEdge('S', 'G', 10);
  const heur = (n) => ({ S: 3, A: 2, B: 1, G: 0 }[n] ?? 0);
  const path = aStar(g, 'S', 'G', heur);
  assert.deepStrictEqual(path, ['S', 'A', 'B', 'G']);
});

test('A*: falls back to Dijkstra with zero heuristic', () => {
  const g = new Graph();
  g.addEdge('A', 'B', 1).addEdge('B', 'C', 1);
  const path = aStar(g, 'A', 'C', () => 0);
  assert.deepStrictEqual(path, ['A', 'B', 'C']);
});

// ─── Topological Sort ────────────────────────────────────────────────────────

test('topologicalSort: valid order', () => {
  const g = new Graph();
  g.addEdge('A', 'B').addEdge('A', 'C').addEdge('B', 'D').addEdge('C', 'D');
  const order = topologicalSort(g);
  assert.strictEqual(order.length, 4);
  assert.ok(order.indexOf('A') < order.indexOf('B'));
  assert.ok(order.indexOf('A') < order.indexOf('C'));
  assert.ok(order.indexOf('B') < order.indexOf('D'));
  assert.ok(order.indexOf('C') < order.indexOf('D'));
});

test('topologicalSort: returns null for cyclic graph', () => {
  const g = new Graph();
  g.addEdge('A', 'B').addEdge('B', 'C').addEdge('C', 'A');
  assert.strictEqual(topologicalSort(g), null);
});

test('topologicalSortDFS: matches Kahn result', () => {
  const g = new Graph();
  g.addEdge('A', 'B').addEdge('B', 'C').addEdge('A', 'C');
  const order1 = topologicalSort(g);
  const order2 = topologicalSortDFS(g);
  assert.deepStrictEqual(order1, order2);
});

test('topologicalSort: throws on undirected', () => {
  const g = new Graph({ directed: false });
  g.addEdge('A', 'B');
  assert.throws(() => topologicalSort(g), /directed/);
});

// ─── Cycle Detection ─────────────────────────────────────────────────────────

test('hasCycle: true for cyclic directed', () => {
  const g = new Graph();
  g.addEdge('A', 'B').addEdge('B', 'C').addEdge('C', 'A');
  assert.ok(hasCycle(g));
});

test('hasCycle: false for DAG', () => {
  const g = new Graph();
  g.addEdge('A', 'B').addEdge('B', 'C').addEdge('A', 'C');
  assert.ok(!hasCycle(g));
});

test('hasCycle: undirected cycle', () => {
  const g = new Graph({ directed: false });
  g.addEdge('A', 'B').addEdge('B', 'C').addEdge('C', 'A');
  assert.ok(hasCycle(g));
});

test('hasCycle: undirected no cycle (tree)', () => {
  const g = new Graph({ directed: false });
  g.addEdge('A', 'B').addEdge('B', 'C');
  assert.ok(!hasCycle(g));
});

test('findCycle: returns cycle nodes', () => {
  const g = new Graph();
  g.addEdge('A', 'B').addEdge('B', 'C').addEdge('C', 'A');
  const cycle = findCycle(g);
  assert.ok(cycle !== null);
  assert.strictEqual(cycle[0], cycle[cycle.length - 1]);
  assert.ok(cycle.includes('A'));
});

test('findCycle: null for acyclic', () => {
  const g = new Graph();
  g.addEdge('A', 'B').addEdge('B', 'C');
  assert.strictEqual(findCycle(g), null);
});

// ─── Connected Components ────────────────────────────────────────────────────

test('connectedComponents: undirected', () => {
  const g = new Graph({ directed: false });
  g.addEdge('A', 'B').addEdge('C', 'D');
  const comps = connectedComponents(g);
  assert.strictEqual(comps.length, 2);
});

test('connectedComponents: directed weakly connected', () => {
  const g = new Graph({ directed: true });
  g.addEdge('A', 'B').addEdge('C', 'B');
  const comps = connectedComponents(g);
  assert.strictEqual(comps.length, 1);
});

test('connectedComponents: single component', () => {
  const g = new Graph({ directed: false });
  g.addEdge('A', 'B').addEdge('B', 'C');
  const comps = connectedComponents(g);
  assert.strictEqual(comps.length, 1);
  assert.strictEqual(comps[0].length, 3);
});

// ─── Strongly Connected Components ───────────────────────────────────────────

test('stronglyConnectedComponents: simple cycle', () => {
  const g = new Graph();
  g.addEdge('A', 'B').addEdge('B', 'C').addEdge('C', 'A');
  const sccs = stronglyConnectedComponents(g);
  assert.strictEqual(sccs.length, 1);
  assert.strictEqual(sccs[0].length, 3);
});

test('stronglyConnectedComponents: DAG has N components', () => {
  const g = new Graph();
  g.addEdge('A', 'B').addEdge('B', 'C');
  const sccs = stronglyConnectedComponents(g);
  assert.strictEqual(sccs.length, 3);
});

// ─── MST ─────────────────────────────────────────────────────────────────────

test('kruskalMST: basic', () => {
  const g = new Graph({ directed: false });
  g.addEdge('A', 'B', 1).addEdge('B', 'C', 2).addEdge('A', 'C', 3).addEdge('C', 'D', 4);
  const { edges, weight } = kruskalMST(g);
  assert.strictEqual(edges.length, 3); // V-1 edges
  assert.strictEqual(weight, 7); // 1+2+4
});

test('kruskalMST: disconnected returns forest', () => {
  const g = new Graph({ directed: false });
  g.addEdge('A', 'B', 1).addEdge('C', 'D', 2);
  const { edges, weight } = kruskalMST(g);
  assert.strictEqual(edges.length, 2);
  assert.strictEqual(weight, 3);
});

test('primMST: same total weight as Kruskal', () => {
  const g = new Graph({ directed: false });
  g.addEdge('A', 'B', 1).addEdge('B', 'C', 2).addEdge('A', 'C', 3).addEdge('C', 'D', 4);
  const { weight: kw } = kruskalMST(g);
  const { weight: pw } = primMST(g, 'A');
  assert.strictEqual(kw, pw);
});

// ─── Max Flow ────────────────────────────────────────────────────────────────

test('maxFlow: simple network', () => {
  const g = new Graph({ directed: true });
  g.addEdge('S', 'A', 3).addEdge('S', 'B', 2).addEdge('A', 'B', 1).addEdge('A', 'T', 2).addEdge('B', 'T', 3);
  const { maxFlow: flow } = maxFlow(g, 'S', 'T');
  assert.strictEqual(flow, 5); // S→A→T(2) + S→B→T(2) + S→A→B→T(1)
});

test('maxFlow: bottleneck', () => {
  const g = new Graph({ directed: true });
  g.addEdge('S', 'A', 10).addEdge('A', 'T', 1); // bottleneck at 1
  const { maxFlow: flow } = maxFlow(g, 'S', 'T');
  assert.strictEqual(flow, 1);
});

// ─── Bipartite ───────────────────────────────────────────────────────────────

test('isBipartite: even cycle is bipartite', () => {
  const g = new Graph({ directed: false });
  g.addEdge('A', 'B').addEdge('B', 'C').addEdge('C', 'D').addEdge('D', 'A');
  const { bipartite } = isBipartite(g);
  assert.ok(bipartite);
});

test('isBipartite: odd cycle is not bipartite', () => {
  const g = new Graph({ directed: false });
  g.addEdge('A', 'B').addEdge('B', 'C').addEdge('C', 'A');
  const { bipartite, coloring } = isBipartite(g);
  assert.ok(!bipartite);
  assert.strictEqual(coloring, null);
});

test('isBipartite: tree is bipartite', () => {
  const g = new Graph({ directed: false });
  g.addEdge('A', 'B').addEdge('A', 'C').addEdge('B', 'D').addEdge('C', 'E');
  const { bipartite, coloring } = isBipartite(g);
  assert.ok(bipartite);
  assert.strictEqual(coloring.get('A'), 0);
  assert.strictEqual(coloring.get('B'), 1);
  assert.strictEqual(coloring.get('D'), 0);
});

// ─── Betweenness Centrality ──────────────────────────────────────────────────

test('betweennessCentrality: center node has highest score', () => {
  const g = new Graph({ directed: false });
  // A-B-C-D: B and C are bridges
  g.addEdge('A', 'B').addEdge('B', 'C').addEdge('C', 'D');
  const bc = betweennessCentrality(g);
  // B and C should have higher betweenness than A and D
  assert.ok(bc.get('B') > bc.get('A'));
  assert.ok(bc.get('C') > bc.get('D'));
});

test('betweennessCentrality: directed graph', () => {
  const g = new Graph({ directed: true });
  g.addEdge('A', 'B').addEdge('B', 'C').addEdge('A', 'C');
  const bc = betweennessCentrality(g);
  // C is a sink, no shortest paths go through it
  assert.strictEqual(bc.get('C'), 0);
  // A→C is direct (shorter), so B has betweenness 0
  assert.strictEqual(bc.get('B'), 0);
});

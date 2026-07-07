'use strict';

/**
 * graphlib-x — Zero-dependency graph algorithms library
 *
 * Directed/undirected graphs with weighted edges.
 * BFS, DFS, Dijkstra, Bellman-Ford, A*, topological sort,
 * cycle detection, connected components, MST (Kruskal/Prim),
 * maximum flow (Ford-Fulkerson), and more.
 */

// ─── Graph ──────────────────────────────────────────────────────────────────

/**
 * @typedef {string|number} NodeId
 * @typedef {{ to: NodeId, weight: number, data?: any }} Edge
 */

class Graph {
  /**
   * Create a new graph.
   * @param {Object} [opts]
   * @param {boolean} [opts.directed=true] — directed or undirected
   * @param {boolean} [opts.weighted=false] — treat missing weights as 1
   */
  constructor({ directed = true, weighted = false } = {}) {
    this.directed = directed;
    this.weighted = weighted;
    this._nodes = new Map(); // id -> { data }
    this._adj = new Map();   // id -> Map<to, { weight, data }>
    this._edgeCount = 0;
  }

  // ── Mutation ──

  addNode(id, data = undefined) {
    if (!this._nodes.has(id)) {
      this._nodes.set(id, { data });
      this._adj.set(id, new Map());
    } else if (data !== undefined) {
      this._nodes.get(id).data = data;
    }
    return this;
  }

  addEdge(from, to, weight = 1, data = undefined) {
    this.addNode(from);
    this.addNode(to);

    const existed = this._adj.get(from).has(to);
    this._adj.get(from).set(to, { weight, data });

    if (!this.directed) {
      this._adj.get(to).set(from, { weight, data });
    }

    if (!existed) this._edgeCount++;
    return this;
  }

  removeNode(id) {
    if (!this._nodes.has(id)) return this;
    // Remove all edges pointing to this node
    for (const [, neighbors] of this._adj) {
      if (neighbors.delete(id) && this.directed) this._edgeCount--;
    }
    // Remove outgoing edges
    const outCount = this._adj.get(id).size;
    this._edgeCount -= outCount;
    this._adj.delete(id);
    this._nodes.delete(id);
    return this;
  }

  removeEdge(from, to) {
    if (!this._adj.has(from)) return this;
    if (this._adj.get(from).delete(to)) {
      this._edgeCount--;
      if (!this.directed) {
        this._adj.get(to)?.delete(from);
      }
    }
    return this;
  }

  // ── Queries ──

  hasNode(id) { return this._nodes.has(id); }

  hasEdge(from, to) {
    return this._adj.get(from)?.has(to) ?? false;
  }

  getEdge(from, to) {
    return this._adj.get(from)?.get(to) ?? null;
  }

  get nodeCount() { return this._nodes.size; }
  get edgeCount() { return this._edgeCount; }
  nodes() { return [...this._nodes.keys()]; }

  neighbors(id) {
    const n = this._adj.get(id);
    return n ? [...n.keys()] : [];
  }

  edges(id) {
    const n = this._adj.get(id);
    if (!n) return [];
    return [...n.entries()].map(([to, { weight, data }]) => ({ from: id, to, weight, data }));
  }

  allEdges() {
    const result = [];
    for (const [from, neighbors] of this._adj) {
      for (const [to, { weight, data }] of neighbors) {
        result.push({ from, to, weight, data });
      }
    }
    return result;
  }

  degree(id) {
    return this.neighbors(id).length;
  }

  inDegree(id) {
    let count = 0;
    for (const [, neighbors] of this._adj) {
      if (neighbors.has(id)) count++;
    }
    return count;
  }

  outDegree(id) {
    return this._adj.get(id)?.size ?? 0;
  }

  clone() {
    const g = new Graph({ directed: this.directed, weighted: this.weighted });
    for (const [id, { data }] of this._nodes) {
      g.addNode(id, data);
    }
    for (const { from, to, weight, data } of this.allEdges()) {
      if (this.directed || from <= to || !g.hasEdge(from, to)) {
        g.addEdge(from, to, weight, data);
      }
    }
    return g;
  }

  toJSON() {
    return {
      directed: this.directed,
      weighted: this.weighted,
      nodes: this.nodes().map(id => ({ id, data: this._nodes.get(id).data })),
      edges: this.directed
        ? this.allEdges()
        : this.allEdges().filter((e, i, arr) => {
            const rev = arr.findIndex(x => x.from === e.to && x.to === e.from);
            return i <= rev;
          }),
    };
  }

  static fromJSON(json) {
    const g = new Graph({ directed: json.directed ?? true, weighted: json.weighted ?? false });
    for (const n of json.nodes || []) g.addNode(n.id, n.data);
    for (const e of json.edges || []) g.addEdge(e.from, e.to, e.weight ?? 1, e.data);
    return g;
  }
}

// ─── Traversal ──────────────────────────────────────────────────────────────

/**
 * Breadth-first search. Returns visited set and distances.
 * @param {Graph} graph
 * @param {NodeId} start
 * @param {function(NodeId, NodeId):boolean} [visit] — called (node, parent); return false to skip neighbors
 * @returns {{ visited: Set, dist: Map<NodeId, number>, parent: Map<NodeId, NodeId|null> }}
 */
function bfs(graph, start, visit) {
  const visited = new Set();
  const dist = new Map();
  const parent = new Map();
  if (!graph.hasNode(start)) return { visited, dist, parent };
  const queue = [start];
  visited.add(start);
  dist.set(start, 0);
  parent.set(start, null);
  while (queue.length) {
    const node = queue.shift();
    let explore = true;
    if (visit) {
      const result = visit(node, parent.get(node));
      if (result === false) explore = false;
    }
    if (!explore) continue;
    for (const nb of graph.neighbors(node)) {
      if (!visited.has(nb)) {
        visited.add(nb);
        dist.set(nb, dist.get(node) + 1);
        parent.set(nb, node);
        queue.push(nb);
      }
    }
  }
  return { visited, dist, parent };
}

/**
 * Depth-first search from a start node.
 * @returns {{ visited: Set, discover: Map, finish: Map, parent: Map }}
 */
function dfs(graph, start, visit) {
  const visited = new Set();
  const discover = new Map();
  const finish = new Map();
  const parent = new Map();
  if (!graph.hasNode(start)) return { visited, discover, finish, parent };
  let time = 0;
  function go(node, par) {
    visited.add(node);
    discover.set(node, ++time);
    parent.set(node, par);
    if (visit) visit(node, par);
    for (const nb of graph.neighbors(node)) {
      if (!visited.has(nb)) go(nb, node);
    }
    finish.set(node, ++time);
  }
  go(start, null);
  return { visited, discover, finish, parent };
}

/**
 * DFS over entire graph (all components).
 */
function dfsAll(graph, visit) {
  const visited = new Set();
  const parent = new Map();
  const discover = new Map();
  const finish = new Map();
  let time = 0;
  function go(node, par) {
    visited.add(node);
    discover.set(node, ++time);
    parent.set(node, par);
    if (visit) visit(node, par);
    for (const nb of graph.neighbors(node)) {
      if (!visited.has(nb)) go(nb, node);
    }
    finish.set(node, ++time);
  }
  for (const node of graph.nodes()) {
    if (!visited.has(node)) go(node, null);
  }
  return { visited, discover, finish, parent };
}

/**
 * Reconstruct path from start to target using a parent map.
 */
function reconstructPath(parent, start, target) {
  if (!parent.has(target) && target !== start) return null;
  const path = [];
  let cur = target;
  while (cur !== null && cur !== undefined) {
    path.push(cur);
    if (cur === start) break;
    cur = parent.get(cur);
  }
  if (path[path.length - 1] !== start) return null;
  return path.reverse();
}

// ─── Shortest Paths ─────────────────────────────────────────────────────────

/**
 * Dijkstra's shortest path algorithm.
 * @returns {{ dist: Map, parent: Map }}
 */
function dijkstra(graph, start) {
  const dist = new Map();
  const parent = new Map();
  const visited = new Set();
  // Min-heap using sorted array (simple, correct)
  const heap = [];

  for (const node of graph.nodes()) {
    dist.set(node, Infinity);
    parent.set(node, null);
  }
  dist.set(start, 0);
  heap.push({ id: start, d: 0 });

  while (heap.length) {
    // Find min (linear scan — fine for moderate graphs)
    let minIdx = 0;
    for (let i = 1; i < heap.length; i++) {
      if (heap[i].d < heap[minIdx].d) minIdx = i;
    }
    const { id: u } = heap.splice(minIdx, 1)[0];
    if (visited.has(u)) continue;
    visited.add(u);
    for (const nb of graph.neighbors(u)) {
      if (visited.has(nb)) continue;
      const edge = graph.getEdge(u, nb);
      const nd = dist.get(u) + (edge?.weight ?? 1);
      if (nd < dist.get(nb)) {
        dist.set(nb, nd);
        parent.set(nb, u);
        heap.push({ id: nb, d: nd });
      }
    }
  }
  return { dist, parent };
}

/**
 * Find shortest path between two nodes using Dijkstra.
 * @returns {NodeId[]|null}
 */
function shortestPath(graph, start, target) {
  const { dist, parent } = dijkstra(graph, start);
  if (dist.get(target) === Infinity) return null;
  return reconstructPath(parent, start, target);
}

/**
 * Bellman-Ford algorithm. Handles negative weights and detects negative cycles.
 * @returns {{ dist: Map, parent: Map, hasNegativeCycle: boolean }}
 */
function bellmanFord(graph, start) {
  const dist = new Map();
  const parent = new Map();
  for (const node of graph.nodes()) {
    dist.set(node, Infinity);
    parent.set(node, null);
  }
  dist.set(start, 0);
  const V = graph.nodeCount;
  const edgeList = graph.allEdges();
  // Relax V-1 times
  for (let i = 0; i < V - 1; i++) {
    let changed = false;
    for (const { from, to, weight } of edgeList) {
      const w = weight ?? 1;
      if (dist.get(from) + w < dist.get(to)) {
        dist.set(to, dist.get(from) + w);
        parent.set(to, from);
        changed = true;
      }
    }
    if (!changed) break;
  }
  // Check for negative cycle
  let hasNegativeCycle = false;
  for (const { from, to, weight } of edgeList) {
    const w = weight ?? 1;
    if (dist.get(from) + w < dist.get(to)) {
      hasNegativeCycle = true;
      break;
    }
  }
  return { dist, parent, hasNegativeCycle };
}

/**
 * Floyd-Warshall all-pairs shortest paths.
 * @returns {{ dist: Map<NodeId, Map<NodeId, number>>, next: Map<NodeId, Map<NodeId, NodeId|null>> }}
 */
function floydWarshall(graph) {
  const dist = new Map();
  const next = new Map();
  const nodes = graph.nodes();
  for (const u of nodes) {
    dist.set(u, new Map());
    next.set(u, new Map());
    for (const v of nodes) {
      dist.get(u).set(v, u === v ? 0 : Infinity);
      next.get(u).set(v, null);
    }
  }
  for (const { from, to, weight } of graph.allEdges()) {
    const w = weight ?? 1;
    dist.get(from).set(to, w);
    next.get(from).set(to, to);
    if (!graph.directed) {
      dist.get(to).set(from, w);
      next.get(to).set(from, from);
    }
  }
  for (const k of nodes) {
    for (const i of nodes) {
      for (const j of nodes) {
        const candidate = dist.get(i).get(k) + dist.get(k).get(j);
        if (candidate < dist.get(i).get(j)) {
          dist.get(i).set(j, candidate);
          next.get(i).set(j, next.get(i).get(k));
        }
      }
    }
  }
  return { dist, next };
}

/**
 * A* search with heuristic.
 * @param {Graph} graph
 * @param {NodeId} start
 * @param {NodeId} goal
 * @param {function(NodeId):number} heuristic — estimated distance to goal
 * @returns {NodeId[]|null}
 */
function aStar(graph, start, goal, heuristic = () => 0) {
  const openSet = new Set([start]);
  const cameFrom = new Map();
  const gScore = new Map();
  const fScore = new Map();
  for (const node of graph.nodes()) {
    gScore.set(node, Infinity);
    fScore.set(node, Infinity);
  }
  gScore.set(start, 0);
  fScore.set(start, heuristic(start));

  while (openSet.size) {
    // Find node with lowest fScore
    let current = null;
    let lowest = Infinity;
    for (const id of openSet) {
      if (fScore.get(id) < lowest) {
        lowest = fScore.get(id);
        current = id;
      }
    }
    if (current === goal) {
      // Reconstruct
      const path = [current];
      while (cameFrom.has(current)) {
        current = cameFrom.get(current);
        path.push(current);
      }
      return path.reverse();
    }
    openSet.delete(current);
    for (const nb of graph.neighbors(current)) {
      const edge = graph.getEdge(current, nb);
      const tentative = gScore.get(current) + (edge?.weight ?? 1);
      if (tentative < gScore.get(nb)) {
        cameFrom.set(nb, current);
        gScore.set(nb, tentative);
        fScore.set(nb, tentative + heuristic(nb));
        openSet.add(nb);
      }
    }
  }
  return null;
}

// ─── Topological Sort ───────────────────────────────────────────────────────

/**
 * Kahn's algorithm for topological sort (BFS-based).
 * @returns {NodeId[]|null} — null if cycle exists
 */
function topologicalSort(graph) {
  if (!graph.directed) throw new Error('Topological sort requires a directed graph');
  const inDeg = new Map();
  for (const node of graph.nodes()) inDeg.set(node, 0);
  for (const { to } of graph.allEdges()) {
    inDeg.set(to, (inDeg.get(to) || 0) + 1);
  }
  const queue = [];
  for (const [node, d] of inDeg) {
    if (d === 0) queue.push(node);
  }
  const result = [];
  while (queue.length) {
    const node = queue.shift();
    result.push(node);
    for (const nb of graph.neighbors(node)) {
      inDeg.set(nb, inDeg.get(nb) - 1);
      if (inDeg.get(nb) === 0) queue.push(nb);
    }
  }
  return result.length === graph.nodeCount ? result : null;
}

/**
 * DFS-based topological sort.
 * @returns {NodeId[]|null} — null if cycle exists
 */
function topologicalSortDFS(graph) {
  if (!graph.directed) throw new Error('Topological sort requires a directed graph');
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map();
  for (const node of graph.nodes()) color.set(node, WHITE);
  const result = [];
  let hasCycle = false;

  function visit(node) {
    if (hasCycle) return;
    color.set(node, GRAY);
    for (const nb of graph.neighbors(node)) {
      if (color.get(nb) === GRAY) {
        hasCycle = true;
        return;
      }
      if (color.get(nb) === WHITE) visit(nb);
    }
    color.set(node, BLACK);
    result.push(node);
  }

  for (const node of graph.nodes()) {
    if (color.get(node) === WHITE) visit(node);
  }
  if (hasCycle) return null;
  return result.reverse();
}

// ─── Cycle Detection ────────────────────────────────────────────────────────

/**
 * Detect if a directed graph has a cycle.
 */
function hasCycle(graph) {
  if (!graph.directed) return hasCycleUndirected(graph);
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map();
  for (const node of graph.nodes()) color.set(node, WHITE);

  function dfs(node) {
    color.set(node, GRAY);
    for (const nb of graph.neighbors(node)) {
      if (color.get(nb) === GRAY) return true;
      if (color.get(nb) === WHITE && dfs(nb)) return true;
    }
    color.set(node, BLACK);
    return false;
  }

  for (const node of graph.nodes()) {
    if (color.get(node) === WHITE && dfs(node)) return true;
  }
  return false;
}

/**
 * Detect cycle in undirected graph using union-find.
 */
function hasCycleUndirected(graph) {
  // Build edge list (deduplicate undirected edges)
  const seen = new Set();
  const edgeList = [];
  for (const { from, to } of graph.allEdges()) {
    const key = from < to ? `${from},${to}` : `${to},${from}`;
    if (!seen.has(key)) {
      seen.add(key);
      edgeList.push([from, to]);
    }
  }
  const parent = new Map();
  function find(x) {
    if (!parent.has(x)) parent.set(x, x);
    if (parent.get(x) !== x) parent.set(x, find(parent.get(x)));
    return parent.get(x);
  }
  for (const [u, v] of edgeList) {
    const ru = find(u);
    const rv = find(v);
    if (ru === rv) return true;
    parent.set(ru, rv);
  }
  return false;
}

/**
 * Find one cycle (if any) in a directed graph.
 * @returns {NodeId[]|null} — array of nodes forming a cycle, or null
 */
function findCycle(graph) {
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map();
  const parent = new Map();
  for (const node of graph.nodes()) {
    color.set(node, WHITE);
    parent.set(node, null);
  }
  let cycleStart = null;
  let cycleEnd = null;

  function dfs(node) {
    color.set(node, GRAY);
    for (const nb of graph.neighbors(node)) {
      if (color.get(nb) === GRAY) {
        cycleStart = nb;
        cycleEnd = node;
        return true;
      }
      if (color.get(nb) === WHITE) {
        parent.set(nb, node);
        if (dfs(nb)) return true;
      }
    }
    color.set(node, BLACK);
    return false;
  }

  for (const node of graph.nodes()) {
    if (color.get(node) === WHITE && dfs(node)) {
      // Reconstruct cycle
      const cycle = [cycleStart];
      let cur = cycleEnd;
      while (cur !== cycleStart) {
        cycle.push(cur);
        cur = parent.get(cur);
      }
      cycle.push(cycleStart);
      return cycle.reverse();
    }
  }
  return null;
}

// ─── Connected Components ───────────────────────────────────────────────────

/**
 * Find connected components (undirected) or weakly connected components (directed).
 * @returns {NodeId[][]} — array of components
 */
function connectedComponents(graph) {
  const visited = new Set();
  const components = [];
  for (const node of graph.nodes()) {
    if (!visited.has(node)) {
      const compNodes = [];
      const queue = [node];
      visited.add(node);
      while (queue.length) {
        const cur = queue.shift();
        compNodes.push(cur);
        for (const nb of graph.neighbors(cur)) {
          if (!visited.has(nb)) {
            visited.add(nb);
            queue.push(nb);
          }
        }
      }
      // For directed graphs, also follow reverse edges (weakly connected)
      if (graph.directed) {
        // Check reverse edges
        const queue2 = [...compNodes];
        while (queue2.length) {
          const cur = queue2.shift();
          for (const otherNode of graph.nodes()) {
            if (!visited.has(otherNode) && graph.hasEdge(otherNode, cur)) {
              visited.add(otherNode);
              compNodes.push(otherNode);
              queue2.push(otherNode);
            }
          }
        }
      }
      components.push(compNodes);
    }
  }
  return components;
}

/**
 * Strongly connected components (Tarjan's algorithm, directed graphs).
 * @returns {NodeId[][]}
 */
function stronglyConnectedComponents(graph) {
  if (!graph.directed) return connectedComponents(graph);
  let index = 0;
  const stack = [];
  const indices = new Map();
  const lowlinks = new Map();
  const onStack = new Set();
  const result = [];

  function strongconnect(v) {
    indices.set(v, index);
    lowlinks.set(v, index);
    index++;
    stack.push(v);
    onStack.add(v);

    for (const w of graph.neighbors(v)) {
      if (!indices.has(w)) {
        strongconnect(w);
        lowlinks.set(v, Math.min(lowlinks.get(v), lowlinks.get(w)));
      } else if (onStack.has(w)) {
        lowlinks.set(v, Math.min(lowlinks.get(v), indices.get(w)));
      }
    }

    if (lowlinks.get(v) === indices.get(v)) {
      const component = [];
      let w;
      do {
        w = stack.pop();
        onStack.delete(w);
        component.push(w);
      } while (w !== v);
      result.push(component);
    }
  }

  for (const node of graph.nodes()) {
    if (!indices.has(node)) strongconnect(node);
  }
  return result;
}

// ─── Minimum Spanning Tree ──────────────────────────────────────────────────

/**
 * Kruskal's MST. Works on undirected graphs (or treats directed as undirected).
 * @returns {{ edges: Array<{from, to, weight}>, weight: number }}
 */
function kruskalMST(graph) {
  const edgeList = [];
  const seen = new Set();
  for (const { from, to, weight } of graph.allEdges()) {
    const key = from < to ? `${from},${to}` : `${to},${from}`;
    if (!seen.has(key)) {
      seen.add(key);
      edgeList.push({ from, to, weight: weight ?? 1 });
    }
  }
  edgeList.sort((a, b) => a.weight - b.weight);

  const parent = new Map();
  function find(x) {
    if (!parent.has(x)) parent.set(x, x);
    if (parent.get(x) !== x) parent.set(x, find(parent.get(x)));
    return parent.get(x);
  }
  function union(a, b) {
    const ra = find(a), rb = find(b);
    if (ra === rb) return false;
    parent.set(ra, rb);
    return true;
  }

  const mstEdges = [];
  let totalWeight = 0;
  for (const { from, to, weight } of edgeList) {
    if (union(from, to)) {
      mstEdges.push({ from, to, weight });
      totalWeight += weight;
    }
  }
  return { edges: mstEdges, weight: totalWeight };
}

/**
 * Prim's MST starting from a given node.
 * @returns {{ edges: Array<{from, to, weight}>, weight: number }}
 */
function primMST(graph, start) {
  const nodes = graph.nodes();
  if (nodes.length === 0) return { edges: [], weight: 0 };
  const rootNode = start ?? nodes[0];
  const inTree = new Set([rootNode]);
  const mstEdges = [];
  let totalWeight = 0;

  while (inTree.size < nodes.length) {
    let bestEdge = null;
    let bestWeight = Infinity;
    for (const u of inTree) {
      for (const v of graph.neighbors(u)) {
        if (inTree.has(v)) continue;
        const edge = graph.getEdge(u, v);
        const w = edge?.weight ?? 1;
        if (w < bestWeight) {
          bestWeight = w;
          bestEdge = { from: u, to: v, weight: w };
        }
      }
    }
    if (!bestEdge) break; // disconnected
    mstEdges.push(bestEdge);
    totalWeight += bestEdge.weight;
    inTree.add(bestEdge.to);
  }
  return { edges: mstEdges, weight: totalWeight };
}

// ─── Maximum Flow (Ford-Fulkerson / Edmonds-Karp BFS) ──────────────────────

/**
 * Compute maximum flow from source to sink.
 * Returns flow value and the flow graph.
 * @returns {{ maxFlow: number, flowEdges: Array<{from, to, flow}> }}
 */
function maxFlow(graph, source, sink) {
  // Build residual capacity map
  const capacity = new Map();
  const allNodes = new Set(graph.nodes());

  function capKey(u, v) { return `${u}->${v}`; }
  function getCap(u, v) {
    return capacity.get(capKey(u, v)) ?? 0;
  }
  function setCap(u, v, val) {
    capacity.set(capKey(u, v), val);
  }

  // Initialize capacities from edges
  for (const { from, to, weight } of graph.allEdges()) {
    const w = weight ?? 1;
    const k = capKey(from, to);
    capacity.set(k, (capacity.get(k) ?? 0) + w);
    // Ensure reverse edge exists in residual with 0
    if (!capacity.has(capKey(to, from))) {
      capacity.set(capKey(to, from), 0);
    }
  }

  let maxFlowVal = 0;
  const flowMap = new Map();

  // BFS to find augmenting path
  function findPath() {
    const visited = new Set([source]);
    const parent = new Map();
    const queue = [source];
    while (queue.length) {
      const u = queue.shift();
      for (const v of allNodes) {
        if (!visited.has(v) && getCap(u, v) > 0) {
          visited.add(v);
          parent.set(v, u);
          if (v === sink) return parent;
          queue.push(v);
        }
      }
    }
    return null;
  }

  let parent = findPath();
  while (parent) {
    // Find bottleneck
    let pathFlow = Infinity;
    let v = sink;
    while (v !== source) {
      const u = parent.get(v);
      pathFlow = Math.min(pathFlow, getCap(u, v));
      v = u;
    }
    // Update residual capacities
    v = sink;
    while (v !== source) {
      const u = parent.get(v);
      setCap(u, v, getCap(u, v) - pathFlow);
      setCap(v, u, getCap(v, u) + pathFlow);
      // Record flow
      const fk = capKey(u, v);
      flowMap.set(fk, (flowMap.get(fk) ?? 0) + pathFlow);
      v = u;
    }
    maxFlowVal += pathFlow;
    parent = findPath();
  }

  const flowEdges = [];
  for (const [key, flow] of flowMap) {
    if (flow > 0) {
      const [from, to] = key.split('->');
      flowEdges.push({ from, to, flow });
    }
  }
  return { maxFlow: maxFlowVal, flowEdges };
}

// ─── Bipartite ──────────────────────────────────────────────────────────────

/**
 * Check if a graph is bipartite (2-colorable).
 * @returns {{ bipartite: boolean, coloring: Map<NodeId, number>|null }}
 */
function isBipartite(graph) {
  const color = new Map();
  for (const node of graph.nodes()) {
    if (!color.has(node)) {
      color.set(node, 0);
      const queue = [node];
      while (queue.length) {
        const u = queue.shift();
        for (const v of graph.neighbors(u)) {
          if (!color.has(v)) {
            color.set(v, 1 - color.get(u));
            queue.push(v);
          } else if (color.get(v) === color.get(u)) {
            return { bipartite: false, coloring: null };
          }
        }
      }
    }
  }
  return { bipartite: true, coloring: color };
}

// ─── Centrality ─────────────────────────────────────────────────────────────

/**
 * Compute betweenness centrality for all nodes.
 * Uses Brandes' algorithm.
 * @returns {Map<NodeId, number>}
 */
function betweennessCentrality(graph) {
  const bc = new Map();
  for (const n of graph.nodes()) bc.set(n, 0);

  for (const s of graph.nodes()) {
    // Single-source shortest paths (BFS for unweighted)
    const S = []; // stack
    const P = new Map(); // predecessors
    const sigma = new Map(); // shortest path count
    const d = new Map(); // distance
    for (const n of graph.nodes()) {
      P.set(n, []);
      sigma.set(n, 0);
      d.set(n, -1);
    }
    sigma.set(s, 1);
    d.set(s, 0);
    const Q = [s];
    while (Q.length) {
      const v = Q.shift();
      S.push(v);
      for (const w of graph.neighbors(v)) {
        if (d.get(w) < 0) {
          Q.push(w);
          d.set(w, d.get(v) + 1);
        }
        if (d.get(w) === d.get(v) + 1) {
          sigma.set(w, sigma.get(w) + sigma.get(v));
          P.get(w).push(v);
        }
      }
    }
    const delta = new Map();
    for (const n of graph.nodes()) delta.set(n, 0);
    while (S.length) {
      const w = S.pop();
      for (const v of P.get(w)) {
        delta.set(v, delta.get(v) + (sigma.get(v) / sigma.get(w)) * (1 + delta.get(w)));
      }
      if (w !== s) {
        bc.set(w, bc.get(w) + delta.get(w));
      }
    }
  }

  // For undirected, divide by 2
  if (!graph.directed) {
    for (const [k, v] of bc) bc.set(k, v / 2);
  }
  return bc;
}

// ─── Exports ────────────────────────────────────────────────────────────────

module.exports = {
  Graph,
  bfs,
  dfs,
  dfsAll,
  reconstructPath,
  dijkstra,
  shortestPath,
  bellmanFord,
  floydWarshall,
  aStar,
  topologicalSort,
  topologicalSortDFS,
  hasCycle,
  findCycle,
  connectedComponents,
  stronglyConnectedComponents,
  kruskalMST,
  primMST,
  maxFlow,
  isBipartite,
  betweennessCentrality,
};

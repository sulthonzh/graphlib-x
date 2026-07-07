# graphlib-x

Zero-dependency graph algorithms library for Node.js. Directed/undirected weighted graphs with a clean API and 20+ algorithms.

## Why

Graphs are everywhere — dependency trees, networks, state machines, scheduling. But pulling in a full graph library usually means bloated deps. `graphlib-x` gives you BFS/DFS, Dijkstra, A*, topological sort, cycle detection, MST, max flow, SCC, and more — all in one file, zero deps.

## Install

```bash
npm install graphlib-x
```

## Quick Start

```js
const { Graph, dijkstra, shortestPath, topologicalSort } = require('graphlib-x');

const g = new Graph({ directed: true });
g.addEdge('A', 'B', 4)
 .addEdge('A', 'C', 2)
 .addEdge('C', 'B', 1)
 .addEdge('B', 'D', 5);

// Shortest path A → D
const path = shortestPath(g, 'A', 'D');
// → ['A', 'C', 'B', 'D']

// All distances from A
const { dist } = dijkstra(g, 'A');
// → A:0, C:2, B:3, D:8

// Topological order
const order = topologicalSort(g);
// → ['A', 'C', 'B', 'D']
```

## API

### Graph Class

```js
const g = new Graph({ directed: true, weighted: false });
```

| Method | Description |
|--------|-------------|
| `addNode(id, data?)` | Add a node with optional data |
| `addEdge(from, to, weight?, data?)` | Add a weighted edge |
| `removeNode(id)` | Remove node and all connected edges |
| `removeEdge(from, to)` | Remove a single edge |
| `hasNode(id)` / `hasEdge(from, to)` | Existence checks |
| `getEdge(from, to)` | Get edge `{ weight, data }` |
| `neighbors(id)` | Adjacent node IDs |
| `edges(id)` / `allEdges()` | Edge listings |
| `degree(id)` / `inDegree(id)` / `outDegree(id)` | Degree metrics |
| `clone()` | Deep copy |
| `toJSON()` / `Graph.fromJSON(json)` | Serialization |

### Traversal

```js
const { bfs, dfs, dfsAll, reconstructPath } = require('graphlib-x');

// BFS with distances and parent tracking
const { dist, parent, visited } = bfs(g, 'start');

// DFS with discover/finish timestamps
const { discover, finish } = dfs(g, 'start');

// DFS over entire graph (all components)
const { visited } = dfsAll(g);

// Reconstruct path from parent map
const path = reconstructPath(parent, 'start', 'target');
```

### Shortest Paths

```js
const { dijkstra, shortestPath, bellmanFord, floydWarshall, aStar } = require('graphlib-x');

// Single-source shortest paths (non-negative weights)
const { dist } = dijkstra(g, 'A');

// Shortest path between two nodes
const path = shortestPath(g, 'A', 'E');

// Handles negative weights + detects negative cycles
const { dist, hasNegativeCycle } = bellmanFord(g, 'A');

// All-pairs shortest paths
const { dist } = floydWarshall(g);
dist.get('A').get('B'); // shortest A→B

// A* with custom heuristic
const path = aStar(g, 'start', 'goal', (node) => manhattanDistance(node, 'goal'));
```

### Topological Sort

```js
const { topologicalSort, topologicalSortDFS } = require('graphlib-x');

const order = topologicalSort(g);     // Kahn's (BFS-based)
const order2 = topologicalSortDFS(g); // DFS-based
// Returns null if cycle exists
```

### Cycle Detection

```js
const { hasCycle, findCycle } = require('graphlib-x');

hasCycle(g);         // → true/false
const cycle = findCycle(g);  // → ['A', 'B', 'C', 'A'] or null
```

### Connected Components

```js
const { connectedComponents, stronglyConnectedComponents } = require('graphlib-x');

// Weakly connected (undirected or treats directed as undirected)
const comps = connectedComponents(g);

// Strongly connected (Tarjan's algorithm, directed only)
const sccs = stronglyConnectedComponents(g);
```

### Minimum Spanning Tree

```js
const { kruskalMST, primMST } = require('graphlib-x');

const { edges, weight } = kruskalMST(g);  // Kruskal's (union-find)
const { edges, weight } = primMST(g, 'A'); // Prim's from a start node
```

### Maximum Flow

```js
const { maxFlow } = require('graphlib-x');

const { maxFlow: flow, flowEdges } = maxFlow(g, 'source', 'sink');
```

### Bipartite Check

```js
const { isBipartite } = require('graphlib-x');

const { bipartite, coloring } = isBipartite(g);
// coloring: Map<NodeId, 0|1>
```

### Centrality

```js
const { betweennessCentrality } = require('graphlib-x');

const bc = betweennessCentrality(g); // Brandes' algorithm
bc.get('A'); // centrality score
```

## CLI

```bash
# Demo
graphlib demo

# From JSON file or stdin
echo '{"directed":true,"nodes":[{"id":"A"},{"id":"B"},{"id":"C"}],"edges":[{"from":"A","to":"B","weight":1},{"from":"B","to":"C","weight":2}]}' | graphlib dijkstra A

# Commands: demo, info, bfs, dfs, topo, cycle, components, scc, dijkstra, path, mst, flow, bipartite, centrality
# Flags: --input <file>, --json
```

## Real-World Examples

### Dependency Resolution

```js
const { Graph, topologicalSort } = require('graphlib-x');

const deps = new Graph({ directed: true });
deps.addEdge('app', 'auth');
deps.addEdge('app', 'database');
deps.addEdge('auth', 'database');
deps.addEdge('database', 'driver');

const buildOrder = topologicalSort(deps);
// → ['app', 'auth', 'database', 'driver'] — wait, reversed
// Actually: ['driver', 'database', 'auth', 'app'] — build leaves first
```

### Network Routing

```js
const { Graph, shortestPath } = require('graphlib-x');

const network = new Graph({ directed: false });
network.addEdge('router1', 'router2', 10);
network.addEdge('router2', 'router3', 5);
network.addEdge('router1', 'router3', 30);

const route = shortestPath(network, 'router1', 'router3');
// → ['router1', 'router2', 'router3'] — cheaper through router2
```

## Testing

```bash
npm test
```

81 tests, zero dependencies.

## License

MIT

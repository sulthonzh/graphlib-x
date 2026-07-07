# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2026-07-07

### Fixed
- `removeNode()`: edge count now correctly decrements for both directed and undirected graphs. Previously used `Math.ceil(outCount / 1)` which was a no-op division.
- `bellmanFord()`: removed redundant ternary `graph.directed ? graph.allEdges() : graph.allEdges()` — both branches were identical.
- `connectedComponents()`: removed dead code — first BFS result (`comp`) was unused, then re-computed manually. Now uses a single clean BFS pass.

### Added
- 35 edge-case tests (46 → 81): removeNode on empty/isolated/no-edge nodes, double addNode/addEdge idempotency, auto-node-creation via addEdge, neighbor isolation, dijkstra unreachable nodes, shortestPath null/single-element, bellmanFord negative cycle detection, floydWarshall disconnected, topologicalSort single node/linear/null-on-cycle, hasCycle DAG/cycle, connectedComponents undirected+directed, kruskalMST/primMST single edge, maxFlow two-path, isBipartite triangle/even-cycle, bfs/dfs coverage, reconstructPath unreachable, aStar optimal path, allEdges undirected count, stronglyConnectedComponents cycle

## [1.0.0] - 2026-06-15

### Added
- Initial release: directed/undirected weighted graphs
- 20+ algorithms: BFS, DFS, Dijkstra, Bellman-Ford, Floyd-Warshall, A*, topological sort, cycle detection, connected components, SCC, MST (Kruskal/Prim), max flow (Ford-Fulkerson), bipartite check, betweenness centrality
- CLI tool (`graphlib`)
- Zero dependencies

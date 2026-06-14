'use strict';

const { execFileSync } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { Graph } = require('./index');
const alg = require('./index');

function showHelp() {
  console.log(`graphlib — graph algorithms CLI

Usage: graphlib <command> [options]

Commands:
  demo                 Show example graph operations
  info                 Show graph stats from JSON input
  bfs <start>          Breadth-first search from start
  dfs <start>          Depth-first search from start
  topo                 Topological sort (directed)
  cycle                Detect cycles
  components           Find connected components
  scc                  Find strongly connected components (Tarjan)
  dijkstra <start>     Shortest paths from start
  path <from> <to>     Shortest path between two nodes
  mst                  Minimum spanning tree (Kruskal)
  flow <src> <sink>    Maximum flow (Ford-Fulkerson)
  bipartite            Check if graph is bipartite
  centrality           Betweenness centrality

Input:
  --input <file>       JSON file with graph definition (stdin supported)
  --directed <bool>    Directed graph (default true)

Options:
  --json               Output as JSON
  -h, --help           Show this help

JSON format:
  { "directed": true, "nodes": [{"id":"A"}], "edges": [{"from":"A","to":"B","weight":1}] }
`);
}

function readGraph() {
  let input;
  if (process.argv.includes('--input')) {
    const idx = process.argv.indexOf('--input');
    input = fs.readFileSync(process.argv[idx + 1], 'utf8');
  } else if (!process.stdin.isTTY) {
    input = fs.readFileSync(0, 'utf8');
  } else {
    console.error('No graph input provided. Use --input <file> or pipe JSON.');
    process.exit(1);
  }
  const data = JSON.parse(input);
  return Graph.fromJSON(data);
}

function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (!cmd || cmd === '-h' || cmd === '--help') {
    showHelp();
    return;
  }

  const useJson = args.includes('--json');

  if (cmd === 'demo') {
    const g = new Graph({ directed: true });
    g.addEdge('A', 'B', 4);
    g.addEdge('A', 'C', 2);
    g.addEdge('B', 'D', 5);
    g.addEdge('C', 'D', 1);
    g.addEdge('C', 'E', 8);
    g.addEdge('D', 'E', 2);
    g.addEdge('B', 'C', 1);

    console.log('Directed weighted graph:');
    console.log('  A --4--> B --5--> D');
    console.log('  |        |        |');
    console.log('  2        1        2');
    console.log('  v        v        v');
    console.log('  C ---1--> D --2--> E');
    console.log('  \\___________8__________/');
    console.log('');

    console.log(`Nodes: ${g.nodes().join(', ')}`);
    console.log(`Edges: ${g.edgeCount}`);
    console.log('');

    const { dist } = alg.dijkstra(g, 'A');
    console.log('Dijkstra from A:');
    for (const [node, d] of dist) console.log(`  ${node}: ${d}`);
    console.log('');

    const path = alg.shortestPath(g, 'A', 'E');
    console.log(`Shortest path A→E: ${path.join(' → ')}`);
    console.log('');

    const topo = alg.topologicalSort(g);
    console.log(`Topological order: ${topo.join(' → ')}`);
    console.log('');

    const cycle = alg.findCycle(g);
    console.log(`Has cycle: ${cycle ? cycle.join(' → ') : 'none'}`);
    return;
  }

  const g = readGraph();

  switch (cmd) {
    case 'info': {
      console.log(`Nodes: ${g.nodeCount}, Edges: ${g.edgeCount}, ${g.directed ? 'directed' : 'undirected'}`);
      break;
    }
    case 'bfs': {
      const start = args[1];
      const { dist, parent } = alg.bfs(g, start);
      if (useJson) {
        console.log(JSON.stringify(Object.fromEntries(dist), null, 2));
      } else {
        console.log(`BFS from ${start}:`);
        for (const [node, d] of dist) console.log(`  ${node}: ${d}`);
      }
      break;
    }
    case 'dfs': {
      const start = args[1];
      const { discover, finish, parent } = alg.dfs(g, start);
      if (useJson) {
        console.log(JSON.stringify({
          discover: Object.fromEntries(discover),
          finish: Object.fromEntries(finish),
        }, null, 2));
      } else {
        console.log(`DFS from ${start}:`);
        for (const [node] of discover) {
          console.log(`  ${node}: discover=${discover.get(node)} finish=${finish.get(node)}`);
        }
      }
      break;
    }
    case 'topo': {
      const result = alg.topologicalSort(g);
      if (result === null) {
        console.log('Cycle detected — no valid topological order');
      } else {
        console.log(useJson ? JSON.stringify(result) : `Order: ${result.join(' → ')}`);
      }
      break;
    }
    case 'cycle': {
      const cycle = alg.findCycle(g);
      if (cycle) {
        console.log(useJson ? JSON.stringify({ hasCycle: true, cycle }) : `Cycle found: ${cycle.join(' → ')}`);
      } else {
        console.log(useJson ? JSON.stringify({ hasCycle: false }) : 'No cycle detected');
      }
      break;
    }
    case 'components': {
      const comps = alg.connectedComponents(g);
      if (useJson) {
        console.log(JSON.stringify(comps, null, 2));
      } else {
        console.log(`${comps.length} component(s):`);
        comps.forEach((c, i) => console.log(`  [${i}] ${c.join(', ')}`));
      }
      break;
    }
    case 'scc': {
      const sccs = alg.stronglyConnectedComponents(g);
      if (useJson) {
        console.log(JSON.stringify(sccs, null, 2));
      } else {
        console.log(`${sccs.length} strongly connected component(s):`);
        sccs.forEach((c, i) => console.log(`  [${i}] ${c.join(', ')}`));
      }
      break;
    }
    case 'dijkstra': {
      const start = args[1];
      const { dist, parent } = alg.dijkstra(g, start);
      if (useJson) {
        const paths = {};
        for (const [node, d] of dist) {
          paths[node] = { distance: d };
        }
        console.log(JSON.stringify(paths, null, 2));
      } else {
        console.log(`Shortest distances from ${start}:`);
        for (const [node, d] of dist) {
          console.log(`  ${node}: ${d === Infinity ? '∞' : d}`);
        }
      }
      break;
    }
    case 'path': {
      const from = args[1], to = args[2];
      const p = alg.shortestPath(g, from, to);
      if (p === null) {
        console.log(`No path from ${from} to ${to}`);
      } else {
        const { dist } = alg.dijkstra(g, from);
        if (useJson) {
          console.log(JSON.stringify({ path: p, distance: dist.get(to) }));
        } else {
          console.log(`Path: ${p.join(' → ')} (distance: ${dist.get(to)})`);
        }
      }
      break;
    }
    case 'mst': {
      const { edges, weight } = alg.kruskalMST(g);
      if (useJson) {
        console.log(JSON.stringify({ edges, totalWeight: weight }, null, 2));
      } else {
        console.log(`MST (total weight: ${weight}):`);
        for (const e of edges) console.log(`  ${e.from} --${e.weight}-- ${e.to}`);
      }
      break;
    }
    case 'flow': {
      const src = args[1], sink = args[2];
      const { maxFlow: flow, flowEdges } = alg.maxFlow(g, src, sink);
      if (useJson) {
        console.log(JSON.stringify({ maxFlow: flow, flows: flowEdges }, null, 2));
      } else {
        console.log(`Max flow ${src}→${sink}: ${flow}`);
        for (const e of flowEdges) console.log(`  ${e.from} → ${e.to}: ${e.flow}`);
      }
      break;
    }
    case 'bipartite': {
      const { bipartite, coloring } = alg.isBipartite(g);
      if (useJson) {
        console.log(JSON.stringify({ bipartite, coloring: coloring ? Object.fromEntries(coloring) : null }));
      } else {
        console.log(`Bipartite: ${bipartite}`);
        if (bipartite) {
          const g0 = [...coloring.entries()].filter(([, c]) => c === 0).map(([n]) => n);
          const g1 = [...coloring.entries()].filter(([, c]) => c === 1).map(([n]) => n);
          console.log(`  Set A: ${g0.join(', ')}`);
          console.log(`  Set B: ${g1.join(', ')}`);
        }
      }
      break;
    }
    case 'centrality': {
      const bc = alg.betweennessCentrality(g);
      const sorted = [...bc.entries()].sort((a, b) => b[1] - a[1]);
      if (useJson) {
        console.log(JSON.stringify(Object.fromEntries(sorted), null, 2));
      } else {
        console.log('Betweenness centrality:');
        for (const [node, score] of sorted) {
          console.log(`  ${node}: ${score.toFixed(2)}`);
        }
      }
      break;
    }
    default:
      console.error(`Unknown command: ${cmd}`);
      showHelp();
      process.exit(1);
  }
}

main();

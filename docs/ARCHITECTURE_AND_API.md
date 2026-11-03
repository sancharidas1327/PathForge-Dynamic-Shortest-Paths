# Architecture, Algorithm Pseudocode & REST API Reference

## 1. Algorithm Pseudocode

```text
ALGORITHM: Witness-Guarded Dynamic SSSP Maintenance (PathForge B1)
STATE:
  G = (V, E, w, live)       // Directed multigraph with versioned live flags
  dist[0..n-1]              // Exact shortest-path distance from s
  parent_edge[0..n-1]       // Incoming tree edge ID in T (-1 for s or unreachable)
  tree_children[0..n-1]     // Adjacency list of Shortest-Path Tree T
  tin[0..n-1], tout[0..n-1] // Euler-tour intervals of T
  invalidated_accum         // Cumulative invalidated vertices since last rebuild
  tau                       // Configurable invalidation budget ratio in (0, 1]

PROCEDURE PROCESS_UPDATE(event = (type, e=(u,v), w_new)):
  SWITCH type:
    CASE INSERT:
      eid <- ADD_EDGE(u, v, w_new, live=true)
      INCREMENTAL_RELAX(eid)

    CASE DECREASE:
      // Retain original edge version; insert parallel lower-weight version
      eid <- ADD_PARALLEL_VERSION(e, u, v, w_new, live=true)
      INCREMENTAL_RELAX(eid)

    CASE REOPEN:
      e.live <- true; e.weight <- w_new; e.version++
      INCREMENTAL_RELAX(e.id)

    CASE INCREASE, CLOSE:
      was_tree <- (e.live AND parent_edge[v] == e.id)
      IF type == CLOSE THEN e.live <- false ELSE e.weight <- w_new
      e.version++

      IF NOT was_tree THEN
        RETURN WITNESS_PATHS_VALID // O(1) witness-guarded skip!

      // e was in T: collect affected subtree S = Subtree(T, v)
      S <- COLLECT_SUBTREE(T, v)
      invalidated_accum <- invalidated_accum + |S|

      IF invalidated_accum > ceil(tau * |V|) THEN
        COMPACT_DOMINATED_PARALLEL_EDGES(G)
        FULL_DIJKSTRA_REBUILD(G, s)
        invalidated_accum <- 0
        RETURN FULL_REBUILD_COMPLETED

      // Localized Boundary Repair on S
      FOR each y in S DO
        dist[y] <- +INF; parent_edge[y] <- -1
      PQ <- EMPTY_MIN_HEAP()
      FOR each y in S DO
        FOR each live incoming edge b=(x -> y) in rev_adj[y] with x NOT IN S DO
          IF dist[x] + b.weight < dist[y] THEN
            dist[y] <- dist[x] + b.weight
            parent_edge[y] <- b.id
        IF dist[y] < +INF THEN PQ.PUSH((dist[y], y))

      WHILE PQ NOT EMPTY DO
        (d, x) <- PQ.POP_MIN()
        IF d > dist[x] THEN CONTINUE
        FOR each live outgoing edge out=(x -> z) in adj[x] DO
          IF d + out.weight < dist[z] THEN
            dist[z] <- d + out.weight
            parent_edge[z] <- out.id
            PQ.PUSH((dist[z], z))

      REBUILD_EULER_TOUR_INDEX(T)
```

---

## 2. REST API Endpoints

### `GET /api/health`
Returns service health, platform info, and C++17 shared library readiness.

### `GET /api/workspace/default`
Returns the default 10-vertex curated research graph preset and its evaluated C++17 engine state.

### `POST /api/workspace/evaluate`
Evaluates an arbitrary custom graph and sequence of dynamic update events (`INS`, `DEC`, `INC`, `CLOSE`, `REOPEN`) on the C++17 engine, returning distances, `parent_edges`, Euler-tour intervals `[tin, tout]`, step traces, and exact Dijkstra oracle verification results.

### `GET /api/verify`
Executes all 11 automated C++17 correctness verification test suites (362 sequential oracle checks) and returns per-suite timing and diagnostic verification status.

### `POST /api/benchmark/run`
Runs native C++17 benchmarks comparing `B0`, `B1`, `B2`, and Ablations `A1`, `A2`, `A3`, plus multi-point scaling sweeps across graph sizes (`|V| = 100..1000`) and closure rates (`1%`, `5%`, `20%`).

### `GET /api/benchmark/export?format=json|csv`
Exports the latest benchmark telemetry in reproducible JSON or CSV format.

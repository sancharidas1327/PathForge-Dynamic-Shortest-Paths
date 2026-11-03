# Empirical Benchmark & Verification Report

**Engine Version:** `PathForge-v1.0.0-CPP17-O3`  
**Compiler:** `GCC 14.2.0 (-std=c++17 -O3)`  

---

## 1. Automated Correctness Verification Suites (11/11 Passed, 362 Oracle Checks)

Executed via `./engine/bin/pathforge_cli verify`:

| # | Suite Name | Category | Events Verified | Runtime (µs) | Oracle Result |
| :- | :--- | :--- | :-: | :-: | :-: |
| 1 | Non-Tree Edge Weight Increase | Witness Guarding | 1 | 148.80 | **PASS** |
| 2 | Non-Tree Edge Closure | Witness Guarding | 1 | 14.80 | **PASS** |
| 3 | Tree-Edge Weight Increase & Subtree Repair | Subtree Invalidation | 1 | 41.20 | **PASS** |
| 4 | Tree-Edge Closure & Boundary Repair | Subtree Invalidation | 1 | 13.50 | **PASS** |
| 5 | Edge Weight Decrease via Parallel Edge Insertion | Monotone Reduction | 1 | 19.80 | **PASS** |
| 6 | Edge Reopening & Connectivity Restoration | Lifecycle Events | 2 | 11.50 | **PASS** |
| 7 | Disconnected Components & Unreachable Subgraphs | Boundary Conditions | 2 | 11.30 | **PASS** |
| 8 | Parallel Multi-Edges & Equal-Weight Tie Breaking | Structural Edge Cases | 1 | 9.30 | **PASS** |
| 9 | Self-Loops & Overflow/Invalid Input Guarding | Safety & Robustness | 2 | 230.60 | **PASS** |
| 10 | Sequential Mixed Stress (200 Dynamic Updates vs Oracle) | Stress & Adversarial | 200 | 2222.00 | **PASS** |
| 11 | Adversarial Repeated Tree-Edge Closures (150 Attacks) | Stress & Adversarial | 150 | 2214.50 | **PASS** |

---

## 2. Baseline & Ablation Benchmark Results

Workload: `SPARSE_RANDOM`, `MIXED_REALISTIC` sequence, `seed=42`, `closure_rate=0.05`, `invalidation_budget=0.35`.

| Mode | Description | Total Time (µs) | Avg Latency (µs) | P99 Latency (µs) | Full Rebuilds | Invalidated Vertices | Correctness Violations |
| :--- | :--- | :-: | :-: | :-: | :-: | :-: | :-: |
| **B0** | Full Dijkstra Recomputation | 404.20 | 10.10 | 19.70 | 40 | 0 | **0** |
| **B1** | **Witness-Guarded Dynamic Repair (Proposed)** | **46.70** | **1.17** | **8.60** | **0** | **1** | **0** |
| **B2** | Insertion-Only Reference Surrogate | 32.40 | 0.81 | 4.40 | 0 | 0 | *11 Unsupported (INC/CLOSE)* |
| **A1** | Ablation A1: Rebuild on Every INC/CLOSE | 220.90 | 5.52 | 24.00 | 11 | 0 | **0** |
| **A2** | Ablation A2: Disable Parallel Edge Compaction | 35.90 | 0.90 | 4.30 | 0 | 1 | **0** |
| **A3** | Ablation A3: Rebuild on DECREASE Events | 230.50 | 5.76 | 28.70 | 15 | 1 | **0** |

### Scaling Across Graph Sizes (`|V| = 100` to `1000`)

| Vertices `|V|` | Edges `|E|` | B0 Full Dijkstra (µs) | B1 Witness-Guarded (µs) | Measured Speedup (B1 vs B0) |
| :-: | :-: | :-: | :-: | :-: |
| 100 | 300 | 389.40 | 90.00 | **4.33x** |
| 250 | 750 | 1546.70 | 409.60 | **3.78x** |
| 500 | 1500 | 3196.80 | 344.70 | **9.27x** |
| 1000 | 3000 | 9180.00 | 482.60 | **19.02x** |

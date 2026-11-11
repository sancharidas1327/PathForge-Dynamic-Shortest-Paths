# DESIGN AND ANALYSIS OF ALGORITHMS (DAA) — PROJECT REPORT

**Project Title:** PathForge: A Smart Dynamic Shortest Path Maintenance System  
**Student Name:** Sanchari Das  
**Registration Number:** 24BAI1038  
**Subject:** Design and Analysis of Algorithms (DAA)  
**GitHub Repository:** https://github.com/sancharidas1327/PathForge-Dynamic-Shortest-Paths  

---

## 1. Introduction — What Is This Project About?
Imagine using Google Maps to drive from your home to your university. When you start your trip, the app calculates the shortest path using an algorithm like Dijkstra's algorithm. However, real-world road networks are never static—new shortcuts open, traffic clears up, accidents cause sudden traffic jams (increasing travel time), and floods or roadworks completely close certain roads.

If a navigation system runs full Dijkstra's algorithm from scratch every single time any road in the city changes, it wastes a huge amount of computation time—especially if the road that got jammed or closed wasn't even on your best route! On the other hand, recent research papers—such as Yang P. Liu’s 2025 paper (`arXiv:2506.19207v1`)—can update shortest paths very fast, but only when new edges are inserted (where paths only get shorter). They cannot directly handle roads getting slower or closing down.

To solve this practical gap for my Design and Analysis of Algorithms (DAA) project, I built **PathForge**. PathForge is a C++17 algorithm engine and interactive visual platform that maintains exact shortest paths when the graph changes in five realistic ways:
1. **`INSERT`** — Adding a new directed edge.
2. **`DECREASE`** — Making an existing edge faster (lower weight).
3. **`INCREASE`** — Making an edge slower due to congestion (higher weight).
4. **`CLOSE`** — Closing an edge completely due to an outage or flood.
5. **`REOPEN`** — Reopening a previously closed edge.

---

## 2. The Core Idea — Three Simple Rules of PathForge
Instead of recomputing the entire graph after every change, PathForge remembers the best route to every vertex using a **Shortest-Path Tree ($T$)**. We call the paths inside this tree **"witness paths"** because they serve as proof of the current shortest distance to each node.

- **Rule 1: When a road NOT on our best tree gets slower or closes ($O(1)$ Instant Skip)**  
  If an edge $e = (u 	o v)$ is NOT in our Shortest-Path Tree $T$, nobody was using that road for their shortest path anyway! And making a road slower or closing it can never create a new shortcut. So PathForge skips recomputation in **$O(1)$ time** (`0` vertices recomputed).
- **Rule 2: When a road ON our best tree gets slower or closes (Local Subtree Repair)**  
  If the changed edge $e = (u 	o v)$ WAS part of our Shortest-Path Tree $T$, only vertex $v$ and the nodes below $v$ in the tree ($	ext{Subtree}(T,v)$) lose their best path. Every other node outside that subtree still has its exact shortest path intact! PathForge resets only that small affected subtree, checks live **boundary edges** entering that subtree from unaffected nodes, and runs Dijkstra only on that small region.
- **Rule 3: Safety Valve (The Invalidation Budget $	au = 35\%$)**  
  If too many tree edges break one after another and cumulative invalidated vertices cross $35\%$ of the graph, PathForge cleans up old parallel edges and performs a fresh full Dijkstra rebuild.

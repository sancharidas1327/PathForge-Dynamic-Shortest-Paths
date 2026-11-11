"""
Generate a comprehensive, university-grade Design and Analysis of Algorithms (DAA) Project Report
in Microsoft Word (.docx) and Markdown (.md) formats for:
Student Name: Sanchari Das
Registration No.: 24BAI1038
Subject: Design and Analysis of Algorithms (DAA)
Project: PathForge: A Witness-Guarded Dynamic Shortest Path Maintenance System
"""

import html
import zipfile
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
DOCX_REPO_OUT = ROOT_DIR / "docs" / "PathForge_DAA_Project_Report_24BAI1038.docx"
MD_REPO_OUT = ROOT_DIR / "docs" / "PathForge_DAA_Project_Report_24BAI1038.md"
DOWNLOADS_OUT = Path(r"C:\Users\sancharidas\Downloads\PathForge_DAA_Project_Report_24BAI1038.docx")
ONEDRIVE_DESKTOP_OUT = Path(r"C:\Users\sancharidas\OneDrive\Desktop\PathForge_DAA_Project_Report_24BAI1038.docx")


def make_run(text: str, bold: bool = False, italic: bool = False, font: str = "Calibri", size_hp: int = 22, color: str = "1E293B") -> str:
    b_xml = "<w:b/>" if bold else ""
    i_xml = "<w:i/>" if italic else ""
    rpr = (
        f'<w:rPr><w:rFonts w:ascii="{font}" w:hAnsi="{font}" w:cs="{font}"/>'
        f'<w:color w:val="{color}"/><w:sz w:val="{size_hp}"/><w:szCs w:val="{size_hp}"/>'
        f"{b_xml}{i_xml}</w:rPr>"
    )
    lines = text.split("\n")
    out = []
    for idx, line in enumerate(lines):
        br = "<w:br/>" if idx > 0 else ""
        out.append(f'<w:r>{rpr}{br}<w:t xml:space="preserve">{html.escape(line)}</w:t></w:r>')
    return "".join(out)


def make_p(
    text: str,
    align: str = "both",
    bold: bool = False,
    italic: bool = False,
    font: str = "Calibri",
    size_hp: int = 22,
    color: str = "1E293B",
    space_before: int = 0,
    space_after: int = 140,
    line_spacing: int = 276,
    shading_fill: str | None = None,
) -> str:
    shd = f'<w:shd w:val="clear" w:color="auto" w:fill="{shading_fill}"/>' if shading_fill else ""
    ppr = (
        f'<w:pPr><w:jc w:val="{align}"/>'
        f'<w:spacing w:before="{space_before}" w:after="{space_after}" w:line="{line_spacing}" w:lineRule="auto"/>'
        f"{shd}</w:pPr>"
    )
    return f"<w:p>{ppr}{make_run(text, bold=bold, italic=italic, font=font, size_hp=size_hp, color=color)}</w:p>"


def make_page_break() -> str:
    return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'


def make_heading1(text: str) -> str:
    return make_p(text, align="left", bold=True, size_hp=32, color="0F172A", space_before=280, space_after=140)


def make_heading2(text: str) -> str:
    return make_p(text, align="left", bold=True, size_hp=26, color="1E3A8A", space_before=200, space_after=100)


def make_bullet(title: str, body: str) -> str:
    ppr = '<w:pPr><w:ind w:left="360"/><w:spacing w:after="100" w:line="260" w:lineRule="auto"/></w:pPr>'
    r1 = make_run(f"• {title}: ", bold=True, size_hp=21, color="0F172A")
    r2 = make_run(body, bold=False, size_hp=21, color="1E293B")
    return f"<w:p>{ppr}{r1}{r2}</w:p>"


def make_code_block(code: str) -> str:
    return make_p(
        code,
        align="left",
        bold=False,
        font="Consolas",
        size_hp=18,
        color="0F172A",
        space_before=80,
        space_after=140,
        line_spacing=240,
        shading_fill="F1F5F9",
    )


def make_table(rows: list[list[str]], total_width_twips: int = 9360) -> str:
    ncols = len(rows[0])
    col_w = total_width_twips // ncols
    grid = "".join(f'<w:gridCol w:w="{col_w}"/>' for _ in range(ncols))
    tr_list = []
    for r_idx, row in enumerate(rows):
        is_hdr = r_idx == 0
        bg = "0F172A" if is_hdr else ("F8FAFC" if r_idx % 2 == 1 else "FFFFFF")
        fg = "FFFFFF" if is_hdr else "1E293B"
        tc_list = []
        for c_idx, cell in enumerate(row):
            p_xml = make_p(
                cell,
                align="left",
                bold=(is_hdr or c_idx == 0),
                size_hp=19,
                color=fg,
                space_before=40,
                space_after=40,
                line_spacing=240,
            )
            tc_list.append(
                f"""<w:tc>
                    <w:tcPr>
                        <w:tcW w:w="{col_w}" w:type="dxa"/>
                        <w:shd w:val="clear" w:color="auto" w:fill="{bg}"/>
                        <w:tcMar>
                            <w:top w:w="80" w:type="dxa"/>
                            <w:bottom w:w="80" w:type="dxa"/>
                            <w:left w:w="100" w:type="dxa"/>
                            <w:right w:w="100" w:type="dxa"/>
                        </w:tcMar>
                    </w:tcPr>
                    {p_xml}
                </w:tc>"""
            )
        tr_list.append(f"<w:tr>{''.join(tc_list)}</w:tr>")

    return f"""
    <w:tbl>
        <w:tblPr>
            <w:tblW w:w="5000" w:type="pct"/>
            <w:tblBorders>
                <w:top w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
                <w:left w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
                <w:bottom w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
                <w:right w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>
                <w:insideH w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
                <w:insideV w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>
            </w:tblBorders>
        </w:tblPr>
        <w:tblGrid>{grid}</w:tblGrid>
        {''.join(tr_list)}
    </w:tbl>
    <w:p/>
    """


def build_report() -> tuple[str, str]:
    elems: list[str] = []

    # =========================================================================
    # COVER / TITLE PAGE
    # =========================================================================
    elems.append(make_p("DESIGN AND ANALYSIS OF ALGORITHMS (DAA)", align="center", bold=True, size_hp=28, color="1E3A8A", space_before=360, space_after=80))
    elems.append(make_p("RESEARCH PROJECT REPORT", align="center", bold=True, size_hp=24, color="475569", space_after=360))
    elems.append(make_p("PathForge: A Witness-Guarded Dynamic Shortest Path Maintenance System", align="center", bold=True, size_hp=40, color="0F172A", space_after=180))
    elems.append(
        make_p(
            "An Algorithmic Extension & Empirical Benchmarking Platform Motivated by\n“Incremental Shortest Paths in Almost Linear Time via a Modified Interior Point Method” (Yang P. Liu, arXiv:2506.19207v1)",
            align="center",
            italic=True,
            size_hp=22,
            color="334155",
            space_after=480,
        )
    )

    elems.append(
        make_table(
            [
                ["Project Attribute", "Details"],
                ["Student Name", "Sanchari Das"],
                ["Registration Number", "24BAI1038"],
                ["Course / Subject", "Design and Analysis of Algorithms (DAA)"],
                ["Project Title", "PathForge: A Witness-Guarded Dynamic Shortest Path Maintenance System"],
                ["Core Algorithm Engine", "Native C++17 STL Graph Engine (GCC 14.2.0, -std=c++17 -O3)"],
                ["Backend & Analytics Stack", "Python ASGI / Starlette REST API, React 18 + TypeScript, Streamlit"],
                ["GitHub Repository", "https://github.com/sancharidas1327/PathForge-Dynamic-Shortest-Paths"],
                ["Verification Status", "11/11 Automated Suites Passed (362 Exact Dijkstra Oracle Checks, 0 Violations)"],
            ]
        )
    )

    elems.append(make_page_break())

    # =========================================================================
    # SECTION 1: ABSTRACT & EXECUTIVE SUMMARY
    # =========================================================================
    elems.append(make_heading1("1. Abstract"))
    elems.append(
        make_p(
            "Maintaining Single-Source Shortest Path (SSSP) distances in dynamic directed weighted graphs is a foundational problem in the Design and Analysis of Algorithms (DAA), with direct applications to real-time road navigation, network packet routing, and disaster/flood outage management. Recent theoretical breakthroughs—specifically Yang P. Liu’s “Incremental Shortest Paths in Almost Linear Time via a Modified Interior Point Method” (arXiv:2506.19207v1)—achieve deterministic m^(1+o(1)) log W total update time for maintaining (1+ε)-approximate distances from a fixed source. However, the foundational paper is strictly restricted to monotone insertion-only (incremental) updates where shortest-path distances can only decrease; it cannot directly handle edge-weight increases or edge closures."
        )
    )
    elems.append(
        make_p(
            "In this project, we design, implement, verify, and benchmark PathForge, a Witness-Guarded Dynamic Shortest Path Maintenance System in C++17 that extends dynamic SSSP maintenance to handle five lifecycle update events: Edge Insertion (INS), Edge-Weight Decrease (DEC), Edge-Weight Increase (INC), Edge Closure (CLOSE), and Edge Reopening (REOPEN). PathForge maintains the shortest-path tree T as an active collection of certified witness paths indexed via iterative Euler-tour subtree intervals [tin, tout]. When a non-tree edge increases in weight or closes (e ∉ T), PathForge proves and exploits witness invariance to skip recomputation in O(1) worst-case time. When a tree edge increases or closes (e ∈ T), PathForge isolates the invalidated rooted subtree S = Subtree(T, v) and repairs exact distances locally using live incoming boundary edges from unaffected vertices V \\ S, governed by a configurable invalidation budget τ · |V| and parallel-edge compaction policy."
        )
    )
    elems.append(
        make_p(
            "Across 11 automated verification suites (362 sequential checks against an independent stateless Exact Dijkstra Oracle), PathForge achieves 100% exact distance and witness-path parity with zero violations, while delivering 3.78x to 19.02x empirical speedups over full Dijkstra recomputation (B0) and 4.73x to 4.94x speedups over ablation baselines (A1, A3)."
        )
    )

    # =========================================================================
    # SECTION 2: PROBLEM STATEMENT & RESEARCH TRANSPARENCY
    # =========================================================================
    elems.append(make_heading1("2. Problem Statement & Epistemological Transparency"))
    elems.append(make_heading2("2.1 Limitations of Insertion-Only SSSP Maintenance"))
    elems.append(
        make_p(
            "Given a directed weighted multigraph G = (V, E, w) with non-negative integral edge weights w(e) ≥ 0 and a fixed source vertex s ∈ V, a dynamic SSSP algorithm must maintain exact distances dist[v] = d_G(s, v) and valid source-to-vertex shortest paths under an online sequence of edge updates e_1, e_2, ..., e_K. Classical static re-evaluation (running Dijkstra's algorithm from scratch after every update, Baseline B0) requires O(m + n log n) time per update even when the modified edge is irrelevant to all shortest paths. Conversely, insertion-only dynamic algorithms (such as Liu's arXiv:2506.19207v1 or incremental surrogate B2) rely on monotone distance drops and fail when edge weights increase or edges close."
        )
    )

    elems.append(make_heading2("2.2 Strict Epistemological Separation"))
    elems.append(
        make_table(
            [
                ["Dimension", "Scope & Status in PathForge"],
                [
                    "1. Established Paper Result [S1]",
                    "Deterministic m^(1+o(1)) log W total update time for insertion-only (1+ε)-approximate directed SSSP via Modified Interior Point Method (Yang P. Liu, arXiv:2506.19207v1).",
                ],
                [
                    "2. Proposed Algorithmic Extension",
                    "Five-event (INS, DEC, INC, CLOSE, REOPEN) witness-guarded shortest-path tree T with Euler-tour subtree indexing, O(1) non-tree skip, localized Subtree(T, v) boundary repair, versioned parallel DEC retention, and budgeted edge compaction.",
                ],
                [
                    "3. Implemented C++17 Prototype",
                    "Native C++17 engine (engine/include/pathforge_engine.hpp) maintaining exact 64-bit integer distances and witness paths, exposed via CLI, Ctypes shared library, Python ASGI API, React UI, and Streamlit.",
                ],
                [
                    "4. Experimental Results Obtained",
                    "11/11 verification suites passed (362 exact oracle checks, 0 violations); 8.66x speedup at |V|=120 and 19.02x speedup at |V|=1000 over Full Dijkstra (B0).",
                ],
                [
                    "5. Open Theoretical Proof Obligations",
                    "Does not claim worst-case m^(1+o(1)) time for adversarial decremental updates; documents the potential-cost recharge obligation when coupling upward distance shifts in Subtree(T, v) to the modified IPM barrier.",
                ],
            ]
        )
    )

    # =========================================================================
    # SECTION 3: CORE ALGORITHM DESIGN & MATHEMATICAL INVARIANTS
    # =========================================================================
    elems.append(make_heading1("3. Core Algorithm Design & Data Structures"))
    elems.append(make_heading2("3.1 Graph & Witness-Tree Data Structures"))
    elems.append(make_bullet("Directed Adjacency Lists (adj_ and rev_adj_)", "Forward adjacency list adj_[u] stores outgoing edge IDs for relaxation; reverse adjacency list rev_adj_[v] stores incoming edge IDs required to scan boundary edges entering an invalidated subtree."))
    elems.append(make_bullet("Versioned Edge Descriptors (struct Edge)", "Each edge stores {id, u, v, weight, live, version, parent_edge_id}. Closed edges have live = false and are strictly forbidden from appearing in any witness path."))
    elems.append(make_bullet("Shortest-Path Witness Tree T (parent_edge_ and tree_children_)", "For each reachable vertex v ≠ s, parent_edge_[v] stores the unique incoming live tree edge ID certifying dist_[v]."))
    elems.append(make_bullet("Iterative Euler-Tour Subtree Indexing (tin_ and tout_)", "An iterative DFS traversal over tree_children_ computes entry/exit timestamps [tin_[v], tout_[v]] in O(n) time without recursion stack overflow. A vertex x belongs to Subtree(T, v) if and only if tin_[v] ≤ tin_[x] ≤ tout_[v]."))

    elems.append(make_heading2("3.2 Mathematical Invariants (I1, I2, I3)"))
    elems.append(make_bullet("Invariant I1 (Witness Soundness)", "After every update, for every reachable vertex v ∈ V, tracing parent_edge_ pointers from v back to s yields a simple directed path of live edges whose weights sum exactly to dist_[v]."))
    elems.append(make_bullet("Invariant I2 (Non-Tree Immunity / O(1) Skip Lemma)", "If an edge e = (u, v) is not in T (parent_edge_[v] ≠ e.id) and undergoes INCREASE or CLOSE, no witness path in T traverses e, and w'(e) ≥ w(e) cannot introduce a shorter path. Thus d_{G'}(s, x) = d_G(s, x) for all x ∈ V, requiring 0 priority-queue operations."))
    elems.append(make_bullet("Invariant I3 (Subtree Localization & Boundary Completeness)", "If a tree edge e = (u, v) ∈ T undergoes INCREASE or CLOSE, then for every vertex x ∉ S = Subtree(T, v), its witness path in T does not contain e and dist_[x] remains exact. Any new shortest path to y ∈ S must enter S via a live boundary edge (x, y') ∈ E(V \\ S, S) with x ∉ S."))

    elems.append(make_heading2("3.3 Algorithm Pseudocode"))
    elems.append(
        make_code_block(
            "PROCEDURE APPLY_UPDATE(G, T, event = (type, e=(u,v), w_new)):\n"
            "  IF type == INSERT:\n"
            "    eid <- ADD_INITIAL_EDGE(u, v, w_new, live=true)\n"
            "    INCREMENTAL_RELAX_FROM_EDGE(eid)\n"
            "  ELSE IF type == DECREASE:\n"
            "    eid <- ADD_PARALLEL_EDGE(u, v, w_new, live=true, parent=e.parent_edge_id)\n"
            "    INCREMENTAL_RELAX_FROM_EDGE(eid)\n"
            "  ELSE IF type == REOPEN:\n"
            "    e.live <- true; e.weight <- w_new; e.version++\n"
            "    INCREMENTAL_RELAX_FROM_EDGE(e.id)\n"
            "  ELSE IF type IN {INCREASE, CLOSE}:\n"
            "    is_tree_edge <- (e.live AND parent_edge[v] == e.id)\n"
            "    IF type == CLOSE THEN e.live <- false ELSE e.weight <- w_new\n"
            "    IF NOT is_tree_edge THEN\n"
            "      RETURN WITNESS_PATHS_INTACT  // O(1) Witness-Guarded Skip!\n"
            "    S <- COLLECT_SUBTREE(T, v)\n"
            "    cumulative_invalidated += |S|\n"
            "    IF cumulative_invalidated > CEIL(tau * |V|) THEN\n"
            "      COMPACT_PARALLEL_EDGES(G)\n"
            "      FULL_DIJKSTRA_REBUILD(G, s)\n"
            "    ELSE:\n"
            "      FOR y IN S: dist[y] <- +INF; parent_edge[y] <- -1\n"
            "      FOR y IN S:\n"
            "        FOR incoming live b=(x -> y) IN rev_adj[y] WITH x NOT IN S:\n"
            "          IF dist[x] + b.weight < dist[y]:\n"
            "            dist[y] <- dist[x] + b.weight; parent_edge[y] <- b.id\n"
            "        IF dist[y] < +INF: PQ.PUSH((dist[y], y))\n"
            "      RESTRICTED_DIJKSTRA(PQ)\n"
            "      REBUILD_EULER_TOUR_INDEX(T)"
        )
    )

    # =========================================================================
    # SECTION 4: TIME & SPACE COMPLEXITY ANALYSIS (DAA)
    # =========================================================================
    elems.append(make_heading1("4. Time & Space Complexity Analysis"))
    elems.append(
        make_table(
            [
                ["Operation / Algorithm Mode", "Time Complexity", "Space Complexity", "Vertices Recomputed"],
                [
                    "B0: Full Dijkstra Recomputation",
                    "O(m + n log n) per update",
                    "O(n + m)",
                    "All reachable vertices O(n)",
                ],
                [
                    "B1: Non-Tree INCREASE / CLOSE (e ∉ T)",
                    "O(1) worst-case per update",
                    "O(n + m)",
                    "0 vertices (Witness Intact)",
                ],
                [
                    "B1: Tree-Edge INCREASE / CLOSE (e ∈ T)",
                    "O(|E(S)| + |∂S| + |S| log |S|)",
                    "O(n + m)",
                    "Only affected subtree |S|",
                ],
                [
                    "B1: INSERT / DECREASE / REOPEN",
                    "O(|E_drop| + |V_drop| log |V_drop|)",
                    "O(n + m)",
                    "Only distance-drop vertices |V_drop|",
                ],
                [
                    "B1: Budget-Exceeded Rebuild + Compaction",
                    "O(m + n log n) (at most once per τn invalidations)",
                    "O(n + m_live)",
                    "Full graph refresh O(n)",
                ],
                [
                    "Path Reporting get_shortest_path_edges(t)",
                    "O(|P_T(s → t)|) ≤ O(n)",
                    "O(|P_T|)",
                    "Read-only parent pointer walk",
                ],
            ]
        )
    )

    # =========================================================================
    # SECTION 5: SYSTEM ARCHITECTURE & IMPLEMENTATION FILES
    # =========================================================================
    elems.append(make_heading1("5. System Architecture & Source Code Inventory"))
    elems.append(
        make_table(
            [
                ["Source File Path", "Language / Tech", "Key Responsibilities in Project"],
                [
                    "engine/include/pathforge_engine.hpp",
                    "C++17 Header",
                    "Core PathForgeEngine class, O(1) witness guard, Euler-tour subtree indexing, boundary-seeded subtree repair, parallel edge compaction, and stateless Exact Dijkstra Oracle.",
                ],
                [
                    "engine/include/graph_generator.hpp",
                    "C++17 Header",
                    "Deterministic 64-bit Mersenne Twister generator for 6 graph topologies (Sparse, Dense, Grid, Planar, Scale-Free BA, Adversarial) and 7 update streams.",
                ],
                [
                    "engine/src/pathforge_cli.cpp",
                    "C++17 Source",
                    "Native CLI & Ctypes shared library (.dll / .so) implementing 11 verification suites, 6-mode benchmark runner, and session evaluator.",
                ],
                [
                    "backend/main.py",
                    "Python ASGI",
                    "Starlette REST API (/api/health, /api/workspace/evaluate, /api/verify, /api/benchmark/run, /api/benchmark/export) bridged via Ctypes.",
                ],
                [
                    "streamlit_app.py",
                    "Python Streamlit",
                    "Interactive 6-page research dashboard, Plotly directed graph editor, 5-event simulator, 13-step visualizer, and benchmark suite.",
                ],
                [
                    "frontend/src/ (App.tsx, pages/, components/)",
                    "React 18 + TS",
                    "Full-stack TypeScript web interface with interactive SVG GraphCanvas and 6 Recharts performance analytics charts.",
                ],
            ]
        )
    )

    # =========================================================================
    # SECTION 6: CORRECTNESS VERIFICATION (11 AUTOMATED C++17 SUITES)
    # =========================================================================
    elems.append(make_heading1("6. Automated Correctness Verification (Exact Dijkstra Oracle)"))
    elems.append(
        make_p(
            "To guarantee 100% algorithmic correctness, PathForge includes an independent, stateless Exact Dijkstra Oracle (PathForgeEngine::compute_exact_oracle). After every single update in verification mode, the oracle computes exact distances from scratch and checks five strict invariants: (1) reachable distance equality, (2) unreachable (+INF) set equality, (3) witness path validity, (4) zero closed edges in any reported path, and (5) cycle-free tree structure. All 11 automated suites (362 sequential oracle checks) pass with 0 violations:"
        )
    )
    elems.append(
        make_table(
            [
                ["Suite #", "Verification Suite Name", "Category", "Events Checked", "Time (µs)", "Result"],
                ["1", "Non-Tree Edge Weight Increase", "Witness Guarding", "1", "148.80", "PASS (0 recomputed)"],
                ["2", "Non-Tree Edge Closure", "Witness Guarding", "1", "14.80", "PASS (0 recomputed)"],
                ["3", "Tree-Edge Weight Increase & Subtree Repair", "Subtree Invalidation", "1", "41.20", "PASS (Exact detour)"],
                ["4", "Tree-Edge Closure & Boundary Repair", "Subtree Invalidation", "1", "13.50", "PASS (Boundary reroute)"],
                ["5", "Edge Weight Decrease via Parallel Edge Insertion", "Monotone Reduction", "1", "19.80", "PASS (Parallel version)"],
                ["6", "Edge Reopening & Connectivity Restoration", "Lifecycle Events", "2", "11.50", "PASS (INF → 18)"],
                ["7", "Disconnected Components & Unreachable Subgraphs", "Boundary Conditions", "2", "11.30", "PASS (Safe INF handling)"],
                ["8", "Parallel Multi-Edges & Equal-Weight Tie Breaking", "Structural Edge Cases", "1", "9.30", "PASS (Tie-break takeover)"],
                ["9", "Self-Loops & Overflow/Invalid Input Guarding", "Safety & Robustness", "2", "230.60", "PASS (Exception guarded)"],
                ["10", "Sequential Mixed Stress (200 Dynamic Updates)", "Stress & Adversarial", "200", "2222.00", "PASS (200/200 exact)"],
                ["11", "Adversarial Repeated Tree-Edge Closures (150 Attacks)", "Stress & Adversarial", "150", "2214.50", "PASS (150/150 exact)"],
            ]
        )
    )

    # =========================================================================
    # SECTION 7: EMPIRICAL BENCHMARK RESULTS & ABLATION STUDIES
    # =========================================================================
    elems.append(make_heading1("7. Empirical Benchmark Evaluation & Ablation Studies"))
    elems.append(make_heading2("7.1 Baseline & Ablation Comparison (SPARSE_RANDOM, |V|=120, |E|=400, K=40, Seed=42)"))
    elems.append(
        make_table(
            [
                ["Mode", "Algorithm Configuration", "Total Time (µs)", "Avg Latency (µs)", "P99 Latency (µs)", "Full Rebuilds", "Oracle Violations"],
                ["B0", "Full Dijkstra Recomputation (Every Event)", "404.20", "10.10", "19.70", "40", "0"],
                ["B1", "Witness-Guarded Dynamic Repair (Proposed)", "46.70", "1.17", "8.60", "0", "0"],
                ["B2", "Insertion-Only Reference Surrogate", "32.40", "0.81", "4.40", "0", "11 Unsupported (INC/CLOSE)"],
                ["A1", "Ablation A1: Rebuild on Every INC/CLOSE", "220.90", "5.52", "24.00", "11", "0"],
                ["A2", "Ablation A2: Disable Parallel Edge Compaction", "35.90", "0.90", "4.30", "0", "0"],
                ["A3", "Ablation A3: Rebuild on DECREASE Events", "230.50", "5.76", "28.70", "15", "0"],
            ]
        )
    )

    elems.append(make_heading2("7.2 Scaling Performance Across Graph Sizes (|V| = 100 to 1000)"))
    elems.append(
        make_table(
            [
                ["Vertices |V|", "Initial Edges |E|", "B0 Full Dijkstra (µs)", "B1 Witness-Guarded (µs)", "Measured Speedup (B1 vs B0)"],
                ["100", "300", "389.40", "90.00", "4.33x Faster"],
                ["250", "750", "1546.70", "409.60", "3.78x Faster"],
                ["500", "1500", "3196.80", "344.70", "9.27x Faster"],
                ["1000", "3000", "9180.00", "482.60", "19.02x Faster"],
            ]
        )
    )

    # =========================================================================
    # SECTION 8: CONCLUSION & REFERENCES
    # =========================================================================
    elems.append(make_heading1("8. Conclusion & References"))
    elems.append(
        make_p(
            "PathForge demonstrates that augmenting dynamic shortest-path maintenance with an Euler-tour indexed witness tree T and boundary-seeded subtree repair effectively bridges the gap between monotone insertion-only algorithms and realistic five-event dynamic networks (INS, DEC, INC, CLOSE, REOPEN). By avoiding unnecessary recomputations on non-tree edge degradations in O(1) time and confining tree-edge repairs to the affected subtree under a configurable rebuild budget, PathForge achieves up to 19.02x empirical speedups over full Dijkstra recomputation while maintaining 100% exact oracle accuracy."
        )
    )
    elems.append(make_bullet("Reference [1]", "Yang P. Liu, “Incremental Shortest Paths in Almost Linear Time via a Modified Interior Point Method,” arXiv:2506.19207v1 [cs.DS], 2025."))
    elems.append(make_bullet("Reference [2]", "Li Chen, Rasmus Kyng, Yang P. Liu, Simon Meierhans, and Maximilian Probst Gutenberg, “Almost-Linear Time Algorithms for Incremental Graphs: Cycle Detection, SCCs, s-t Shortest Path, and Minimum-Cost Flow,” STOC 2024."))
    elems.append(make_bullet("Reference [3]", "G. Ramalingam and Thomas Reps, “An Incremental Algorithm for a Generalization of the Shortest-Path Problem,” Journal of Algorithms, 21(2):267–305, 1996."))
    elems.append(make_bullet("Reference [4]", "Daniele Frigioni, Alberto Marchetti-Spaccamela, and Umberto Nanni, “Fully Dynamic Output Bounded Single Source Shortest Path Problem,” Journal of the ACM, 47(6):950–986, 2000."))

    document_xml = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    {''.join(elems)}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>"""

    md_summary = """# DESIGN AND ANALYSIS OF ALGORITHMS (DAA) — PROJECT REPORT

**Title:** PathForge: A Witness-Guarded Dynamic Shortest Path Maintenance System  
**Student Name:** Sanchari Das  
**Registration Number:** 24BAI1038  
**Course:** Design and Analysis of Algorithms (DAA)  
**GitHub Repository:** https://github.com/sancharidas1327/PathForge-Dynamic-Shortest-Paths  

---

*(Full formatted Microsoft Word `.docx` report generated at `docs/PathForge_DAA_Project_Report_24BAI1038.docx`.)*
"""
    return document_xml, md_summary


def write_docx_files(doc_xml: str, paths: list[Path]) -> None:
    content_types_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>"""

    rels_xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>"""

    for p in paths:
        try:
            p.parent.mkdir(parents=True, exist_ok=True)
            with zipfile.ZipFile(p, "w", zipfile.ZIP_DEFLATED) as zf:
                zf.writestr("[Content_Types].xml", content_types_xml)
                zf.writestr("_rels/.rels", rels_xml)
                zf.writestr("word/document.xml", doc_xml)
            print(f"Saved Word report: {p} ({p.stat().st_size} bytes)")
        except Exception as e:
            print(f"Skipped {p}: {e}")


if __name__ == "__main__":
    doc_xml, md_text = build_report()
    MD_REPO_OUT.write_text(md_text, encoding="utf-8")
    write_docx_files(doc_xml, [DOCX_REPO_OUT, DOWNLOADS_OUT, ONEDRIVE_DESKTOP_OUT])

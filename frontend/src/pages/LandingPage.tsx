import React from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Cpu,
  GitBranch,
  Layers,
  Play,
  ShieldCheck,
  Sparkles,
  Zap,
  AlertTriangle,
  BookOpen,
} from 'lucide-react';
import { EngineSessionState, GraphNode } from '../types/pathforge';
import { GraphCanvas } from '../components/GraphCanvas';

interface LandingPageProps {
  engineState: EngineSessionState | null;
  nodes: GraphNode[];
  onNavigate: (tab: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ engineState, nodes, onNavigate }) => {
  return (
    <div className="space-y-16 pb-16">
      {/* Hero Section */}
      <section className="relative rounded-2xl border border-slate-800/80 bg-gradient-to-br from-[#0c1018] via-[#090d16] to-[#111627] p-8 md:p-12 overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center relative z-10">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/30 text-violet-300 text-xs font-medium">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Extension Prototype on Yang P. Liu (arXiv:2506.19207v1)</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-slate-50 leading-[1.15]">
              PathForge:{' '}
              <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 bg-clip-text text-transparent">
                Witness-Guarded
              </span>{' '}
              Dynamic Shortest Path Maintenance
            </h1>

            <p className="text-slate-300 text-base sm:text-lg leading-relaxed max-w-2xl">
              While recent interior-point breakthroughs achieve almost-linear time for{' '}
              <span className="text-cyan-300 font-medium">incremental (insertion-only)</span> approximate SSSP,
              real-world networks face edge weight increases and closures. PathForge maintains a shortest-path witness
              tree <code className="text-cyan-300 font-mono text-sm">T</code> to bypass non-tree degradations in{' '}
              <code className="text-emerald-300 font-mono text-sm">O(1)</code> and localize subtree repairs under a
              configurable invalidation budget.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                onClick={() => onNavigate('workspace')}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-semibold text-sm shadow-lg shadow-cyan-500/20 transition"
              >
                <GitBranch className="w-4 h-4" />
                Open Workspace
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => onNavigate('benchmark')}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-100 font-medium text-sm transition"
              >
                <Play className="w-4 h-4 text-violet-400" />
                Run Benchmark
              </button>
              <button
                onClick={() => onNavigate('methodology')}
                className="inline-flex items-center gap-2 px-4 py-3 rounded-xl text-slate-400 hover:text-slate-200 text-sm transition"
              >
                <BookOpen className="w-4 h-4" />
                Read Proof Obligations
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-800/80">
              <div>
                <div className="text-xs text-slate-400">Supported Events</div>
                <div className="text-sm font-mono font-semibold text-cyan-300 mt-0.5">
                  INS · DEC · INC · CLOSE · REOPEN
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Core Engine</div>
                <div className="text-sm font-mono font-semibold text-violet-300 mt-0.5">
                  Native C++17 STL + Euler Tour
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Verification</div>
                <div className="text-sm font-mono font-semibold text-emerald-300 mt-0.5">
                  Exact Dijkstra Oracle (11/11 Pass)
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Live Preview */}
          <div className="lg:col-span-5 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span className="font-mono text-cyan-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Live C++17 Engine Preview (v0 → v9)
              </span>
              <span>Drag nodes or click Open Workspace</span>
            </div>
            {engineState ? (
              <GraphCanvas
                nodes={nodes}
                edges={engineState.edges}
                distances={engineState.distances}
                source={engineState.source}
                targetVertex={9}
                affectedVertices={
                  engineState.event_results.length > 0
                    ? engineState.event_results[engineState.event_results.length - 1].affected_vertices
                    : []
                }
                recomputedVertices={
                  engineState.event_results.length > 0
                    ? engineState.event_results[engineState.event_results.length - 1].recomputed_vertices_list
                    : []
                }
                selectedPathEdges={engineState.selected_path_edges}
                height={340}
                interactive={false}
              />
            ) : (
              <div className="h-[340px] rounded-xl border border-slate-800 bg-slate-900/40 flex items-center justify-center text-slate-400 text-sm">
                Connecting to C++17 Engine...
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Research Integrity Callout Banner */}
      <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6">
        <div className="flex items-start gap-4">
          <AlertTriangle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-2">
            <h2 className="text-base font-semibold text-amber-200">
              Research Transparency & Scope Distinction
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Yang P. Liu&apos;s paper (<em>arXiv:2506.19207v1</em>) proves deterministic{' '}
              <code className="text-amber-300 font-mono">m^(1+o(1))</code> total time for{' '}
              <strong>insertion-only</strong> <code className="font-mono">(1+ε)</code>-approximate directed SSSP via a
              modified Interior Point Method (IPM) with a high-power log-barrier. PathForge does{' '}
              <strong>not</strong> claim to have proved deterministic almost-linear time for decremental/mixed updates.
              Instead, PathForge implements an exact, empirically measurable{' '}
              <strong>Witness-Guarded Dynamic SSSP Prototype</strong> and explicitly documents the open theoretical
              proof obligations (Invalidation Lemma, Invariants I1–I3, potential-budget coupling, and IPM cost-increase
              stability).
            </p>
          </div>
        </div>
      </section>

      {/* How Proposed Approach Differs from Insertion-Only Maintenance */}
      <section className="space-y-6">
        <div className="max-w-3xl">
          <h2 className="text-2xl font-bold text-slate-100">
            How Witness-Guarded Maintenance Differs from Insertion-Only SSSP
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Comparing classical full recomputation, Liu&apos;s insertion-only IPM framework, and our witness-guarded
            mixed-event extension.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-xl border border-slate-800 bg-[#0c1018] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 text-xs font-mono">Baseline B0</span>
              <Cpu className="w-5 h-5 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-100">Full Dijkstra Recomputation</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Re-runs exact Dijkstra from source <code className="font-mono text-slate-200">s</code> on every update
              event regardless of whether the modified edge participates in any shortest path.
            </p>
            <ul className="text-xs text-slate-300 space-y-2 pt-2 border-t border-slate-800/80 font-mono">
              <li>• Handles: INS, DEC, INC, CLOSE, REOPEN</li>
              <li>• Non-Tree INC/CLOSE: O(m + n log n)</li>
              <li>• Tree INC/CLOSE: O(m + n log n)</li>
              <li>• Distance Guarantee: Exact</li>
            </ul>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#0c1018] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 rounded bg-blue-500/10 text-blue-300 border border-blue-500/30 text-xs font-mono">
                arXiv:2506.19207v1 / B2
              </span>
              <Layers className="w-5 h-5 text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-100">Insertion-Only SSSP</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Maintains monotonically non-increasing distances under edge insertions and weight decreases via distance-drop
              detection, but cannot invalidate broken paths when weights increase or edges close.
            </p>
            <ul className="text-xs text-slate-300 space-y-2 pt-2 border-t border-slate-800/80 font-mono">
              <li>• Handles: INS, DEC (Monotone Drops)</li>
              <li>• Non-Tree INC/CLOSE: Unsupported</li>
              <li>• Tree INC/CLOSE: Violates Monotonicity</li>
              <li>• Paper Bound: m^(1+o(1)) (Approximate IPM)</li>
            </ul>
          </div>

          <div className="rounded-xl border border-cyan-500/40 bg-gradient-to-b from-[#0e1525] to-[#0c1018] p-6 space-y-4 shadow-lg shadow-cyan-950/30">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-xs font-mono">
                Proposed Extension B1
              </span>
              <Zap className="w-5 h-5 text-cyan-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-100">Witness-Guarded Dynamic Repair</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Maintains shortest-path tree <code className="font-mono text-cyan-300">T</code> with Euler-tour intervals.
              Skips non-tree <code className="font-mono">INC/CLOSE</code> in <code className="font-mono">O(1)</code> and
              repairs only <code className="font-mono">Subtree(T,e)</code> via live boundary edges.
            </p>
            <ul className="text-xs text-slate-200 space-y-2 pt-2 border-t border-slate-800/80 font-mono">
              <li>• Handles: INS, DEC, INC, CLOSE, REOPEN</li>
              <li>• Non-Tree INC/CLOSE: O(1) Witness Skip</li>
              <li>• Tree INC/CLOSE: Localized Subtree Repair</li>
              <li>• Budget Policy: Rebuild + Edge Compaction</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Key Capabilities & Tech Stack */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="rounded-xl border border-slate-800 bg-[#0c1018] p-6 space-y-4">
          <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            Five-Event Dynamic Lifecycle
          </h3>
          <div className="space-y-3 text-sm text-slate-300">
            <div className="p-3 rounded-lg bg-slate-900/70 border border-slate-800">
              <span className="font-mono text-xs text-cyan-300 font-semibold">1. INSERT (INS) & DECREASE (DEC)</span>
              <p className="text-xs text-slate-400 mt-1">
                Decreases are represented as parallel edge insertions retaining prior edge versions. Both trigger
                incremental distance-drop relaxation from the target endpoint.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-slate-900/70 border border-slate-800">
              <span className="font-mono text-xs text-emerald-300 font-semibold">
                2. NON-TREE INCREASE (INC) & CLOSURE (CLOSE)
              </span>
              <p className="text-xs text-slate-400 mt-1">
                Checked in O(1) via <code className="font-mono">parent_edge[v] == e</code>. Because witness paths in T
                do not use <code className="font-mono">e</code>, all vertex distances remain optimal with zero PQ work.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-slate-900/70 border border-slate-800">
              <span className="font-mono text-xs text-violet-300 font-semibold">
                3. TREE-EDGE INCREASE / CLOSURE & REOPEN
              </span>
              <p className="text-xs text-slate-400 mt-1">
                Invalidates only <code className="font-mono">Subtree(T, v)</code>, seeds a restricted priority queue
                from unaffected boundary vertices <code className="font-mono">u ∉ Subtree(T,v)</code>, and triggers
                full compaction rebuilds when cumulative invalidations exceed <code className="font-mono">τ · |V|</code>.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-[#0c1018] p-6 space-y-4">
          <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-cyan-400" />
            Research-Grade Architecture Stack
          </h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-lg bg-slate-900/70 border border-slate-800 space-y-1">
              <div className="text-slate-400">Algorithm Engine</div>
              <div className="font-semibold text-slate-100 text-sm">C++17 Native Binary</div>
              <div className="text-slate-400">STL Adjacency, Euler Tour, Bounded Dijkstra, Exact Oracle</div>
            </div>
            <div className="p-3.5 rounded-lg bg-slate-900/70 border border-slate-800 space-y-1">
              <div className="text-slate-400">Backend API</div>
              <div className="font-semibold text-slate-100 text-sm">Python ASGI / Starlette</div>
              <div className="text-slate-400">REST JSON/CSV Export, Subprocess Native C++ Execution</div>
            </div>
            <div className="p-3.5 rounded-lg bg-slate-900/70 border border-slate-800 space-y-1">
              <div className="text-slate-400">Interactive Frontend</div>
              <div className="font-semibold text-slate-100 text-sm">React 18 + TypeScript</div>
              <div className="text-slate-400">Tailwind CSS, Recharts Analytics, Directed SVG Graph Editor</div>
            </div>
            <div className="p-3.5 rounded-lg bg-slate-900/70 border border-slate-800 space-y-1">
              <div className="text-slate-400">Reproducibility</div>
              <div className="font-semibold text-slate-100 text-sm">Docker + Seeded Runs</div>
              <div className="text-slate-400">Deterministic PRNG seeds, 6 Graph Families, Ablations A1–A3</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

import React from 'react';
import {
  Activity,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  GitBranch,
  Layers,
  RefreshCw,
  ShieldAlert,
  Zap,
} from 'lucide-react';
import { BenchmarkResponse, EngineSessionState } from '../types/pathforge';

interface DashboardPageProps {
  engineState: EngineSessionState | null;
  latestBenchmark: BenchmarkResponse | null;
  onNavigate: (tab: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  engineState,
  latestBenchmark,
  onNavigate,
}) => {
  if (!engineState) {
    return (
      <div className="p-12 rounded-xl border border-slate-800 bg-[#0c1018] text-center text-slate-400">
        Loading live C++17 engine telemetry...
      </div>
    );
  }

  const lastEvent =
    engineState.event_results.length > 0
      ? engineState.event_results[engineState.event_results.length - 1]
      : null;

  const kpis = [
    {
      label: 'Number of Vertices |V|',
      value: engineState.num_vertices,
      sub: `Source Vertex: v${engineState.source}`,
      icon: Layers,
      accent: 'text-cyan-400',
    },
    {
      label: 'Total Allocated Edges |E|',
      value: engineState.num_edges,
      sub: 'Includes parallel version history',
      icon: GitBranch,
      accent: 'text-blue-400',
    },
    {
      label: 'Live Active Edges',
      value: engineState.num_live_edges,
      sub: `${engineState.num_edges - engineState.num_live_edges} closed edges`,
      icon: Activity,
      accent: 'text-emerald-400',
    },
    {
      label: 'Total Update Events',
      value: engineState.total_events,
      sub: `Mode: ${engineState.mode}`,
      icon: Zap,
      accent: 'text-violet-400',
    },
    {
      label: 'Invalidated Vertices',
      value: engineState.total_invalidated_vertices,
      sub: `${engineState.total_recomputed_vertices} total recomputed`,
      icon: ShieldAlert,
      accent: 'text-rose-400',
    },
    {
      label: 'Full Tree Rebuilds',
      value: engineState.total_rebuilds,
      sub: `Budget ratio τ = ${(engineState.invalidation_budget * 100).toFixed(0)}%`,
      icon: RefreshCw,
      accent: 'text-amber-400',
    },
    {
      label: 'Engine Execution Time',
      value: `${engineState.total_exec_time_us.toFixed(1)} µs`,
      sub: `Init SSSP: ${engineState.init_time_us.toFixed(1)} µs`,
      icon: Clock,
      accent: 'text-cyan-300',
    },
    {
      label: 'Peak Resident Memory',
      value: `${engineState.peak_memory_kb.toFixed(2)} KB`,
      sub: 'Adjacency + Euler tour + Tree state',
      icon: Database,
      accent: 'text-indigo-400',
    },
  ];

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Main Research Telemetry Dashboard</h1>
          <p className="text-sm text-slate-400">
            Real-time metrics dynamically synchronized with the compiled C++17 Witness-Guarded SSSP Engine.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border ${
              engineState.correctness.passed
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            Oracle Verification: {engineState.correctness.passed ? 'EXACT MATCH' : 'VIOLATION'}
          </span>
          <button
            onClick={() => onNavigate('workspace')}
            className="px-3.5 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 text-xs font-medium transition"
          >
            Modify Graph
          </button>
        </div>
      </div>

      {/* 8 Top-level KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k, i) => {
          const Icon = k.icon;
          return (
            <div
              key={i}
              className="rounded-xl border border-slate-800/90 bg-[#0c1018] p-5 flex flex-col justify-between hover:border-slate-700 transition"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">{k.label}</span>
                <Icon className={`w-4 h-4 ${k.accent}`} />
              </div>
              <div className="my-3 text-2xl font-bold font-mono text-slate-100">{k.value}</div>
              <div className="text-[11px] text-slate-400 font-mono">{k.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Status & Latest Event Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Current Graph & Algorithm Mode */}
        <div className="rounded-xl border border-slate-800 bg-[#0c1018] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-100">Algorithm Engine Status</h2>
            <Cpu className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-1.5 border-b border-slate-800/80">
              <span className="text-slate-400">Active Baseline Mode</span>
              <span className="font-mono text-cyan-300 font-semibold">{engineState.mode} (Witness-Guarded)</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800/80">
              <span className="text-slate-400">Invalidation Budget Policy</span>
              <span className="font-mono text-slate-200">
                τ = {(engineState.invalidation_budget * 100).toFixed(0)}% of |V|
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800/80">
              <span className="text-slate-400">Reachable Vertices</span>
              <span className="font-mono text-emerald-300">
                {engineState.distances.filter((d) => d >= 0).length} / {engineState.num_vertices}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800/80">
              <span className="text-slate-400">Shortest-Path Tree Edges</span>
              <span className="font-mono text-cyan-300">
                {engineState.edges.filter((e) => e.in_tree).length} live tree edges
              </span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-400">Closed /Versioned Edges</span>
              <span className="font-mono text-rose-300">
                {engineState.edges.filter((e) => !e.live).length} inactive edges
              </span>
            </div>
          </div>
        </div>

        {/* Latest Update Event */}
        <div className="rounded-xl border border-slate-800 bg-[#0c1018] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-100">Latest Dynamic Update Event</h2>
            <Zap className="w-4 h-4 text-violet-400" />
          </div>
          {lastEvent ? (
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-800/80">
                <span className="text-slate-400">Event Type & Edge</span>
                <span className="font-mono text-amber-300 font-semibold">
                  #{lastEvent.event_id} {lastEvent.event_type} (v{lastEvent.u} → v{lastEvent.v})
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800/80">
                <span className="text-slate-400">Weight Transition</span>
                <span className="font-mono text-slate-200">
                  {lastEvent.prev_weight < 0 ? 'NEW' : lastEvent.prev_weight} → {lastEvent.new_weight}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800/80">
                <span className="text-slate-400">Tree Membership (e ∈ T)</span>
                <span className="font-mono text-cyan-300">{lastEvent.was_in_tree ? 'YES (Tree Edge)' : 'NO (Chord)'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800/80">
                <span className="text-slate-400">Witness Paths Intact?</span>
                <span className="font-mono text-emerald-300">
                  {lastEvent.witness_paths_valid ? 'VALID (Preserved)' : 'INVALIDATED SUBTREE'}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-400">Affected / Recomputed</span>
                <span className="font-mono text-violet-300">
                  {lastEvent.affected_subtree_size} affected · {lastEvent.recomputed_vertices} recomputed (
                  {lastEvent.execution_time_us.toFixed(2)} µs)
                </span>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-400 py-8 text-center">
              No update events applied yet. Visit the Simulator to apply dynamic edge events.
            </div>
          )}
        </div>

        {/* Recent Benchmark Summary */}
        <div className="rounded-xl border border-slate-800 bg-[#0c1018] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-100">Latest Benchmark Summary</h2>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          {latestBenchmark ? (
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-800/80">
                <span className="text-slate-400">Graph Instance</span>
                <span className="font-mono text-slate-200">
                  {latestBenchmark.config.family} ({latestBenchmark.config.vertices}V,{' '}
                  {latestBenchmark.config.initial_edges}E)
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800/80">
                <span className="text-slate-400">B0 Full Dijkstra Total</span>
                <span className="font-mono text-slate-300">
                  {latestBenchmark.summary.b0_total_time_us.toFixed(1)} µs
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800/80">
                <span className="text-slate-400">B1 Witness-Guarded Total</span>
                <span className="font-mono text-cyan-300 font-semibold">
                  {latestBenchmark.summary.b1_total_time_us.toFixed(1)} µs
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-800/80">
                <span className="text-slate-400">Measured Speedup (B1 vs B0)</span>
                <span className="font-mono text-emerald-400 font-bold">
                  {latestBenchmark.summary.speedup_b1_vs_b0.toFixed(2)}x (
                  {latestBenchmark.summary.percentage_improvement.toFixed(1)}%)
                </span>
              </div>
              <div className="pt-1">
                <button
                  onClick={() => onNavigate('analytics')}
                  className="w-full py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 font-medium transition"
                >
                  View Full Analytics Charts →
                </button>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-400 py-8 text-center space-y-3">
              <p>Run a benchmark in the Laboratory to populate comparative measurements.</p>
              <button
                onClick={() => onNavigate('benchmark')}
                className="px-3 py-1.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30"
              >
                Go to Benchmark Lab
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Distance & Witness Tree Table */}
      <div className="rounded-xl border border-slate-800 bg-[#0c1018] overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-100">
              Vertex Witness-Path Distances & Euler-Tour Subtree Indexing
            </h2>
            <p className="text-xs text-slate-400">
              Exact shortest-path distances <code className="font-mono">dist[v]</code>, parent edge in{' '}
              <code className="font-mono">T</code>, and Euler-tour interval <code className="font-mono">[tin, tout]</code>.
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 font-mono">
                <th className="py-2.5 px-4">Vertex</th>
                <th className="py-2.5 px-4">Exact Distance d(s,v)</th>
                <th className="py-2.5 px-4">Parent Edge in T</th>
                <th className="py-2.5 px-4">Euler Interval [tin, tout]</th>
                <th className="py-2.5 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {engineState.distances.map((d, v) => {
                const pe = engineState.parent_edges[v];
                const edgeObj = pe >= 0 ? engineState.edges.find((e) => e.id === pe) : null;
                return (
                  <tr key={v} className="hover:bg-slate-900/40">
                    <td className="py-2.5 px-4 font-semibold text-slate-200">
                      v{v} {v === engineState.source ? '(Source)' : ''}
                    </td>
                    <td className="py-2.5 px-4 text-cyan-300">{d < 0 ? '∞ (Unreachable)' : d}</td>
                    <td className="py-2.5 px-4 text-slate-300">
                      {v === engineState.source
                        ? 'ROOT'
                        : edgeObj
                        ? `e#${edgeObj.id} (v${edgeObj.u}→v${edgeObj.v}, w=${edgeObj.weight})`
                        : 'NIL'}
                    </td>
                    <td className="py-2.5 px-4 text-slate-400">
                      [{engineState.tin[v]}, {engineState.tout[v]}]
                    </td>
                    <td className="py-2.5 px-4">
                      {d >= 0 ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                          Witness Valid
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/20">
                          Disconnected
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

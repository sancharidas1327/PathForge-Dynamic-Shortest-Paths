import React, { useState, useEffect } from 'react';
import {
  Download,
  Upload,
  Plus,
  Trash2,
  Shuffle,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  RotateCcw,
  Undo2,
  Zap,
  CheckCircle2,
  Sliders,
} from 'lucide-react';
import {
  EngineEdgeState,
  EngineSessionState,
  EventTypeStr,
  GraphNode,
  InitialEdge,
  UpdateEventSpec,
} from '../types/pathforge';
import { GraphCanvas } from '../components/GraphCanvas';

interface WorkspaceSimulatorPageProps {
  nodes: GraphNode[];
  initialEdges: InitialEdge[];
  events: UpdateEventSpec[];
  activeEventCount: number;
  source: number;
  targetVertex: number;
  budget: number;
  mode: string;
  engineState: EngineSessionState | null;
  onUpdateGraphConfig: (next: {
    nodes?: GraphNode[];
    initialEdges?: InitialEdge[];
    events?: UpdateEventSpec[];
    activeEventCount?: number;
    source?: number;
    targetVertex?: number;
    budget?: number;
    mode?: string;
  }) => void;
  onResetDefault: () => void;
}

export const WorkspaceSimulatorPage: React.FC<WorkspaceSimulatorPageProps> = ({
  nodes,
  initialEdges,
  events,
  activeEventCount,
  source,
  targetVertex,
  budget,
  mode,
  engineState,
  onUpdateGraphConfig,
  onResetDefault,
}) => {
  // Editor states
  const [edgeU, setEdgeU] = useState<number>(0);
  const [edgeV, setEdgeV] = useState<number>(1);
  const [edgeW, setEdgeW] = useState<number>(15);
  const [selectedEdgeId, setSelectedEdgeId] = useState<number>(0);

  // Simulator new event form
  const [simType, setSimType] = useState<EventTypeStr>('INCREASE');
  const [simU, setSimU] = useState<number>(1);
  const [simV, setSimV] = useState<number>(4);
  const [simW, setSimW] = useState<number>(28);
  const [simEdgeId, setSimEdgeId] = useState<number>(4);

  // Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = setInterval(() => {
      if (activeEventCount < events.length) {
        onUpdateGraphConfig({ activeEventCount: activeEventCount + 1 });
      } else {
        setIsPlaying(false);
      }
    }, 1100);
    return () => clearInterval(timer);
  }, [isPlaying, activeEventCount, events.length, onUpdateGraphConfig]);

  const handleMoveNode = (id: number, x: number, y: number) => {
    const updated = nodes.map((n) => (n.id === id ? { ...n, x, y } : n));
    onUpdateGraphConfig({ nodes: updated });
  };

  const handleAddVertex = () => {
    const nextId = nodes.length > 0 ? Math.max(...nodes.map((n) => n.id)) + 1 : 0;
    const angle = (nextId * 1.1) % (2 * Math.PI);
    const nx = Math.round(450 + 240 * Math.cos(angle));
    const ny = Math.round(250 + 160 * Math.sin(angle));
    onUpdateGraphConfig({
      nodes: [...nodes, { id: nextId, label: `v${nextId}`, x: nx, y: ny }],
    });
  };

  const handleDeleteLastVertex = () => {
    if (nodes.length <= 3) return;
    const maxId = Math.max(...nodes.map((n) => n.id));
    const nextNodes = nodes.filter((n) => n.id !== maxId);
    const nextEdges = initialEdges.filter((e) => e.u !== maxId && e.v !== maxId);
    const nextEvents = events.filter((ev) => ev.u !== maxId && ev.v !== maxId);
    onUpdateGraphConfig({
      nodes: nextNodes,
      initialEdges: nextEdges,
      events: nextEvents,
      activeEventCount: Math.min(activeEventCount, nextEvents.length),
      source: source === maxId ? 0 : source,
      targetVertex: targetVertex === maxId ? nextNodes[nextNodes.length - 1].id : targetVertex,
    });
  };

  const handleAddOrUpdateInitialEdge = () => {
    if (edgeU === edgeV || edgeW <= 0) return;
    const nextId = initialEdges.length > 0 ? Math.max(...initialEdges.map((e) => e.id)) + 1 : 0;
    onUpdateGraphConfig({
      initialEdges: [...initialEdges, { id: nextId, u: edgeU, v: edgeV, weight: edgeW, live: true }],
    });
  };

  const handleApplyDynamicEvent = () => {
    const nextEventId = events.length + 1;
    const newEv: UpdateEventSpec = {
      event_id: nextEventId,
      type: simType,
      edge_id: simType === 'INSERT' ? -1 : simEdgeId,
      u: simU,
      v: simV,
      new_weight: Math.max(1, simW),
    };
    const nextEvents = [...events.slice(0, activeEventCount), newEv];
    onUpdateGraphConfig({
      events: nextEvents,
      activeEventCount: nextEvents.length,
    });
  };

  const handleGenerateRandomGraph = () => {
    const count = 9;
    const randNodes: GraphNode[] = [];
    for (let i = 0; i < count; i++) {
      const col = i % 3;
      const row = Math.floor(i / 3);
      randNodes.push({
        id: i,
        label: `v${i}`,
        x: 150 + col * 280 + (row % 2) * 40,
        y: 95 + row * 145,
      });
    }
    const randEdges: InitialEdge[] = [];
    let eid = 0;
    for (let i = 0; i < count - 1; i++) {
      randEdges.push({
        id: eid++,
        u: i,
        v: i + 1,
        weight: 8 + ((i * 7) % 19),
        live: true,
      });
      if (i + 3 < count) {
        randEdges.push({
          id: eid++,
          u: i,
          v: i + 3,
          weight: 14 + ((i * 11) % 25),
          live: true,
        });
      }
      if (i + 2 < count && i % 2 === 0) {
        randEdges.push({
          id: eid++,
          u: i,
          v: i + 2,
          weight: 22 + ((i * 5) % 20),
          live: true,
        });
      }
    }
    const randEvents: UpdateEventSpec[] = [
      { event_id: 1, type: 'INCREASE', edge_id: 1, u: 0, v: 3, new_weight: 60 },
      { event_id: 2, type: 'CLOSE', edge_id: 0, u: 0, v: 1, new_weight: 8 },
      { event_id: 3, type: 'DECREASE', edge_id: 2, u: 0, v: 2, new_weight: 9 },
      { event_id: 4, type: 'REOPEN', edge_id: 0, u: 0, v: 1, new_weight: 7 },
    ];
    onUpdateGraphConfig({
      nodes: randNodes,
      initialEdges: randEdges,
      events: randEvents,
      activeEventCount: randEvents.length,
      source: 0,
      targetVertex: count - 1,
    });
  };

  const handleExportJson = () => {
    const payload = {
      num_vertices: nodes.length,
      source,
      target_vertex: targetVertex,
      invalidation_budget: budget,
      mode,
      nodes,
      initial_edges: initialEdges,
      events,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pathforge_workspace_graph.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(String(ev.target?.result));
        if (Array.isArray(data.nodes) && Array.isArray(data.initial_edges)) {
          onUpdateGraphConfig({
            nodes: data.nodes,
            initialEdges: data.initial_edges,
            events: Array.isArray(data.events) ? data.events : [],
            activeEventCount: Array.isArray(data.events) ? data.events.length : 0,
            source: data.source ?? 0,
            targetVertex: data.target_vertex ?? data.nodes.length - 1,
            budget: data.invalidation_budget ?? 0.35,
            mode: data.mode ?? 'B1',
          });
        }
      } catch {
        // Ignore malformed JSON
      }
    };
    reader.readAsText(file);
  };

  const handleSelectCanvasEdge = (e: EngineEdgeState) => {
    setSelectedEdgeId(e.id);
    setSimEdgeId(e.id);
    setSimU(e.u);
    setSimV(e.v);
    setSimW(e.weight);
  };

  const latestResult =
    engineState && engineState.event_results.length > 0
      ? engineState.event_results[engineState.event_results.length - 1]
      : null;

  return (
    <div className="space-y-8 pb-12">
      {/* Header & Global Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">
            Interactive Graph Workspace & Dynamic Update Simulator
          </h1>
          <p className="text-sm text-slate-400">
            Edit vertices and weighted directed edges, apply INS/DEC/INC/CLOSE/REOPEN events, and inspect live
            subtree invalidation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleAddVertex}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200"
          >
            <Plus className="w-3.5 h-3.5 text-cyan-400" />
            Add Vertex
          </button>
          <button
            onClick={handleDeleteLastVertex}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
            Remove Last Vertex
          </button>
          <button
            onClick={handleGenerateRandomGraph}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200"
          >
            <Shuffle className="w-3.5 h-3.5 text-violet-400" />
            Random Graph
          </button>
          <button
            onClick={handleExportJson}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            Export JSON
          </button>
          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 cursor-pointer">
            <Upload className="w-3.5 h-3.5 text-blue-400" />
            Import JSON
            <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
          </label>
          <button
            onClick={onResetDefault}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-xs font-medium text-rose-300"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Default
          </button>
        </div>
      </div>

      {/* Main Grid: Left Canvas + Right Simulator & Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 8 cols: Interactive Graph Canvas + Playback Bar */}
        <div className="lg:col-span-8 space-y-4">
          {engineState ? (
            <GraphCanvas
              nodes={nodes}
              edges={engineState.edges}
              distances={engineState.distances}
              source={source}
              targetVertex={targetVertex}
              affectedVertices={latestResult ? latestResult.affected_vertices : []}
              recomputedVertices={latestResult ? latestResult.recomputed_vertices_list : []}
              selectedPathEdges={engineState.selected_path_edges}
              updatedEdgeId={latestResult ? latestResult.edge_id : selectedEdgeId}
              onMoveNode={handleMoveNode}
              onSelectEdge={handleSelectCanvasEdge}
              height={490}
            />
          ) : (
            <div className="h-[490px] rounded-xl border border-slate-800 bg-[#0c1018] flex items-center justify-center text-slate-400">
              Evaluating graph on C++17 Engine...
            </div>
          )}

          {/* Event Sequence Playback Controls */}
          <div className="rounded-xl border border-slate-800 bg-[#0c1018] p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setIsPlaying(false);
                  onUpdateGraphConfig({ activeEventCount: 0 });
                }}
                disabled={activeEventCount === 0}
                className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 border border-slate-700 text-slate-200"
                title="Reset to Initial Graph (0 events)"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setIsPlaying(false);
                  onUpdateGraphConfig({ activeEventCount: Math.max(0, activeEventCount - 1) });
                }}
                disabled={activeEventCount === 0}
                className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 border border-slate-700 text-slate-200"
                title="Step Backward (Undo Last Event)"
              >
                <SkipBack className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {isPlaying ? 'Pause Sequence' : 'Play Sequence'}
              </button>
              <button
                onClick={() => {
                  setIsPlaying(false);
                  onUpdateGraphConfig({ activeEventCount: Math.min(events.length, activeEventCount + 1) });
                }}
                disabled={activeEventCount >= events.length}
                className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 border border-slate-700 text-slate-200"
                title="Step Forward"
              >
                <SkipForward className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  if (activeEventCount > 0) {
                    onUpdateGraphConfig({
                      events: events.slice(0, activeEventCount - 1),
                      activeEventCount: activeEventCount - 1,
                    });
                  }
                }}
                disabled={activeEventCount === 0}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 border border-slate-700 text-xs text-slate-300"
              >
                <Undo2 className="w-3.5 h-3.5" />
                Undo Update
              </button>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono">
              <span className="text-slate-400">
                Timeline Step:{' '}
                <strong className="text-cyan-300">
                  {activeEventCount} / {events.length}
                </strong>
              </span>
              {engineState && (
                <span className="inline-flex items-center gap-1 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Oracle Exact Match
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right 4 cols: Simulator Dispatcher + Graph Settings */}
        <div className="lg:col-span-4 space-y-6">
          {/* Dynamic Event Dispatcher */}
          <div className="rounded-xl border border-slate-800 bg-[#0c1018] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                <Zap className="w-4 h-4 text-cyan-400" />
                Dynamic Update Simulator
              </h2>
              <span className="text-[11px] font-mono text-slate-400">Click any edge on canvas</span>
            </div>

            {/* 5 Event Type Selector Buttons */}
            <div className="grid grid-cols-5 gap-1.5">
              {(['INSERT', 'DECREASE', 'INCREASE', 'CLOSE', 'REOPEN'] as EventTypeStr[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setSimType(t)}
                  className={`py-2 px-1 rounded-lg text-[11px] font-mono font-semibold border transition ${
                    simType === t
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-sm'
                      : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Source (u)</label>
                <select
                  value={simU}
                  onChange={(e) => setSimU(Number(e.target.value))}
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-2 text-slate-100 font-mono"
                >
                  {nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      v{n.id}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Target (v)</label>
                <select
                  value={simV}
                  onChange={(e) => setSimV(Number(e.target.value))}
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-2 text-slate-100 font-mono"
                >
                  {nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      v{n.id}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">
                  {simType === 'CLOSE' ? 'Weight (Ref)' : 'New Weight'}
                </label>
                <input
                  type="number"
                  min={1}
                  max={9999}
                  disabled={simType === 'CLOSE'}
                  value={simW}
                  onChange={(e) => setSimW(Number(e.target.value))}
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-2 text-slate-100 font-mono disabled:opacity-50"
                />
              </div>
            </div>

            {simType !== 'INSERT' && engineState && (
              <div className="text-xs">
                <label className="block text-slate-400 mb-1">Target Edge ID (Optional Auto-Match)</label>
                <select
                  value={simEdgeId}
                  onChange={(e) => {
                    const eid = Number(e.target.value);
                    setSimEdgeId(eid);
                    const found = engineState.edges.find((ed) => ed.id === eid);
                    if (found) {
                      setSimU(found.u);
                      setSimV(found.v);
                      setSimW(found.weight);
                    }
                  }}
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-2 text-slate-200 font-mono"
                >
                  {engineState.edges.map((ed) => (
                    <option key={ed.id} value={ed.id}>
                      e#{ed.id}: v{ed.u} → v{ed.v} (w={ed.weight}, {ed.live ? 'LIVE' : 'CLOSED'}
                      {ed.in_tree ? ', IN TREE' : ''})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={handleApplyDynamicEvent}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-semibold text-xs shadow-md transition"
            >
              Apply {simType} Update to C++ Engine
            </button>
          </div>

          {/* Engine Configuration & Source/Target Selection */}
          <div className="rounded-xl border border-slate-800 bg-[#0c1018] p-5 space-y-4">
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-violet-400" />
              Engine & Path Parameters
            </h2>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">SSSP Source (s)</label>
                <select
                  value={source}
                  onChange={(e) => onUpdateGraphConfig({ source: Number(e.target.value) })}
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-2 text-cyan-300 font-mono"
                >
                  {nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      v{n.id}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Highlight Path To</label>
                <select
                  value={targetVertex}
                  onChange={(e) => onUpdateGraphConfig({ targetVertex: Number(e.target.value) })}
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-2 text-emerald-300 font-mono"
                >
                  {nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      v{n.id}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Algorithm Mode</label>
                <select
                  value={mode}
                  onChange={(e) => onUpdateGraphConfig({ mode: e.target.value })}
                  className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2.5 py-2 text-slate-100 font-mono"
                >
                  <option value="B1">B1: Witness-Guarded</option>
                  <option value="B0">B0: Full Dijkstra</option>
                  <option value="B2">B2: Insertion Surrogate</option>
                  <option value="A1">A1: Rebuild on INC/CLOSE</option>
                  <option value="A2">A2: No Edge Compaction</option>
                  <option value="A3">A3: Rebuild on DEC</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">
                  Invalidation Budget τ ({Math.round(budget * 100)}%)
                </label>
                <input
                  type="range"
                  min={0.05}
                  max={1.0}
                  step={0.05}
                  value={budget}
                  onChange={(e) => onUpdateGraphConfig({ budget: Number(e.target.value) })}
                  className="w-full accent-cyan-400 mt-2"
                />
              </div>
            </div>

            {/* Add Base Initial Edge */}
            <div className="pt-3 border-t border-slate-800 space-y-2.5 text-xs">
              <div className="text-slate-400 font-medium">Add Base Directed Edge to Graph</div>
              <div className="grid grid-cols-3 gap-2">
                <select
                  value={edgeU}
                  onChange={(e) => setEdgeU(Number(e.target.value))}
                  className="rounded bg-slate-900 border border-slate-700 px-2 py-1.5 font-mono"
                >
                  {nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      v{n.id}
                    </option>
                  ))}
                </select>
                <select
                  value={edgeV}
                  onChange={(e) => setEdgeV(Number(e.target.value))}
                  className="rounded bg-slate-900 border border-slate-700 px-2 py-1.5 font-mono"
                >
                  {nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      v{n.id}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  value={edgeW}
                  onChange={(e) => setEdgeW(Number(e.target.value))}
                  className="rounded bg-slate-900 border border-slate-700 px-2 py-1.5 font-mono"
                />
              </div>
              <button
                type="button"
                onClick={handleAddOrUpdateInitialEdge}
                className="w-full py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition"
              >
                + Add Base Edge (v{edgeU} → v{edgeV}, w={edgeW})
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Event Execution Timeline Table */}
      <div className="rounded-xl border border-slate-800 bg-[#0c1018] overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-100">Dynamic Update Event Execution Timeline</h2>
            <p className="text-xs text-slate-400">
              Detailed per-event diagnostic telemetry returned by the C++17 Witness-Guarded Engine.
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 font-mono">
                <th className="py-2.5 px-4">#</th>
                <th className="py-2.5 px-4">Event</th>
                <th className="py-2.5 px-4">Directed Edge</th>
                <th className="py-2.5 px-4">Prev → New State</th>
                <th className="py-2.5 px-4">In Tree T?</th>
                <th className="py-2.5 px-4">Witness Intact?</th>
                <th className="py-2.5 px-4">Affected |S|</th>
                <th className="py-2.5 px-4">Recomputed</th>
                <th className="py-2.5 px-4">Rebuild?</th>
                <th className="py-2.5 px-4">Latency (µs)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {engineState && engineState.event_results.length > 0 ? (
                engineState.event_results.map((er) => (
                  <tr key={er.event_id} className="hover:bg-slate-900/40">
                    <td className="py-2.5 px-4 text-slate-400">#{er.event_id}</td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded font-semibold ${
                          er.event_type === 'CLOSE'
                            ? 'bg-rose-500/15 text-rose-300'
                            : er.event_type === 'INCREASE'
                            ? 'bg-amber-500/15 text-amber-300'
                            : er.event_type === 'DECREASE' || er.event_type === 'INSERT'
                            ? 'bg-cyan-500/15 text-cyan-300'
                            : 'bg-emerald-500/15 text-emerald-300'
                        }`}
                      >
                        {er.event_type}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-200">
                      e#{er.edge_id} (v{er.u} → v{er.v})
                    </td>
                    <td className="py-2.5 px-4 text-slate-300">
                      {er.prev_weight < 0 ? 'NIL' : `w=${er.prev_weight} (${er.prev_live ? 'LIVE' : 'CLOSED'})`} →{' '}
                      {`w=${er.new_weight} (${er.new_live ? 'LIVE' : 'CLOSED'})`}
                    </td>
                    <td className="py-2.5 px-4">
                      {er.was_in_tree ? (
                        <span className="text-cyan-300 font-semibold">YES (∈ T)</span>
                      ) : (
                        <span className="text-slate-400">NO (∉ T)</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4">
                      {er.witness_paths_valid ? (
                        <span className="text-emerald-300">VALID (Preserved)</span>
                      ) : (
                        <span className="text-rose-300 font-semibold">BROKEN SUBTREE</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-violet-300">{er.affected_subtree_size}</td>
                    <td className="py-2.5 px-4 text-cyan-300">{er.recomputed_vertices}</td>
                    <td className="py-2.5 px-4">
                      {er.rebuild_triggered ? (
                        <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300">FULL REBUILD</span>
                      ) : (
                        <span className="text-slate-500">Local</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-slate-200">{er.execution_time_us.toFixed(2)} µs</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="py-6 text-center text-slate-500">
                    No events active in timeline. Click &quot;Step Forward&quot; or &quot;Apply Update&quot;.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

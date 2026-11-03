import React, { useEffect, useState, useCallback } from 'react';
import {
  Activity,
  BarChart3,
  BookOpen,
  Cpu,
  GitBranch,
  Home,
  Layers,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import {
  BenchmarkResponse,
  EngineSessionState,
  GraphNode,
  InitialEdge,
  UpdateEventSpec,
  VerificationSuiteResponse,
} from './types/pathforge';
import {
  evaluateWorkspaceSession,
  executeBenchmark,
  fetchDefaultWorkspace,
  fetchVerificationSuites,
} from './services/api';
import { LandingPage } from './pages/LandingPage';
import { DashboardPage } from './pages/DashboardPage';
import { WorkspaceSimulatorPage } from './pages/WorkspaceSimulatorPage';
import { VisualizerPage } from './pages/VisualizerPage';
import { BenchmarkAnalyticsPage } from './pages/BenchmarkAnalyticsPage';
import { VerificationMethodologyPage } from './pages/VerificationMethodologyPage';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('landing');

  // Workspace & Simulator State
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [initialEdges, setInitialEdges] = useState<InitialEdge[]>([]);
  const [events, setEvents] = useState<UpdateEventSpec[]>([]);
  const [activeEventCount, setActiveEventCount] = useState<number>(0);
  const [source, setSource] = useState<number>(0);
  const [targetVertex, setTargetVertex] = useState<number>(9);
  const [budget, setBudget] = useState<number>(0.35);
  const [mode, setMode] = useState<string>('B1');

  // Live Engine & Benchmark Outputs
  const [engineState, setEngineState] = useState<EngineSessionState | null>(null);
  const [verification, setVerification] = useState<VerificationSuiteResponse | null>(null);
  const [benchmark, setBenchmark] = useState<BenchmarkResponse | null>(null);
  const [isBenchmarkRunning, setIsBenchmarkRunning] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadInitialData = useCallback(async () => {
    try {
      setErrorMsg(null);
      const ws = await fetchDefaultWorkspace();
      setNodes(ws.preset.nodes);
      setInitialEdges(ws.preset.initial_edges);
      setEvents(ws.preset.events);
      setActiveEventCount(ws.preset.events.length);
      setSource(ws.preset.source);
      setTargetVertex(ws.preset.target_vertex);
      setBudget(ws.preset.invalidation_budget);
      setMode(ws.preset.mode);
      setEngineState(ws.engine_state);

      const ver = await fetchVerificationSuites();
      setVerification(ver);

      const bench = await executeBenchmark({
        family: 'SPARSE_RANDOM',
        sequence: 'MIXED_REALISTIC',
        vertices: 300,
        edges: 1200,
        events: 100,
        closure_rate: 0.05,
        seed: 42,
        source: 0,
        invalidation_budget: 0.35,
        repetitions: 1,
      });
      setBenchmark(bench);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to connect to PathForge backend API');
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const handleUpdateGraphConfig = async (next: {
    nodes?: GraphNode[];
    initialEdges?: InitialEdge[];
    events?: UpdateEventSpec[];
    activeEventCount?: number;
    source?: number;
    targetVertex?: number;
    budget?: number;
    mode?: string;
  }) => {
    const nextNodes = next.nodes ?? nodes;
    const nextEdges = next.initialEdges ?? initialEdges;
    const nextEvents = next.events ?? events;
    const nextCount = next.activeEventCount ?? activeEventCount;
    const nextSource = next.source ?? source;
    const nextTarget = next.targetVertex ?? targetVertex;
    const nextBudget = next.budget ?? budget;
    const nextMode = next.mode ?? mode;

    setNodes(nextNodes);
    setInitialEdges(nextEdges);
    setEvents(nextEvents);
    setActiveEventCount(nextCount);
    setSource(nextSource);
    setTargetVertex(nextTarget);
    setBudget(nextBudget);
    setMode(nextMode);

    try {
      setErrorMsg(null);
      const maxId = nextNodes.length > 0 ? Math.max(...nextNodes.map((n) => n.id)) + 1 : 10;
      const evaluated = await evaluateWorkspaceSession({
        num_vertices: maxId,
        source: nextSource,
        target_vertex: nextTarget,
        invalidation_budget: nextBudget,
        mode: nextMode,
        nodes: nextNodes,
        initial_edges: nextEdges,
        events: nextEvents.slice(0, nextCount),
      });
      setEngineState(evaluated);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Engine evaluation error');
    }
  };

  const handleRunBenchmark = async (params: {
    family: string;
    sequence: string;
    vertices: number;
    edges: number;
    events: number;
    closure_rate: number;
    seed: number;
    source: number;
    invalidation_budget: number;
    repetitions: number;
  }) => {
    try {
      setIsBenchmarkRunning(true);
      setErrorMsg(null);
      const res = await executeBenchmark(params);
      setBenchmark(res);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Benchmark execution error');
    } finally {
      setIsBenchmarkRunning(false);
    }
  };

  const handleRerunVerification = async () => {
    try {
      setIsVerifying(true);
      setErrorMsg(null);
      const res = await fetchVerificationSuites();
      setVerification(res);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Verification error');
    } finally {
      setIsVerifying(false);
    }
  };

  const navItems = [
    { id: 'landing', label: 'Overview', icon: Home },
    { id: 'dashboard', label: 'Dashboard', icon: Activity },
    { id: 'workspace', label: 'Workspace & Simulator', icon: GitBranch },
    { id: 'visualizer', label: 'Algorithm Visualizer', icon: Layers },
    { id: 'benchmark', label: 'Benchmark & Analytics', icon: BarChart3 },
    { id: 'methodology', label: 'Verification & Proofs', icon: ShieldCheck },
  ];

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-[#07090e]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div
            onClick={() => setActiveTab('landing')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center shadow-md shadow-cyan-500/20">
              <Cpu className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <div className="text-base font-bold tracking-tight text-slate-100 flex items-center gap-2">
                PathForge
                <span className="px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 font-mono text-[10px]">
                  C++17
                </span>
              </div>
              <div className="text-[11px] text-slate-400 hidden sm:block">
                Witness-Guarded Dynamic SSSP Research Platform
              </div>
            </div>
          </div>

          <nav className="flex items-center gap-1 overflow-x-auto py-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id || (activeTab === 'analytics' && item.id === 'benchmark');
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                    active
                      ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-8">
        {errorMsg && (
          <div className="mb-6 rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 flex items-center justify-between text-xs text-rose-200">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={loadInitialData}
              className="px-3 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-100 font-medium"
            >
              Retry Connection
            </button>
          </div>
        )}

        {activeTab === 'landing' && (
          <LandingPage
            engineState={engineState}
            nodes={nodes}
            onNavigate={(tab) => setActiveTab(tab === 'analytics' ? 'benchmark' : tab)}
          />
        )}

        {activeTab === 'dashboard' && (
          <DashboardPage
            engineState={engineState}
            latestBenchmark={benchmark}
            onNavigate={(tab) => setActiveTab(tab === 'analytics' ? 'benchmark' : tab)}
          />
        )}

        {activeTab === 'workspace' && (
          <WorkspaceSimulatorPage
            nodes={nodes}
            initialEdges={initialEdges}
            events={events}
            activeEventCount={activeEventCount}
            source={source}
            targetVertex={targetVertex}
            budget={budget}
            mode={mode}
            engineState={engineState}
            onUpdateGraphConfig={handleUpdateGraphConfig}
            onResetDefault={loadInitialData}
          />
        )}

        {activeTab === 'visualizer' && <VisualizerPage engineState={engineState} nodes={nodes} />}

        {(activeTab === 'benchmark' || activeTab === 'analytics') && (
          <BenchmarkAnalyticsPage
            benchmark={benchmark}
            isRunning={isBenchmarkRunning}
            onRunBenchmark={handleRunBenchmark}
          />
        )}

        {activeTab === 'methodology' && (
          <VerificationMethodologyPage
            verification={verification}
            onRerunVerification={handleRerunVerification}
            isVerifying={isVerifying}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-[#07090e] py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
            <span>
              PathForge: A Witness-Guarded Dynamic Shortest Path Maintenance System · Reference: Yang P. Liu,{' '}
              <em>arXiv:2506.19207v1</em>
            </span>
          </div>
          <div className="font-mono">
            C++17 Engine · Exact Dijkstra Oracle Verified · Research Integrity Compliant
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;

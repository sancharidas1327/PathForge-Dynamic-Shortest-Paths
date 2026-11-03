import {
  BenchmarkResponse,
  EngineSessionState,
  GraphNode,
  InitialEdge,
  UpdateEventSpec,
  VerificationSuiteResponse,
} from '../types/pathforge';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export async function fetchHealth(): Promise<{ status: string; cpp_engine_ready: boolean; platform: string }> {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.json();
}

export async function fetchDefaultWorkspace(): Promise<{
  preset: {
    num_vertices: number;
    source: number;
    target_vertex: number;
    invalidation_budget: number;
    mode: string;
    nodes: GraphNode[];
    initial_edges: InitialEdge[];
    events: UpdateEventSpec[];
  };
  engine_state: EngineSessionState;
}> {
  const res = await fetch(`${API_BASE}/api/workspace/default`);
  if (!res.ok) throw new Error(`Failed to load default workspace: ${res.status}`);
  return res.json();
}

export async function evaluateWorkspaceSession(payload: {
  num_vertices: number;
  source: number;
  target_vertex: number;
  invalidation_budget: number;
  mode: string;
  nodes?: GraphNode[];
  initial_edges: InitialEdge[];
  events: UpdateEventSpec[];
}): Promise<EngineSessionState> {
  const res = await fetch(`${API_BASE}/api/workspace/evaluate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Evaluation error' }));
    throw new Error(err.error || `Session evaluation failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchVerificationSuites(): Promise<VerificationSuiteResponse> {
  const res = await fetch(`${API_BASE}/api/verify`);
  if (!res.ok) throw new Error(`Verification suite failed: ${res.status}`);
  return res.json();
}

export async function executeBenchmark(params: {
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
}): Promise<BenchmarkResponse> {
  const res = await fetch(`${API_BASE}/api/benchmark/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Benchmark failed' }));
    throw new Error(err.error || `Benchmark failed: ${res.status}`);
  }
  return res.json();
}

export function getBenchmarkExportUrl(format: 'json' | 'csv'): string {
  return `${API_BASE}/api/benchmark/export?format=${format}`;
}

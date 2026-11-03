export interface GraphNode {
  id: number;
  label: string;
  x: number;
  y: number;
}

export interface InitialEdge {
  id: number;
  u: number;
  v: number;
  weight: number;
  live: boolean;
}

export type EventTypeStr = 'INSERT' | 'DECREASE' | 'INCREASE' | 'CLOSE' | 'REOPEN';

export interface UpdateEventSpec {
  event_id: number;
  type: EventTypeStr;
  edge_id: number;
  u: number;
  v: number;
  new_weight: number;
}

export interface EngineEdgeState {
  id: number;
  u: number;
  v: number;
  weight: number;
  live: boolean;
  in_tree: boolean;
  version: number;
  parent_edge_id: number;
}

export interface EventExecutionResult {
  event_id: number;
  event_type: EventTypeStr;
  edge_id: number;
  u: number;
  v: number;
  prev_weight: number;
  new_weight: number;
  prev_live: boolean;
  new_live: boolean;
  was_in_tree: boolean;
  witness_paths_valid: boolean;
  affected_subtree_size: number;
  recomputed_vertices: number;
  rebuild_triggered: boolean;
  unsupported_op: boolean;
  execution_time_us: number;
  affected_vertices: number[];
  recomputed_vertices_list: number[];
}

export interface AlgorithmStepTrace {
  step_number: number;
  title: string;
  pseudocode: string;
  explanation: string;
  metric_affected_count: number;
  metric_recomputed_count: number;
  highlighted_vertices: number[];
  highlighted_edges: number[];
}

export interface CorrectnessReport {
  passed: boolean;
  reachable_mismatches: number;
  unreachable_mismatches: number;
  invalid_paths: number;
  closed_edge_in_path_violations: number;
  path_length_mismatches: number;
  error_details: string;
}

export interface EngineSessionState {
  num_vertices: number;
  num_edges: number;
  num_live_edges: number;
  source: number;
  invalidation_budget: number;
  mode: string;
  init_time_us: number;
  total_exec_time_us: number;
  total_events: number;
  total_invalidated_vertices: number;
  total_recomputed_vertices: number;
  total_rebuilds: number;
  peak_memory_kb: number;
  correctness: CorrectnessReport;
  distances: number[];
  parent_edges: number[];
  tin: number[];
  tout: number[];
  selected_path_edges: number[];
  edges: EngineEdgeState[];
  event_results: EventExecutionResult[];
  last_step_traces: AlgorithmStepTrace[];
  nodes?: GraphNode[];
}

export interface VerificationSuiteItem {
  name: string;
  category: string;
  events_tested: number;
  passed: boolean;
  execution_time_us: number;
  message: string;
}

export interface VerificationSuiteResponse {
  all_passed: boolean;
  passed_suites: number;
  total_suites: number;
  total_oracle_checks: number;
  suites: VerificationSuiteItem[];
}

export interface BenchmarkModeMetrics {
  code: string;
  label: string;
  total_time_us: number;
  avg_latency_us: number;
  p99_latency_us: number;
  max_latency_us: number;
  rebuilds: number;
  invalidated_vertices: number;
  recomputed_vertices: number;
  recursive_repairs: number;
  live_edges: number;
  total_edges_allocated: number;
  unsupported_events: number;
  correctness_violations: number;
  peak_memory_kb: number;
  latencies_us: number[];
}

export interface BenchmarkResponse {
  config: {
    family: string;
    sequence: string;
    vertices: number;
    initial_edges: number;
    events: number;
    closure_rate: number;
    seed: number;
    source: number;
    invalidation_budget: number;
    repetitions: number;
  };
  summary: {
    b0_total_time_us: number;
    b1_total_time_us: number;
    speedup_b1_vs_b0: number;
    percentage_improvement: number;
  };
  modes: BenchmarkModeMetrics[];
  size_sweep: Array<{
    vertices: number;
    edges: number;
    b0_time_us: number;
    b1_time_us: number;
    speedup: number;
  }>;
  closure_sweep: Array<{
    closure_rate: number;
    b0_time_us: number;
    b1_time_us: number;
    b1_rebuilds: number;
    b1_invalidated: number;
  }>;
  metadata?: {
    run_id: string;
    timestamp: string;
    algorithm_version: string;
    hardware_env: string;
    compiler?: string;
  };
}

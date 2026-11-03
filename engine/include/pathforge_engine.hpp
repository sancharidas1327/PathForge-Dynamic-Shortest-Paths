#pragma once

#include <vector>
#include <queue>
#include <limits>
#include <cstdint>
#include <string>
#include <algorithm>
#include <chrono>
#include <cmath>
#include <sstream>
#include <iomanip>
#include <stdexcept>
#include <unordered_set>

namespace pathforge {

constexpr int64_t INF = std::numeric_limits<int64_t>::max() / 4;

enum class EventType {
    INSERT,
    DECREASE,
    INCREASE,
    CLOSE,
    REOPEN
};

enum class BaselineMode {
    B0_FULL_DIJKSTRA,          // Full Dijkstra recomputation on every event
    B1_WITNESS_GUARDED,        // Proposed Witness-Guarded Dynamic Repair
    B2_INSERTION_SURROGATE,    // Insertion-only reference/surrogate (supports INS, DEC, REOPEN)
    A1_REBUILD_ON_INC_CLOSE,   // Ablation A1: Rebuild on every INC/CLOSE event
    A2_NO_COMPACTION,          // Ablation A2: Disable edge compaction on rebuild
    A3_REBUILD_ON_DEC          // Ablation A3: Handle decreases via full rebuild instead of incremental relaxation
};

struct Edge {
    int id;
    int u;
    int v;
    int64_t weight;
    bool live;
    int version;
    int parent_edge_id; // Original edge ID if created via DECREASE/REOPEN parallel insertion
};

struct UpdateEvent {
    int event_id;
    EventType type;
    int edge_id; // Target edge id (-1 for fresh INSERT, or specific edge id)
    int u;
    int v;
    int64_t new_weight;
};

struct EventResult {
    int event_id;
    std::string event_type;
    int edge_id;
    int u;
    int v;
    int64_t prev_weight;
    int64_t new_weight;
    bool prev_live;
    bool new_live;
    bool was_in_tree;
    bool witness_paths_valid;
    int affected_subtree_size;
    int recomputed_vertices;
    bool rebuild_triggered;
    bool unsupported_op;
    double execution_time_us;
    std::vector<int> affected_vertices_list;
    std::vector<int> recomputed_vertices_list;
};

struct CorrectnessReport {
    bool passed;
    int reachable_mismatches;
    int unreachable_mismatches;
    int invalid_paths;
    int closed_edge_in_path_violations;
    int path_length_mismatches;
    int tree_cycle_or_parent_violations;
    std::string error_details;
};

struct AlgorithmStepTrace {
    int step_number;
    std::string title;
    std::string pseudocode;
    std::string explanation;
    std::vector<int> highlighted_vertices;
    std::vector<int> highlighted_edges;
    int metric_affected_count;
    int metric_recomputed_count;
};

class PathForgeEngine {
public:
    PathForgeEngine(int num_vertices = 0, int source = 0, double invalidation_budget_ratio = 0.35)
        : n_(num_vertices),
          source_(source),
          invalidation_budget_ratio_(invalidation_budget_ratio),
          cumulative_invalidated_since_rebuild_(0),
          total_invalidated_vertices_(0),
          total_recomputed_vertices_(0),
          total_rebuilds_(0),
          total_events_(0),
          recursive_repair_count_(0),
          fallback_rebuilds_(0),
          total_exec_time_us_(0.0) {
        init_structures(num_vertices);
    }

    void reset(int num_vertices, int source, double invalidation_budget_ratio = 0.35) {
        n_ = num_vertices;
        source_ = source;
        invalidation_budget_ratio_ = invalidation_budget_ratio;
        edges_.clear();
        cumulative_invalidated_since_rebuild_ = 0;
        total_invalidated_vertices_ = 0;
        total_recomputed_vertices_ = 0;
        total_rebuilds_ = 0;
        total_events_ = 0;
        recursive_repair_count_ = 0;
        fallback_rebuilds_ = 0;
        total_exec_time_us_ = 0.0;
        init_structures(num_vertices);
    }

    void ensure_vertex(int v) {
        if (v < 0) return;
        if (v >= n_) {
            int old_n = n_;
            n_ = v + 1;
            adj_.resize(n_);
            rev_adj_.resize(n_);
            dist_.resize(n_, INF);
            parent_edge_.resize(n_, -1);
            tree_children_.resize(n_);
            tin_.resize(n_, 0);
            tout_.resize(n_, 0);
            in_invalidated_.resize(n_, false);
            for (int i = old_n; i < n_; ++i) {
                if (i == source_) dist_[i] = 0;
            }
        }
    }

    int add_initial_edge(int u, int v, int64_t weight, bool live = true) {
        if (u < 0 || v < 0 || weight < 0 || weight >= INF / 2) {
            throw std::invalid_argument("Invalid edge parameters (negative vertex or weight overflow).");
        }
        ensure_vertex(std::max(u, v));
        int id = static_cast<int>(edges_.size());
        edges_.push_back(Edge{id, u, v, weight, live, 1, id});
        adj_[u].push_back(id);
        rev_adj_[v].push_back(id);
        return id;
    }

    void initialize_sssp() {
        full_dijkstra_rebuild(false);
    }

    // Exact Dijkstra Oracle (independent stateless computation for verification)
    void compute_exact_oracle(std::vector<int64_t>& oracle_dist, std::vector<int>& oracle_parent) const {
        oracle_dist.assign(n_, INF);
        oracle_parent.assign(n_, -1);
        if (source_ < 0 || source_ >= n_) return;

        using PDI = std::pair<int64_t, int>;
        std::priority_queue<PDI, std::vector<PDI>, std::greater<PDI>> pq;
        oracle_dist[source_] = 0;
        pq.push({0, source_});

        while (!pq.empty()) {
            auto [d, u] = pq.top();
            pq.pop();
            if (d > oracle_dist[u]) continue;

            for (int eid : adj_[u]) {
                const Edge& e = edges_[eid];
                if (!e.live) continue;
                if (e.weight < 0) continue;
                if (oracle_dist[u] <= INF - e.weight) {
                    int64_t nd = oracle_dist[u] + e.weight;
                    if (nd < oracle_dist[e.v]) {
                        oracle_dist[e.v] = nd;
                        oracle_parent[e.v] = eid;
                        pq.push({nd, e.v});
                    }
                }
            }
        }
    }

    CorrectnessReport verify_correctness() const {
        CorrectnessReport report{true, 0, 0, 0, 0, 0, 0, ""};
        std::vector<int64_t> oracle_dist;
        std::vector<int> oracle_parent;
        compute_exact_oracle(oracle_dist, oracle_parent);

        std::ostringstream err;

        for (int v = 0; v < n_; ++v) {
            bool engine_reach = (dist_[v] < INF);
            bool oracle_reach = (oracle_dist[v] < INF);
            if (engine_reach != oracle_reach) {
                report.unreachable_mismatches++;
                report.passed = false;
                err << "Vertex " << v << " reachability mismatch (Engine=" << dist_[v]
                    << ", Oracle=" << oracle_dist[v] << "). ";
            } else if (engine_reach && dist_[v] != oracle_dist[v]) {
                report.reachable_mismatches++;
                report.passed = false;
                err << "Vertex " << v << " distance mismatch (Engine=" << dist_[v]
                    << ", Oracle=" << oracle_dist[v] << "). ";
            }

            if (v == source_) {
                if (parent_edge_[v] != -1) {
                    report.tree_cycle_or_parent_violations++;
                    report.passed = false;
                    err << "Source vertex has non-null parent edge. ";
                }
                continue;
            }

            if (engine_reach) {
                // Trace witness path back to source_
                int curr = v;
                int steps = 0;
                int64_t sum_w = 0;
                while (curr != source_ && steps <= n_) {
                    int pe = parent_edge_[curr];
                    if (pe < 0 || pe >= static_cast<int>(edges_.size())) {
                        report.invalid_paths++;
                        report.passed = false;
                        err << "Vertex " << v << " has broken parent_edge at " << curr << ". ";
                        break;
                    }
                    const Edge& edge = edges_[pe];
                    if (!edge.live) {
                        report.closed_edge_in_path_violations++;
                        report.passed = false;
                        err << "Vertex " << v << " witness path uses closed edge " << pe << ". ";
                    }
                    if (edge.v != curr) {
                        report.tree_cycle_or_parent_violations++;
                        report.passed = false;
                        err << "Parent edge endpoint mismatch at " << curr << ". ";
                        break;
                    }
                    sum_w += edge.weight;
                    curr = edge.u;
                    steps++;
                }
                if (curr != source_) {
                    report.tree_cycle_or_parent_violations++;
                    report.passed = false;
                    err << "Cycle or disconnected witness path from " << v << ". ";
                } else if (sum_w != dist_[v]) {
                    report.path_length_mismatches++;
                    report.passed = false;
                    err << "Witness path sum (" << sum_w << ") != dist[" << v << "] (" << dist_[v] << "). ";
                }
            } else {
                if (parent_edge_[v] != -1) {
                    report.tree_cycle_or_parent_violations++;
                    report.passed = false;
                    err << "Unreachable vertex " << v << " still has parent_edge " << parent_edge_[v] << ". ";
                }
            }
        }

        report.error_details = err.str();
        return report;
    }

    EventResult apply_update(const UpdateEvent& ev, BaselineMode mode = BaselineMode::B1_WITNESS_GUARDED, std::vector<AlgorithmStepTrace>* step_traces = nullptr) {
        auto t_start = std::chrono::high_resolution_clock::now();
        total_events_++;

        EventResult res{};
        res.event_id = ev.event_id;
        res.event_type = event_type_to_string(ev.type);
        res.edge_id = ev.edge_id;
        res.u = ev.u;
        res.v = ev.v;
        res.prev_weight = -1;
        res.new_weight = ev.new_weight;
        res.prev_live = false;
        res.new_live = true;
        res.was_in_tree = false;
        res.witness_paths_valid = true;
        res.affected_subtree_size = 0;
        res.recomputed_vertices = 0;
        res.rebuild_triggered = false;
        res.unsupported_op = false;

        if (step_traces) {
            step_traces->clear();
            step_traces->push_back({1, "Receive Graph Update Event",
                "procedure PROCESS_EVENT(G, T, event):\n  extract (type, e=(u,v), w_new) <- event",
                "Received " + res.event_type + " on directed edge (" + std::to_string(ev.u) + " -> " + std::to_string(ev.v) + ").",
                {ev.u, ev.v}, {ev.edge_id}, 0, 0});
        }

        // Check B2 unsupported operations
        if (mode == BaselineMode::B2_INSERTION_SURROGATE &&
            (ev.type == EventType::INCREASE || ev.type == EventType::CLOSE)) {
            res.unsupported_op = true;
            auto t_end = std::chrono::high_resolution_clock::now();
            res.execution_time_us = std::chrono::duration<double, std::micro>(t_end - t_start).count();
            total_exec_time_us_ += res.execution_time_us;
            return res;
        }

        // Resolve target edge if edge_id is not explicitly passed or needs lookup
        int target_eid = ev.edge_id;
        if (ev.type != EventType::INSERT) {
            if (target_eid < 0 || target_eid >= static_cast<int>(edges_.size())) {
                target_eid = find_active_edge(ev.u, ev.v, ev.type == EventType::REOPEN);
            }
        }

        // Handle B0 Full Dijkstra baseline immediately after mutating the graph
        if (mode == BaselineMode::B0_FULL_DIJKSTRA) {
            mutate_edge_for_baseline(ev, target_eid, res);
            full_dijkstra_rebuild(false);
            res.rebuild_triggered = true;
            res.recomputed_vertices = n_;
            auto t_end = std::chrono::high_resolution_clock::now();
            res.execution_time_us = std::chrono::duration<double, std::micro>(t_end - t_start).count();
            total_exec_time_us_ += res.execution_time_us;
            return res;
        }

        // Handle B1, B2, and Ablations A1, A2, A3
        if (ev.type == EventType::INSERT) {
            ensure_vertex(std::max(ev.u, ev.v));
            int new_eid = add_initial_edge(ev.u, ev.v, ev.new_weight, true);
            res.edge_id = new_eid;
            res.prev_weight = -1;
            res.prev_live = false;
            res.new_live = true;
            res.was_in_tree = false;

            incremental_relax_from_edge(new_eid, res, step_traces);
        }
        else if (ev.type == EventType::DECREASE) {
            if (target_eid < 0 || target_eid >= static_cast<int>(edges_.size())) {
                throw std::invalid_argument("Target edge for DECREASE not found.");
            }
            Edge old_e = edges_[target_eid];
            res.u = old_e.u;
            res.v = old_e.v;
            res.prev_weight = old_e.weight;
            res.prev_live = old_e.live;
            res.new_live = true;
            res.was_in_tree = (parent_edge_[old_e.v] == target_eid);

            int64_t actual_new_w = (ev.new_weight >= 0 && ev.new_weight < old_e.weight)
                                   ? ev.new_weight
                                   : std::max<int64_t>(1, old_e.weight / 2);
            res.new_weight = actual_new_w;

            // Represent DECREASE as insertion of a parallel edge retaining previous edge version
            int new_eid = static_cast<int>(edges_.size());
            edges_.push_back(Edge{new_eid, old_e.u, old_e.v, actual_new_w, true, old_e.version + 1, old_e.parent_edge_id});
            adj_[old_e.u].push_back(new_eid);
            rev_adj_[old_e.v].push_back(new_eid);
            res.edge_id = new_eid;

            if (mode == BaselineMode::A3_REBUILD_ON_DEC) {
                full_dijkstra_rebuild(true);
                res.rebuild_triggered = true;
                res.recomputed_vertices = n_;
            } else {
                incremental_relax_from_edge(new_eid, res, step_traces);
            }
        }
        else if (ev.type == EventType::REOPEN) {
            if (target_eid < 0 || target_eid >= static_cast<int>(edges_.size())) {
                // If no closed edge found, insert as new edge
                int new_eid = add_initial_edge(ev.u, ev.v, std::max<int64_t>(1, ev.new_weight), true);
                res.edge_id = new_eid;
                incremental_relax_from_edge(new_eid, res, step_traces);
            } else {
                Edge& target_e = edges_[target_eid];
                res.u = target_e.u;
                res.v = target_e.v;
                res.prev_weight = target_e.weight;
                res.prev_live = target_e.live;
                res.new_live = true;
                int64_t reopen_w = (ev.new_weight > 0) ? ev.new_weight : target_e.weight;
                res.new_weight = reopen_w;

                // Restore connectivity via insertion-type event
                target_e.live = true;
                target_e.weight = reopen_w;
                target_e.version++;
                res.edge_id = target_eid;
                incremental_relax_from_edge(target_eid, res, step_traces);
            }
        }
        else if (ev.type == EventType::INCREASE || ev.type == EventType::CLOSE) {
            if (target_eid < 0 || target_eid >= static_cast<int>(edges_.size())) {
                throw std::invalid_argument("Target edge for INCREASE/CLOSE not found.");
            }
            Edge& e = edges_[target_eid];
            res.edge_id = target_eid;
            res.u = e.u;
            res.v = e.v;
            res.prev_weight = e.weight;
            res.prev_live = e.live;

            bool is_tree_edge = (e.live && parent_edge_[e.v] == target_eid);
            res.was_in_tree = is_tree_edge;

            if (ev.type == EventType::CLOSE) {
                e.live = false;
                res.new_live = false;
                res.new_weight = e.weight;
            } else {
                int64_t inc_w = (ev.new_weight > e.weight) ? ev.new_weight : (e.weight + std::max<int64_t>(1, e.weight / 2));
                e.weight = inc_w;
                res.new_live = e.live;
                res.new_weight = inc_w;
            }
            e.version++;

            if (step_traces) {
                step_traces->push_back({2, "Check Witness-Path Membership in T",
                    "if e == parent_edge[v] in T:\n  status <- TREE_EDGE_BROKEN\nelse:\n  status <- WITNESS_INTACT",
                    is_tree_edge
                        ? "Edge e=(" + std::to_string(e.u) + "->" + std::to_string(e.v) + ") belongs to shortest-path tree T. Witness paths through Subtree(T, " + std::to_string(e.v) + ") are invalidated."
                        : "Edge e=(" + std::to_string(e.u) + "->" + std::to_string(e.v) + ") is NOT in T. All current witness paths remain valid; O(1) witness-guarded skip!",
                    {e.u, e.v}, {target_eid}, 0, 0});
            }

            if (mode == BaselineMode::A1_REBUILD_ON_INC_CLOSE) {
                full_dijkstra_rebuild(true);
                res.rebuild_triggered = true;
                res.recomputed_vertices = n_;
            } else if (!is_tree_edge) {
                // Witness-guarded skip! Non-tree edge increase or closure leaves witness paths intact.
                res.witness_paths_valid = true;
                res.affected_subtree_size = 0;
                res.recomputed_vertices = 0;
                res.rebuild_triggered = false;
            } else {
                // Tree edge increased or closed -> Invalidate Subtree(T, v) and repair
                res.witness_paths_valid = false;
                repair_affected_subtree(e.v, mode, res, step_traces);
            }
        }

        auto t_end = std::chrono::high_resolution_clock::now();
        res.execution_time_us = std::chrono::duration<double, std::micro>(t_end - t_start).count();
        total_exec_time_us_ += res.execution_time_us;
        return res;
    }

    // Accessors
    int num_vertices() const { return n_; }
    int num_edges() const { return static_cast<int>(edges_.size()); }
    int num_live_edges() const {
        int c = 0;
        for (const auto& e : edges_) if (e.live) c++;
        return c;
    }
    int source() const { return source_; }
    double invalidation_budget_ratio() const { return invalidation_budget_ratio_; }
    void set_invalidation_budget_ratio(double r) { invalidation_budget_ratio_ = std::clamp(r, 0.01, 1.0); }

    const std::vector<Edge>& edges() const { return edges_; }
    const std::vector<int64_t>& distances() const { return dist_; }
    const std::vector<int>& parent_edges() const { return parent_edge_; }
    const std::vector<int>& tin() const { return tin_; }
    const std::vector<int>& tout() const { return tout_; }

    int64_t total_invalidated_vertices() const { return total_invalidated_vertices_; }
    int64_t total_recomputed_vertices() const { return total_recomputed_vertices_; }
    int total_rebuilds() const { return total_rebuilds_; }
    int total_events() const { return total_events_; }
    int recursive_repair_count() const { return recursive_repair_count_; }
    double total_exec_time_us() const { return total_exec_time_us_; }

    std::vector<int> get_shortest_path_edges(int target) const {
        std::vector<int> path;
        if (target < 0 || target >= n_ || dist_[target] >= INF) return path;
        int curr = target;
        int safety = 0;
        while (curr != source_ && safety <= n_) {
            int pe = parent_edge_[curr];
            if (pe < 0) break;
            path.push_back(pe);
            curr = edges_[pe].u;
            safety++;
        }
        std::reverse(path.begin(), path.end());
        return path;
    }

    static std::string event_type_to_string(EventType t) {
        switch (t) {
            case EventType::INSERT: return "INSERT";
            case EventType::DECREASE: return "DECREASE";
            case EventType::INCREASE: return "INCREASE";
            case EventType::CLOSE: return "CLOSE";
            case EventType::REOPEN: return "REOPEN";
        }
        return "UNKNOWN";
    }

private:
    int n_;
    int source_;
    double invalidation_budget_ratio_;

    std::vector<Edge> edges_;
    std::vector<std::vector<int>> adj_;
    std::vector<std::vector<int>> rev_adj_;

    std::vector<int64_t> dist_;
    std::vector<int> parent_edge_;
    std::vector<std::vector<int>> tree_children_;
    std::vector<int> tin_;
    std::vector<int> tout_;
    std::vector<bool> in_invalidated_;

    int64_t cumulative_invalidated_since_rebuild_;
    int64_t total_invalidated_vertices_;
    int64_t total_recomputed_vertices_;
    int total_rebuilds_;
    int total_events_;
    int recursive_repair_count_;
    int fallback_rebuilds_;
    double total_exec_time_us_;

    void init_structures(int num_v) {
        adj_.assign(num_v, {});
        rev_adj_.assign(num_v, {});
        dist_.assign(num_v, INF);
        parent_edge_.assign(num_v, -1);
        tree_children_.assign(num_v, {});
        tin_.assign(num_v, 0);
        tout_.assign(num_v, 0);
        in_invalidated_.assign(num_v, false);
        if (source_ >= 0 && source_ < num_v) {
            dist_[source_] = 0;
        }
    }

    int find_active_edge(int u, int v, bool want_closed) const {
        if (u < 0 || u >= n_) return -1;
        int best_id = -1;
        int64_t best_w = INF;
        for (int eid : adj_[u]) {
            const Edge& e = edges_[eid];
            if (e.v == v) {
                if (want_closed && !e.live) {
                    return eid;
                }
                if (!want_closed && e.live) {
                    if (e.weight < best_w) {
                        best_w = e.weight;
                        best_id = eid;
                    }
                }
            }
        }
        if (best_id == -1 && !adj_[u].empty()) {
            for (int eid : adj_[u]) {
                if (edges_[eid].v == v) return eid;
            }
        }
        return best_id;
    }

    void rebuild_tree_structure() {
        for (int i = 0; i < n_; ++i) {
            tree_children_[i].clear();
            tin_[i] = 0;
            tout_[i] = 0;
        }
        for (int v = 0; v < n_; ++v) {
            if (v != source_ && parent_edge_[v] != -1) {
                int p = edges_[parent_edge_[v]].u;
                if (p >= 0 && p < n_) {
                    tree_children_[p].push_back(v);
                }
            }
        }
        // Compute Euler tour intervals [tin, tout] iteratively to prevent stack overflow on deep paths
        if (source_ >= 0 && source_ < n_) {
            int timer = 1;
            struct Frame { int u; size_t child_idx; };
            std::vector<Frame> st;
            st.reserve(n_);
            st.push_back({source_, 0});
            tin_[source_] = timer++;

            while (!st.empty()) {
                Frame& top = st.back();
                int u = top.u;
                if (top.child_idx < tree_children_[u].size()) {
                    int c = tree_children_[u][top.child_idx++];
                    tin_[c] = timer++;
                    st.push_back({c, 0});
                } else {
                    tout_[u] = timer++;
                    st.pop_back();
                }
            }
        }
    }

    void compact_parallel_edges() {
        // Deduplicate dominated parallel edges between same (u, v) during full rebuild
        for (int u = 0; u < n_; ++u) {
            auto& list = adj_[u];
            if (list.size() <= 1) continue;
            // Find minimum live edge per destination v
            for (size_t i = 0; i < list.size(); ++i) {
                Edge& e1 = edges_[list[i]];
                if (!e1.live) continue;
                for (size_t j = i + 1; j < list.size(); ++j) {
                    Edge& e2 = edges_[list[j]];
                    if (!e2.live || e1.v != e2.v) continue;
                    // If one is a parallel decrease version of the other, close the dominated heavier version
                    if (e1.parent_edge_id == e2.parent_edge_id) {
                        if (e1.weight <= e2.weight) {
                            e2.live = false;
                        } else {
                            e1.live = false;
                            break;
                        }
                    }
                }
            }
        }
    }

    void full_dijkstra_rebuild(bool allow_compaction) {
        total_rebuilds_++;
        cumulative_invalidated_since_rebuild_ = 0;

        if (allow_compaction) {
            compact_parallel_edges();
        }

        dist_.assign(n_, INF);
        parent_edge_.assign(n_, -1);
        if (source_ < 0 || source_ >= n_) return;

        using PDI = std::pair<int64_t, int>;
        std::priority_queue<PDI, std::vector<PDI>, std::greater<PDI>> pq;

        dist_[source_] = 0;
        pq.push({0, source_});

        while (!pq.empty()) {
            auto [d, u] = pq.top();
            pq.pop();
            if (d > dist_[u]) continue;

            for (int eid : adj_[u]) {
                const Edge& e = edges_[eid];
                if (!e.live) continue;
                if (dist_[u] <= INF - e.weight) {
                    int64_t nd = dist_[u] + e.weight;
                    if (nd < dist_[e.v]) {
                        dist_[e.v] = nd;
                        parent_edge_[e.v] = eid;
                        pq.push({nd, e.v});
                    }
                }
            }
        }

        rebuild_tree_structure();
    }

    void incremental_relax_from_edge(int eid, EventResult& res, std::vector<AlgorithmStepTrace>* step_traces) {
        const Edge& e = edges_[eid];
        res.was_in_tree = false;
        res.witness_paths_valid = true;

        if (!e.live || dist_[e.u] >= INF) {
            res.affected_subtree_size = 0;
            res.recomputed_vertices = 0;
            if (step_traces) {
                step_traces->push_back({2, "Incremental Relaxation Check",
                    "if dist[u] + w(e) >= dist[v]:\n  return NO_DISTANCE_DROP",
                    "Source endpoint u=" + std::to_string(e.u) + " is unreachable or edge cannot improve dist[" + std::to_string(e.v) + "].",
                    {e.u, e.v}, {eid}, 0, 0});
            }
            return;
        }

        int64_t cand = dist_[e.u] + e.weight;
        if (cand >= dist_[e.v]) {
            res.affected_subtree_size = 0;
            res.recomputed_vertices = 0;
            if (step_traces) {
                step_traces->push_back({2, "Incremental Relaxation Check",
                    "if dist[u] + w(e) >= dist[v]:\n  return NO_DISTANCE_DROP",
                    "Candidate distance " + std::to_string(cand) + " >= current dist[" + std::to_string(e.v) + "] = " + std::to_string(dist_[e.v]) + ". Existing witness path is already shorter or equal.",
                    {e.u, e.v}, {eid}, 0, 0});
            }
            return;
        }

        // Distance drop detected! Propagate via Dijkstra from e.v
        using PDI = std::pair<int64_t, int>;
        std::priority_queue<PDI, std::vector<PDI>, std::greater<PDI>> pq;

        dist_[e.v] = cand;
        parent_edge_[e.v] = eid;
        pq.push({cand, e.v});

        std::vector<int> updated_nodes;
        while (!pq.empty()) {
            auto [d, u] = pq.top();
            pq.pop();
            if (d > dist_[u]) continue;
            updated_nodes.push_back(u);

            for (int out_eid : adj_[u]) {
                const Edge& out_e = edges_[out_eid];
                if (!out_e.live) continue;
                if (dist_[u] <= INF - out_e.weight) {
                    int64_t nd = dist_[u] + out_e.weight;
                    if (nd < dist_[out_e.v]) {
                        dist_[out_e.v] = nd;
                        parent_edge_[out_e.v] = out_eid;
                        pq.push({nd, out_e.v});
                    }
                }
            }
        }

        rebuild_tree_structure();
        res.affected_subtree_size = static_cast<int>(updated_nodes.size());
        res.recomputed_vertices = static_cast<int>(updated_nodes.size());
        res.affected_vertices_list = updated_nodes;
        res.recomputed_vertices_list = updated_nodes;
        total_recomputed_vertices_ += updated_nodes.size();

        if (step_traces) {
            step_traces->push_back({2, "Incremental Distance-Drop Relaxation",
                "dist[v] <- dist[u] + w(e)\nPQ.push((dist[v], v))\nwhile PQ not empty:\n  relax outgoing live edges",
                "Propagated shorter witness paths to " + std::to_string(updated_nodes.size()) + " vertices starting from v=" + std::to_string(e.v) + ".",
                updated_nodes, {eid}, static_cast<int>(updated_nodes.size()), static_cast<int>(updated_nodes.size())});
        }
    }

    void repair_affected_subtree(int subtree_root, BaselineMode mode, EventResult& res, std::vector<AlgorithmStepTrace>* step_traces) {
        recursive_repair_count_++;

        // 1. Collect affected subtree S = Subtree(T, subtree_root)
        std::vector<int> affected;
        std::vector<int> q;
        q.push_back(subtree_root);
        in_invalidated_[subtree_root] = true;

        size_t head = 0;
        while (head < q.size()) {
            int u = q[head++];
            affected.push_back(u);
            for (int c : tree_children_[u]) {
                if (!in_invalidated_[c]) {
                    in_invalidated_[c] = true;
                    q.push_back(c);
                }
            }
        }

        int k = static_cast<int>(affected.size());
        res.affected_subtree_size = k;
        res.affected_vertices_list = affected;
        total_invalidated_vertices_ += k;
        cumulative_invalidated_since_rebuild_ += k;

        if (step_traces) {
            step_traces->push_back({3, "Identify & Invalidate Affected Subtree(T, e)",
                "S <- Subtree(T, v) using Euler-tour / tree children\nfor each x in S:\n  dist[x] <- +INF, parent_edge[x] <- NIL",
                "Invalidated " + std::to_string(k) + " vertices in Subtree(T, " + std::to_string(subtree_root) + "). Unaffected vertices outside S keep their exact witness distances.",
                affected, {}, k, 0});
        }

        // 2. Check invalidation budget policy
        int64_t budget_limit = std::max<int64_t>(1, static_cast<int64_t>(std::ceil(invalidation_budget_ratio_ * n_)));
        if (cumulative_invalidated_since_rebuild_ > budget_limit) {
            for (int u : affected) in_invalidated_[u] = false;
            bool allow_compact = (mode != BaselineMode::A2_NO_COMPACTION);
            full_dijkstra_rebuild(allow_compact);
            res.rebuild_triggered = true;
            res.recomputed_vertices = n_;
            total_recomputed_vertices_ += n_;

            if (step_traces) {
                step_traces->push_back({4, "Budget Threshold Exceeded -> Full Rebuild & Compaction",
                    "if cumulative_invalidated > tau * |V|:\n  COMPACT_PARALLEL_EDGES()\n  FULL_DIJKSTRA_REBUILD()",
                    "Cumulative invalidated vertices exceeded budget threshold (" + std::to_string(budget_limit) + "). Triggered full rebuild and tree re-indexing.",
                    affected, {}, k, n_});
            }
            return;
        }

        // 3. Reset distances in affected subtree S
        for (int u : affected) {
            dist_[u] = INF;
            parent_edge_[u] = -1;
        }

        // 4. Seed priority queue using live boundary edges (x -> y) where x not in S and y in S
        using PDI = std::pair<int64_t, int>;
        std::priority_queue<PDI, std::vector<PDI>, std::greater<PDI>> pq;

        for (int y : affected) {
            for (int in_eid : rev_adj_[y]) {
                const Edge& in_e = edges_[in_eid];
                if (!in_e.live) continue;
                int x = in_e.u;
                if (!in_invalidated_[x] && dist_[x] < INF) {
                    int64_t cand = dist_[x] + in_e.weight;
                    if (cand < dist_[y]) {
                        dist_[y] = cand;
                        parent_edge_[y] = in_eid;
                    }
                }
            }
            if (dist_[y] < INF) {
                pq.push({dist_[y], y});
            }
        }

        // 5. Run bounded Dijkstra propagation starting from S
        std::vector<int> recomputed;
        while (!pq.empty()) {
            auto [d, u] = pq.top();
            pq.pop();
            if (d > dist_[u]) continue;
            recomputed.push_back(u);

            for (int out_eid : adj_[u]) {
                const Edge& out_e = edges_[out_eid];
                if (!out_e.live) continue;
                if (dist_[u] <= INF - out_e.weight) {
                    int64_t nd = dist_[u] + out_e.weight;
                    if (nd < dist_[out_e.v]) {
                        dist_[out_e.v] = nd;
                        parent_edge_[out_e.v] = out_eid;
                        pq.push({nd, out_e.v});
                    }
                }
            }
        }

        for (int u : affected) {
            in_invalidated_[u] = false;
        }

        rebuild_tree_structure();
        res.recomputed_vertices = static_cast<int>(recomputed.size());
        res.recomputed_vertices_list = recomputed;
        res.rebuild_triggered = false;
        total_recomputed_vertices_ += recomputed.size();

        if (step_traces) {
            step_traces->push_back({4, "Affected-Subtree Boundary Repair",
                "for each y in S:\n  seed dist[y] <- min_{(x,y) live, x not in S} (dist[x] + w(x,y))\nrun restricted Dijkstra on S\nupdate Shortest-Path Tree T",
                "Repaired Subtree(T, " + std::to_string(subtree_root) + ") via boundary edges; recomputed " + std::to_string(recomputed.size()) + " vertices without full graph scan.",
                recomputed, {}, k, static_cast<int>(recomputed.size())});
        }
    }

    void mutate_edge_for_baseline(const UpdateEvent& ev, int target_eid, EventResult& res) {
        if (ev.type == EventType::INSERT) {
            ensure_vertex(std::max(ev.u, ev.v));
            int id = add_initial_edge(ev.u, ev.v, ev.new_weight, true);
            res.edge_id = id;
            res.new_live = true;
        } else if (ev.type == EventType::DECREASE) {
            if (target_eid >= 0 && target_eid < static_cast<int>(edges_.size())) {
                Edge old_e = edges_[target_eid];
                res.prev_weight = old_e.weight;
                res.prev_live = old_e.live;
                int64_t nw = (ev.new_weight >= 0 && ev.new_weight < old_e.weight) ? ev.new_weight : std::max<int64_t>(1, old_e.weight / 2);
                res.new_weight = nw;
                int id = static_cast<int>(edges_.size());
                edges_.push_back(Edge{id, old_e.u, old_e.v, nw, true, old_e.version + 1, old_e.parent_edge_id});
                adj_[old_e.u].push_back(id);
                rev_adj_[old_e.v].push_back(id);
                res.edge_id = id;
            }
        } else if (ev.type == EventType::REOPEN) {
            if (target_eid >= 0 && target_eid < static_cast<int>(edges_.size())) {
                Edge& e = edges_[target_eid];
                res.prev_weight = e.weight;
                res.prev_live = e.live;
                e.live = true;
                if (ev.new_weight > 0) e.weight = ev.new_weight;
                res.new_weight = e.weight;
                res.new_live = true;
            }
        } else if (ev.type == EventType::INCREASE) {
            if (target_eid >= 0 && target_eid < static_cast<int>(edges_.size())) {
                Edge& e = edges_[target_eid];
                res.prev_weight = e.weight;
                res.prev_live = e.live;
                res.was_in_tree = (e.live && parent_edge_[e.v] == target_eid);
                e.weight = (ev.new_weight > e.weight) ? ev.new_weight : (e.weight + std::max<int64_t>(1, e.weight / 2));
                res.new_weight = e.weight;
                res.new_live = e.live;
            }
        } else if (ev.type == EventType::CLOSE) {
            if (target_eid >= 0 && target_eid < static_cast<int>(edges_.size())) {
                Edge& e = edges_[target_eid];
                res.prev_weight = e.weight;
                res.prev_live = e.live;
                res.was_in_tree = (e.live && parent_edge_[e.v] == target_eid);
                e.live = false;
                res.new_live = false;
                res.new_weight = e.weight;
            }
        }
    }
};

} // namespace pathforge

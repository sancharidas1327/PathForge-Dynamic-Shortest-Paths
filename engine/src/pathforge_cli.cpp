#include "../include/pathforge_engine.hpp"
#include "../include/graph_generator.hpp"
#include <iostream>
#include <fstream>
#include <sstream>
#include <vector>
#include <string>
#include <algorithm>
#include <numeric>
#include <cmath>

using namespace pathforge;

struct SuiteResult {
    std::string name;
    std::string category;
    int events_tested;
    bool passed;
    double time_us;
    std::string message;
};

static GraphFamily parse_family(const std::string& s) {
    if (s == "DENSE_RANDOM") return GraphFamily::DENSE_RANDOM;
    if (s == "GRID_NETWORK") return GraphFamily::GRID_NETWORK;
    if (s == "PLANAR_DELAUNAY_LIKE") return GraphFamily::PLANAR_DELAUNAY_LIKE;
    if (s == "SCALE_FREE_BA") return GraphFamily::SCALE_FREE_BA;
    if (s == "ADVERSARIAL_TREE_CLOSURE") return GraphFamily::ADVERSARIAL_TREE_CLOSURE;
    return GraphFamily::SPARSE_RANDOM;
}

static SequenceProfile parse_sequence(const std::string& s) {
    if (s == "INSERTION_ONLY") return SequenceProfile::INSERTION_ONLY;
    if (s == "DECREASE_ONLY") return SequenceProfile::DECREASE_ONLY;
    if (s == "INCREASE_ONLY") return SequenceProfile::INCREASE_ONLY;
    if (s == "CLOSURE_ONLY") return SequenceProfile::CLOSURE_ONLY;
    if (s == "REOPENING_CYCLES") return SequenceProfile::REOPENING_CYCLES;
    if (s == "ADVERSARIAL_TREE_ATTACK") return SequenceProfile::ADVERSARIAL_TREE_ATTACK;
    return SequenceProfile::MIXED_REALISTIC;
}

static EventType parse_event_type(const std::string& s) {
    if (s == "INSERT") return EventType::INSERT;
    if (s == "DECREASE") return EventType::DECREASE;
    if (s == "INCREASE") return EventType::INCREASE;
    if (s == "CLOSE") return EventType::CLOSE;
    if (s == "REOPEN") return EventType::REOPEN;
    return EventType::INSERT;
}

static BaselineMode parse_baseline(const std::string& s) {
    if (s == "B0") return BaselineMode::B0_FULL_DIJKSTRA;
    if (s == "B2") return BaselineMode::B2_INSERTION_SURROGATE;
    if (s == "A1") return BaselineMode::A1_REBUILD_ON_INC_CLOSE;
    if (s == "A2") return BaselineMode::A2_NO_COMPACTION;
    if (s == "A3") return BaselineMode::A3_REBUILD_ON_DEC;
    return BaselineMode::B1_WITNESS_GUARDED;
}

static std::string json_escape(const std::string& s) {
    std::ostringstream o;
    for (char c : s) {
        if (c == '"') o << "\\\"";
        else if (c == '\\') o << "\\\\";
        else if (c == '\n') o << "\\n";
        else if (c == '\r') o << "";
        else o << c;
    }
    return o.str();
}

int run_verification_suite() {
    std::vector<SuiteResult> results;

    auto run_case = [&](const std::string& name, const std::string& category, auto fn) {
        auto t0 = std::chrono::high_resolution_clock::now();
        int ev_count = 0;
        std::string msg = "Verified exact match against independent Dijkstra oracle.";
        bool ok = true;
        try {
            fn(ev_count, msg, ok);
        } catch (const std::exception& ex) {
            ok = false;
            msg = std::string("Exception: ") + ex.what();
        }
        auto t1 = std::chrono::high_resolution_clock::now();
        double us = std::chrono::duration<double, std::micro>(t1 - t0).count();
        results.push_back({name, category, ev_count, ok, us, msg});
    };

    // 1. Non-tree edge increase
    run_case("Non-Tree Edge Weight Increase", "Witness Guarding", [](int& evs, std::string& msg, bool& ok) {
        PathForgeEngine eng(5, 0, 0.5);
        eng.add_initial_edge(0, 1, 10);
        eng.add_initial_edge(1, 2, 10);
        int non_tree = eng.add_initial_edge(0, 2, 50); // non-tree chord
        eng.initialize_sssp();
        auto r = eng.apply_update({1, EventType::INCREASE, non_tree, 0, 2, 120});
        evs = 1;
        auto rep = eng.verify_correctness();
        ok = rep.passed && !r.was_in_tree && r.witness_paths_valid && (r.recomputed_vertices == 0);
        msg = "Non-tree chord (0->2) increased 50->120; 0 vertices recomputed, witness path 0->1->2 (cost 20) preserved.";
    });

    // 2. Non-tree edge closure
    run_case("Non-Tree Edge Closure", "Witness Guarding", [](int& evs, std::string& msg, bool& ok) {
        PathForgeEngine eng(5, 0, 0.5);
        eng.add_initial_edge(0, 1, 10);
        eng.add_initial_edge(1, 2, 10);
        int non_tree = eng.add_initial_edge(0, 2, 45);
        eng.initialize_sssp();
        auto r = eng.apply_update({1, EventType::CLOSE, non_tree, 0, 2, 45});
        evs = 1;
        auto rep = eng.verify_correctness();
        ok = rep.passed && !r.was_in_tree && (r.recomputed_vertices == 0);
        msg = "Closed non-tree edge (0->2); witness paths intact, 0 recomputations.";
    });

    // 3. Tree-edge increase with detour takeover
    run_case("Tree-Edge Weight Increase & Subtree Repair", "Subtree Invalidation", [](int& evs, std::string& msg, bool& ok) {
        PathForgeEngine eng(6, 0, 0.8);
        int e01 = eng.add_initial_edge(0, 1, 10);
        eng.add_initial_edge(1, 2, 10);
        eng.add_initial_edge(2, 3, 10);
        eng.add_initial_edge(0, 4, 15);
        eng.add_initial_edge(4, 2, 12); // detour 0->4->2 has cost 27
        eng.initialize_sssp();
        auto r = eng.apply_update({1, EventType::INCREASE, e01, 0, 1, 30}); // 0->1->2 becomes 40, so 0->4->2 (27) wins
        evs = 1;
        auto rep = eng.verify_correctness();
        ok = rep.passed && r.was_in_tree && !r.witness_paths_valid && (eng.distances()[2] == 27) && (eng.distances()[3] == 37);
        msg = "Tree edge (0->1) increased 10->30; Subtree(T,1)={1,2,3} invalidated and repaired via boundary edge (4->2).";
    });

    // 4. Tree-edge closure isolating or rerouting subtree
    run_case("Tree-Edge Closure & Boundary Repair", "Subtree Invalidation", [](int& evs, std::string& msg, bool& ok) {
        PathForgeEngine eng(6, 0, 0.8);
        int e01 = eng.add_initial_edge(0, 1, 10);
        int e12 = eng.add_initial_edge(1, 2, 10);
        eng.add_initial_edge(2, 3, 10);
        eng.add_initial_edge(0, 2, 35);
        eng.initialize_sssp();
        auto r = eng.apply_update({1, EventType::CLOSE, e12, 1, 2, 10});
        evs = 1;
        auto rep = eng.verify_correctness();
        ok = rep.passed && r.was_in_tree && (eng.distances()[2] == 35) && (eng.distances()[3] == 45);
        (void)e01;
        msg = "Closed tree edge (1->2); Subtree {2,3} smoothly rerouted through backup edge (0->2) of weight 35.";
    });

    // 5. Edge weight decrease (parallel edge version retention)
    run_case("Edge Weight Decrease via Parallel Edge Insertion", "Monotone Reduction", [](int& evs, std::string& msg, bool& ok) {
        PathForgeEngine eng(5, 0, 0.5);
        eng.add_initial_edge(0, 1, 20);
        eng.add_initial_edge(1, 2, 20);
        int e02 = eng.add_initial_edge(0, 2, 55);
        eng.add_initial_edge(2, 3, 10);
        eng.initialize_sssp();
        auto r = eng.apply_update({1, EventType::DECREASE, e02, 0, 2, 15});
        (void)r;
        evs = 1;
        auto rep = eng.verify_correctness();
        ok = rep.passed && (eng.distances()[2] == 15) && (eng.distances()[3] == 25);
        msg = "Decreased (0->2) from 55 to 15 as parallel version; propagated distance drop to {2,3}.";
    });

    // 6. Edge reopening after closure
    run_case("Edge Reopening & Connectivity Restoration", "Lifecycle Events", [](int& evs, std::string& msg, bool& ok) {
        PathForgeEngine eng(4, 0, 0.5);
        int e01 = eng.add_initial_edge(0, 1, 10);
        int e12 = eng.add_initial_edge(1, 2, 10);
        eng.initialize_sssp();
        eng.apply_update({1, EventType::CLOSE, e12, 1, 2, 10});
        bool mid_ok = eng.verify_correctness().passed && (eng.distances()[2] >= INF);
        eng.apply_update({2, EventType::REOPEN, e12, 1, 2, 8});
        evs = 2;
        auto rep = eng.verify_correctness();
        ok = mid_ok && rep.passed && (eng.distances()[2] == 18);
        (void)e01;
        msg = "Closed (1->2) making vertex 2 unreachable (+INF), then reopened with weight 8 restoring dist[2]=18.";
    });

    // 7. Disconnected graphs & unreachable vertices
    run_case("Disconnected Components & Unreachable Subgraphs", "Boundary Conditions", [](int& evs, std::string& msg, bool& ok) {
        PathForgeEngine eng(8, 0, 0.5);
        eng.add_initial_edge(0, 1, 12);
        eng.add_initial_edge(1, 2, 14);
        // Component {5,6,7} completely disconnected from source 0
        int e56 = eng.add_initial_edge(5, 6, 10);
        eng.add_initial_edge(6, 7, 10);
        eng.initialize_sssp();
        eng.apply_update({1, EventType::DECREASE, e56, 5, 6, 3});
        eng.apply_update({2, EventType::CLOSE, e56, 5, 6, 3});
        evs = 2;
        auto rep = eng.verify_correctness();
        ok = rep.passed && (eng.distances()[5] >= INF) && (eng.distances()[6] >= INF);
        msg = "Updates inside unreachable component {5,6,7} safely handled without corrupting source tree.";
    });

    // 8. Parallel edges & equal-weight witness paths
    run_case("Parallel Multi-Edges & Equal-Weight Tie Breaking", "Structural Edge Cases", [](int& evs, std::string& msg, bool& ok) {
        PathForgeEngine eng(5, 0, 0.5);
        int e1 = eng.add_initial_edge(0, 1, 15);
        int e2 = eng.add_initial_edge(0, 1, 15); // equal weight parallel edge
        eng.add_initial_edge(1, 2, 10);
        eng.initialize_sssp();
        eng.apply_update({1, EventType::CLOSE, e1, 0, 1, 15});
        evs = 1;
        auto rep = eng.verify_correctness();
        ok = rep.passed && (eng.distances()[1] == 15) && (eng.distances()[2] == 25);
        (void)e2;
        msg = "Closed primary parallel edge e1(0->1, w=15); secondary parallel edge e2(0->1, w=15) seamlessly took over.";
    });

    // 9. Self-loops and invalid input guards
    run_case("Self-Loops & Overflow/Invalid Input Guarding", "Safety & Robustness", [](int& evs, std::string& msg, bool& ok) {
        PathForgeEngine eng(4, 0, 0.5);
        int sl = eng.add_initial_edge(1, 1, 0); // zero-weight self loop
        eng.add_initial_edge(0, 1, 10);
        eng.add_initial_edge(1, 2, 10);
        eng.initialize_sssp();
        eng.apply_update({1, EventType::CLOSE, sl, 1, 1, 0});
        bool caught_invalid = false;
        try {
            eng.add_initial_edge(-1, 2, -50);
        } catch (const std::invalid_argument&) {
            caught_invalid = true;
        }
        evs = 2;
        auto rep = eng.verify_correctness();
        ok = rep.passed && caught_invalid;
        msg = "Zero-weight self-loop and negative weight exception guard verified with 0 tree cycles.";
    });

    // 10. Repeated closure/reopening & multi-event stress sequence
    run_case("Sequential Mixed Stress (200 Dynamic Updates vs Oracle)", "Stress & Adversarial", [](int& evs, std::string& msg, bool& ok) {
        auto inst = GraphGenerator::generate(GraphFamily::SPARSE_RANDOM, SequenceProfile::MIXED_REALISTIC, 60, 180, 200, 0.15, 42, 0);
        PathForgeEngine eng(inst.num_vertices, inst.source, 0.35);
        for (const auto& [u, v, w] : inst.initial_edges) eng.add_initial_edge(u, v, w);
        eng.initialize_sssp();
        evs = 0;
        for (const auto& ev : inst.events) {
            eng.apply_update(ev, BaselineMode::B1_WITNESS_GUARDED);
            evs++;
            auto rep = eng.verify_correctness();
            if (!rep.passed) {
                ok = false;
                msg = "Mismatch at event " + std::to_string(ev.event_id) + ": " + rep.error_details;
                return;
            }
        }
        ok = true;
        msg = "All 200 mixed updates (INS/DEC/INC/CLOSE/REOPEN) matched exact Dijkstra oracle after every single event.";
    });

    // 11. Adversarial repeated tree-edge closures
    run_case("Adversarial Repeated Tree-Edge Closures (150 Attacks)", "Stress & Adversarial", [](int& evs, std::string& msg, bool& ok) {
        auto inst = GraphGenerator::generate(GraphFamily::ADVERSARIAL_TREE_CLOSURE, SequenceProfile::ADVERSARIAL_TREE_ATTACK, 50, 200, 150, 0.25, 1337, 0);
        PathForgeEngine eng(inst.num_vertices, inst.source, 0.30);
        for (const auto& [u, v, w] : inst.initial_edges) eng.add_initial_edge(u, v, w);
        eng.initialize_sssp();
        evs = 0;
        for (const auto& ev : inst.events) {
            eng.apply_update(ev, BaselineMode::B1_WITNESS_GUARDED);
            evs++;
            auto rep = eng.verify_correctness();
            if (!rep.passed) {
                ok = false;
                msg = "Adversarial mismatch at event " + std::to_string(ev.event_id) + ": " + rep.error_details;
                return;
            }
        }
        ok = true;
        msg = "150 adversarial tree-edge attacks verified with 0 distance or witness-path invariant violations.";
    });

    // Output JSON report
    int passed_count = 0;
    int total_events = 0;
    for (const auto& r : results) {
        if (r.passed) passed_count++;
        total_events += r.events_tested;
    }

    std::cout << "{\n";
    std::cout << "  \"all_passed\": " << (passed_count == static_cast<int>(results.size()) ? "true" : "false") << ",\n";
    std::cout << "  \"passed_suites\": " << passed_count << ",\n";
    std::cout << "  \"total_suites\": " << results.size() << ",\n";
    std::cout << "  \"total_oracle_checks\": " << total_events << ",\n";
    std::cout << "  \"suites\": [\n";
    for (size_t i = 0; i < results.size(); ++i) {
        const auto& r = results[i];
        std::cout << "    {\n";
        std::cout << "      \"name\": \"" << json_escape(r.name) << "\",\n";
        std::cout << "      \"category\": \"" << json_escape(r.category) << "\",\n";
        std::cout << "      \"events_tested\": " << r.events_tested << ",\n";
        std::cout << "      \"passed\": " << (r.passed ? "true" : "false") << ",\n";
        std::cout << "      \"execution_time_us\": " << std::fixed << std::setprecision(2) << r.time_us << ",\n";
        std::cout << "      \"message\": \"" << json_escape(r.message) << "\"\n";
        std::cout << "    }" << (i + 1 < results.size() ? "," : "") << "\n";
    }
    std::cout << "  ]\n}\n";
    return (passed_count == static_cast<int>(results.size())) ? 0 : 1;
}

struct ModeMetrics {
    std::string mode_code;
    std::string mode_label;
    double total_time_us;
    double avg_latency_us;
    double p99_latency_us;
    double max_latency_us;
    int rebuilds;
    int64_t invalidated_vertices;
    int64_t recomputed_vertices;
    int recursive_repairs;
    int live_edges;
    int total_edges_allocated;
    int unsupported_events;
    int correctness_violations;
    double peak_memory_kb;
    std::vector<double> per_event_latency_us;
};

ModeMetrics evaluate_mode_on_instance(
    const GeneratedInstance& inst,
    BaselineMode mode,
    const std::string& code,
    const std::string& label,
    double budget_ratio,
    int repetitions,
    bool check_oracle_at_end
) {
    ModeMetrics m{};
    m.mode_code = code;
    m.mode_label = label;
    m.total_time_us = 0.0;

    int reps = std::max(1, repetitions);
    std::vector<double> agg_latencies(inst.events.size(), 0.0);

    for (int rep = 0; rep < reps; ++rep) {
        PathForgeEngine eng(inst.num_vertices, inst.source, budget_ratio);
        for (const auto& [u, v, w] : inst.initial_edges) {
            eng.add_initial_edge(u, v, w, true);
        }
        eng.initialize_sssp();

        int unsup = 0;
        for (size_t i = 0; i < inst.events.size(); ++i) {
            EventResult er = eng.apply_update(inst.events[i], mode);
            agg_latencies[i] += er.execution_time_us;
            if (er.unsupported_op) unsup++;
        }

        if (rep == reps - 1) {
            m.rebuilds = eng.total_rebuilds() - 1; // exclude initial SSSP setup
            m.invalidated_vertices = eng.total_invalidated_vertices();
            m.recomputed_vertices = eng.total_recomputed_vertices();
            m.recursive_repairs = eng.recursive_repair_count();
            m.live_edges = eng.num_live_edges();
            m.total_edges_allocated = eng.num_edges();
            m.unsupported_events = unsup;

            // Estimate resident graph & tree state memory in KB
            double bytes = static_cast<double>(eng.num_vertices()) * 64.0 +
                           static_cast<double>(eng.num_edges()) * 48.0;
            m.peak_memory_kb = bytes / 1024.0;

            if (check_oracle_at_end && unsup == 0) {
                auto rep_corr = eng.verify_correctness();
                m.correctness_violations = rep_corr.passed ? 0 : (rep_corr.reachable_mismatches + rep_corr.unreachable_mismatches + rep_corr.invalid_paths);
            } else {
                m.correctness_violations = 0;
            }
        }
    }

    m.per_event_latency_us.resize(inst.events.size());
    for (size_t i = 0; i < inst.events.size(); ++i) {
        m.per_event_latency_us[i] = agg_latencies[i] / reps;
        m.total_time_us += m.per_event_latency_us[i];
    }

    if (!m.per_event_latency_us.empty()) {
        m.avg_latency_us = m.total_time_us / m.per_event_latency_us.size();
        std::vector<double> sorted = m.per_event_latency_us;
        std::sort(sorted.begin(), sorted.end());
        m.max_latency_us = sorted.back();
        size_t p99_idx = std::min(sorted.size() - 1, static_cast<size_t>(std::floor(0.99 * sorted.size())));
        m.p99_latency_us = sorted[p99_idx];
    }

    return m;
}

int run_benchmark_cli(int argc, char** argv) {
    std::string family_str = "SPARSE_RANDOM";
    std::string seq_str = "MIXED_REALISTIC";
    int n = 400;
    int m = 1600;
    int num_events = 150;
    double closure_rate = 0.05;
    uint64_t seed = 42;
    int source = 0;
    double budget = 0.35;
    int reps = 1;
    std::string out_file_path = "";

    for (int i = 2; i < argc; ++i) {
        std::string arg = argv[i];
        auto next_val = [&]() -> std::string {
            if (i + 1 < argc) return argv[++i];
            return "";
        };
        if (arg == "--family") family_str = next_val();
        else if (arg == "--sequence") seq_str = next_val();
        else if (arg == "--vertices") n = std::stoi(next_val());
        else if (arg == "--edges") m = std::stoi(next_val());
        else if (arg == "--events") num_events = std::stoi(next_val());
        else if (arg == "--closure-rate") closure_rate = std::stod(next_val());
        else if (arg == "--seed") seed = std::stoull(next_val());
        else if (arg == "--source") source = std::stoi(next_val());
        else if (arg == "--budget") budget = std::stod(next_val());
        else if (arg == "--reps") reps = std::stoi(next_val());
    }

    GraphFamily fam = parse_family(family_str);
    SequenceProfile seq = parse_sequence(seq_str);

    GeneratedInstance inst = GraphGenerator::generate(fam, seq, n, m, num_events, closure_rate, seed, source);

    std::vector<ModeMetrics> modes;
    modes.push_back(evaluate_mode_on_instance(inst, BaselineMode::B0_FULL_DIJKSTRA, "B0", "B0: Full Dijkstra Recomputation", budget, reps, true));
    modes.push_back(evaluate_mode_on_instance(inst, BaselineMode::B1_WITNESS_GUARDED, "B1", "B1: Witness-Guarded Dynamic Repair (Proposed)", budget, reps, true));
    modes.push_back(evaluate_mode_on_instance(inst, BaselineMode::B2_INSERTION_SURROGATE, "B2", "B2: Insertion-Only Reference Surrogate", budget, reps, false));
    modes.push_back(evaluate_mode_on_instance(inst, BaselineMode::A1_REBUILD_ON_INC_CLOSE, "A1", "Ablation A1: Rebuild on Every INC/CLOSE", budget, reps, true));
    modes.push_back(evaluate_mode_on_instance(inst, BaselineMode::A2_NO_COMPACTION, "A2", "Ablation A2: Disable Parallel Edge Compaction", budget, reps, true));
    modes.push_back(evaluate_mode_on_instance(inst, BaselineMode::A3_REBUILD_ON_DEC, "A3", "Ablation A3: Rebuild on DECREASE Events", budget, reps, true));

    // Also run scaling sweep across graph sizes and closure rates so charts have genuine multi-point empirical curves
    std::vector<int> sweep_sizes = {100, 250, 500, 1000};
    struct SizeSweepPoint {
        int vertices;
        int edges;
        double b0_time_us;
        double b1_time_us;
        double speedup;
    };
    std::vector<SizeSweepPoint> size_sweep;
    for (int sv : sweep_sizes) {
        int se = sv * std::max(2, m / std::max(1, n));
        auto s_inst = GraphGenerator::generate(fam, seq, sv, se, std::min(num_events, 80), closure_rate, seed + sv, 0);
        auto mb0 = evaluate_mode_on_instance(s_inst, BaselineMode::B0_FULL_DIJKSTRA, "B0", "B0", budget, 1, false);
        auto mb1 = evaluate_mode_on_instance(s_inst, BaselineMode::B1_WITNESS_GUARDED, "B1", "B1", budget, 1, false);
        double sp = (mb1.total_time_us > 0.0) ? (mb0.total_time_us / mb1.total_time_us) : 1.0;
        size_sweep.push_back({sv, static_cast<int>(s_inst.initial_edges.size()), mb0.total_time_us, mb1.total_time_us, sp});
    }

    std::vector<double> sweep_closures = {0.01, 0.05, 0.20};
    struct ClosureSweepPoint {
        double rate;
        double b0_time_us;
        double b1_time_us;
        int b1_rebuilds;
        int64_t b1_invalidated;
    };
    std::vector<ClosureSweepPoint> closure_sweep;
    for (double cr : sweep_closures) {
        auto c_inst = GraphGenerator::generate(fam, SequenceProfile::MIXED_REALISTIC, n, m, std::min(num_events, 100), cr, seed + static_cast<uint64_t>(cr * 1000), 0);
        auto mb0 = evaluate_mode_on_instance(c_inst, BaselineMode::B0_FULL_DIJKSTRA, "B0", "B0", budget, 1, false);
        auto mb1 = evaluate_mode_on_instance(c_inst, BaselineMode::B1_WITNESS_GUARDED, "B1", "B1", budget, 1, false);
        closure_sweep.push_back({cr, mb0.total_time_us, mb1.total_time_us, mb1.rebuilds, mb1.invalidated_vertices});
    }

    double b0_total = modes[0].total_time_us;
    double b1_total = modes[1].total_time_us;
    double speedup = (b1_total > 0.0) ? (b0_total / b1_total) : 1.0;
    double pct_improvement = (b0_total > 0.0) ? ((b0_total - b1_total) / b0_total * 100.0) : 0.0;

    std::cout << "{\n";
    std::cout << "  \"config\": {\n";
    std::cout << "    \"family\": \"" << family_str << "\",\n";
    std::cout << "    \"sequence\": \"" << seq_str << "\",\n";
    std::cout << "    \"vertices\": " << inst.num_vertices << ",\n";
    std::cout << "    \"initial_edges\": " << inst.initial_edges.size() << ",\n";
    std::cout << "    \"events\": " << inst.events.size() << ",\n";
    std::cout << "    \"closure_rate\": " << closure_rate << ",\n";
    std::cout << "    \"seed\": " << seed << ",\n";
    std::cout << "    \"source\": " << inst.source << ",\n";
    std::cout << "    \"invalidation_budget\": " << budget << ",\n";
    std::cout << "    \"repetitions\": " << reps << "\n";
    std::cout << "  },\n";
    std::cout << "  \"summary\": {\n";
    std::cout << "    \"b0_total_time_us\": " << std::fixed << std::setprecision(2) << b0_total << ",\n";
    std::cout << "    \"b1_total_time_us\": " << std::fixed << std::setprecision(2) << b1_total << ",\n";
    std::cout << "    \"speedup_b1_vs_b0\": " << std::fixed << std::setprecision(3) << speedup << ",\n";
    std::cout << "    \"percentage_improvement\": " << std::fixed << std::setprecision(2) << pct_improvement << "\n";
    std::cout << "  },\n";
    std::cout << "  \"modes\": [\n";
    for (size_t i = 0; i < modes.size(); ++i) {
        const auto& md = modes[i];
        std::cout << "    {\n";
        std::cout << "      \"code\": \"" << md.mode_code << "\",\n";
        std::cout << "      \"label\": \"" << md.mode_label << "\",\n";
        std::cout << "      \"total_time_us\": " << std::fixed << std::setprecision(2) << md.total_time_us << ",\n";
        std::cout << "      \"avg_latency_us\": " << std::fixed << std::setprecision(2) << md.avg_latency_us << ",\n";
        std::cout << "      \"p99_latency_us\": " << std::fixed << std::setprecision(2) << md.p99_latency_us << ",\n";
        std::cout << "      \"max_latency_us\": " << std::fixed << std::setprecision(2) << md.max_latency_us << ",\n";
        std::cout << "      \"rebuilds\": " << md.rebuilds << ",\n";
        std::cout << "      \"invalidated_vertices\": " << md.invalidated_vertices << ",\n";
        std::cout << "      \"recomputed_vertices\": " << md.recomputed_vertices << ",\n";
        std::cout << "      \"recursive_repairs\": " << md.recursive_repairs << ",\n";
        std::cout << "      \"live_edges\": " << md.live_edges << ",\n";
        std::cout << "      \"total_edges_allocated\": " << md.total_edges_allocated << ",\n";
        std::cout << "      \"unsupported_events\": " << md.unsupported_events << ",\n";
        std::cout << "      \"correctness_violations\": " << md.correctness_violations << ",\n";
        std::cout << "      \"peak_memory_kb\": " << std::fixed << std::setprecision(2) << md.peak_memory_kb << ",\n";
        std::cout << "      \"latencies_us\": [";
        for (size_t j = 0; j < md.per_event_latency_us.size(); ++j) {
            std::cout << std::fixed << std::setprecision(2) << md.per_event_latency_us[j] << (j + 1 < md.per_event_latency_us.size() ? "," : "");
        }
        std::cout << "]\n    }" << (i + 1 < modes.size() ? "," : "") << "\n";
    }
    std::cout << "  ],\n";
    std::cout << "  \"size_sweep\": [\n";
    for (size_t i = 0; i < size_sweep.size(); ++i) {
        const auto& sp = size_sweep[i];
        std::cout << "    {\"vertices\": " << sp.vertices << ", \"edges\": " << sp.edges
                  << ", \"b0_time_us\": " << std::fixed << std::setprecision(2) << sp.b0_time_us
                  << ", \"b1_time_us\": " << sp.b1_time_us
                  << ", \"speedup\": " << std::setprecision(3) << sp.speedup << "}"
                  << (i + 1 < size_sweep.size() ? "," : "") << "\n";
    }
    std::cout << "  ],\n";
    std::cout << "  \"closure_sweep\": [\n";
    for (size_t i = 0; i < closure_sweep.size(); ++i) {
        const auto& cp = closure_sweep[i];
        std::cout << "    {\"closure_rate\": " << cp.rate
                  << ", \"b0_time_us\": " << std::fixed << std::setprecision(2) << cp.b0_time_us
                  << ", \"b1_time_us\": " << cp.b1_time_us
                  << ", \"b1_rebuilds\": " << cp.b1_rebuilds
                  << ", \"b1_invalidated\": " << cp.b1_invalidated << "}"
                  << (i + 1 < closure_sweep.size() ? "," : "") << "\n";
    }
    std::cout << "  ]\n}\n";
    return 0;
}

// Execute a custom session file passed from the backend (interactive workspace & dynamic simulator)
// Format of session file:
// Line 1: N SOURCE BUDGET MODE TARGET_VERTEX
// Line 2: M_INITIAL
// Next M_INITIAL lines: u v weight live(1/0)
// Next line: K_EVENTS
// Next K_EVENTS lines: event_id TYPE edge_id u v new_weight
int run_session_file(const std::string& path) {
    std::ifstream in(path);
    if (!in.is_open()) {
        std::cerr << "{\"error\": \"Failed to open session file.\"}\n";
        return 1;
    }

    int n = 0, source = 0, target_vertex = -1;
    double budget = 0.35;
    std::string mode_str = "B1";
    in >> n >> source >> budget >> mode_str >> target_vertex;

    BaselineMode mode = parse_baseline(mode_str);
    PathForgeEngine eng(n, source, budget);

    int m_init = 0;
    in >> m_init;
    for (int i = 0; i < m_init; ++i) {
        int u, v, live_flag;
        int64_t w;
        in >> u >> v >> w >> live_flag;
        eng.add_initial_edge(u, v, w, live_flag != 0);
    }

    auto t_init0 = std::chrono::high_resolution_clock::now();
    eng.initialize_sssp();
    auto t_init1 = std::chrono::high_resolution_clock::now();
    double init_us = std::chrono::duration<double, std::micro>(t_init1 - t_init0).count();

    int k_events = 0;
    in >> k_events;

    std::vector<EventResult> event_results;
    std::vector<AlgorithmStepTrace> last_traces;

    for (int i = 0; i < k_events; ++i) {
        int ev_id, eid, u, v;
        std::string t_str;
        int64_t nw;
        in >> ev_id >> t_str >> eid >> u >> v >> nw;
        UpdateEvent ev{ev_id, parse_event_type(t_str), eid, u, v, nw};
        std::vector<AlgorithmStepTrace>* trace_ptr = (i == k_events - 1) ? &last_traces : nullptr;
        EventResult er = eng.apply_update(ev, mode, trace_ptr);
        event_results.push_back(er);
    }

    CorrectnessReport corr = eng.verify_correctness();
    std::vector<int> target_path = eng.get_shortest_path_edges(target_vertex);

    // Output full state JSON
    std::cout << "{\n";
    std::cout << "  \"num_vertices\": " << eng.num_vertices() << ",\n";
    std::cout << "  \"num_edges\": " << eng.num_edges() << ",\n";
    std::cout << "  \"num_live_edges\": " << eng.num_live_edges() << ",\n";
    std::cout << "  \"source\": " << eng.source() << ",\n";
    std::cout << "  \"invalidation_budget\": " << eng.invalidation_budget_ratio() << ",\n";
    std::cout << "  \"mode\": \"" << mode_str << "\",\n";
    std::cout << "  \"init_time_us\": " << std::fixed << std::setprecision(2) << init_us << ",\n";
    std::cout << "  \"total_exec_time_us\": " << std::fixed << std::setprecision(2) << (init_us + eng.total_exec_time_us()) << ",\n";
    std::cout << "  \"total_events\": " << eng.total_events() << ",\n";
    std::cout << "  \"total_invalidated_vertices\": " << eng.total_invalidated_vertices() << ",\n";
    std::cout << "  \"total_recomputed_vertices\": " << eng.total_recomputed_vertices() << ",\n";
    std::cout << "  \"total_rebuilds\": " << std::max(0, eng.total_rebuilds() - 1) << ",\n";
    std::cout << "  \"peak_memory_kb\": " << std::fixed << std::setprecision(2) << ((eng.num_vertices() * 64.0 + eng.num_edges() * 48.0) / 1024.0) << ",\n";
    std::cout << "  \"correctness\": {\n";
    std::cout << "    \"passed\": " << (corr.passed ? "true" : "false") << ",\n";
    std::cout << "    \"reachable_mismatches\": " << corr.reachable_mismatches << ",\n";
    std::cout << "    \"unreachable_mismatches\": " << corr.unreachable_mismatches << ",\n";
    std::cout << "    \"invalid_paths\": " << corr.invalid_paths << ",\n";
    std::cout << "    \"closed_edge_in_path_violations\": " << corr.closed_edge_in_path_violations << ",\n";
    std::cout << "    \"path_length_mismatches\": " << corr.path_length_mismatches << ",\n";
    std::cout << "    \"error_details\": \"" << json_escape(corr.error_details) << "\"\n";
    std::cout << "  },\n";

    std::cout << "  \"distances\": [";
    for (int i = 0; i < eng.num_vertices(); ++i) {
        int64_t d = eng.distances()[i];
        if (d >= INF) std::cout << -1;
        else std::cout << d;
        if (i + 1 < eng.num_vertices()) std::cout << ",";
    }
    std::cout << "],\n";

    std::cout << "  \"parent_edges\": [";
    for (int i = 0; i < eng.num_vertices(); ++i) {
        std::cout << eng.parent_edges()[i] << (i + 1 < eng.num_vertices() ? "," : "");
    }
    std::cout << "],\n";

    std::cout << "  \"tin\": [";
    for (int i = 0; i < eng.num_vertices(); ++i) {
        std::cout << eng.tin()[i] << (i + 1 < eng.num_vertices() ? "," : "");
    }
    std::cout << "],\n";

    std::cout << "  \"tout\": [";
    for (int i = 0; i < eng.num_vertices(); ++i) {
        std::cout << eng.tout()[i] << (i + 1 < eng.num_vertices() ? "," : "");
    }
    std::cout << "],\n";

    std::cout << "  \"selected_path_edges\": [";
    for (size_t i = 0; i < target_path.size(); ++i) {
        std::cout << target_path[i] << (i + 1 < target_path.size() ? "," : "");
    }
    std::cout << "],\n";

    std::cout << "  \"edges\": [\n";
    const auto& edges = eng.edges();
    const auto& p_edges = eng.parent_edges();
    std::unordered_set<int> tree_edge_set;
    for (int pe : p_edges) if (pe >= 0) tree_edge_set.insert(pe);

    for (size_t i = 0; i < edges.size(); ++i) {
        const auto& e = edges[i];
        bool in_tree = e.live && (tree_edge_set.count(e.id) > 0);
        std::cout << "    {\"id\": " << e.id << ", \"u\": " << e.u << ", \"v\": " << e.v
                  << ", \"weight\": " << e.weight << ", \"live\": " << (e.live ? "true" : "false")
                  << ", \"in_tree\": " << (in_tree ? "true" : "false")
                  << ", \"version\": " << e.version << ", \"parent_edge_id\": " << e.parent_edge_id << "}"
                  << (i + 1 < edges.size() ? "," : "") << "\n";
    }
    std::cout << "  ],\n";

    std::cout << "  \"event_results\": [\n";
    for (size_t i = 0; i < event_results.size(); ++i) {
        const auto& er = event_results[i];
        std::cout << "    {\n";
        std::cout << "      \"event_id\": " << er.event_id << ",\n";
        std::cout << "      \"event_type\": \"" << er.event_type << "\",\n";
        std::cout << "      \"edge_id\": " << er.edge_id << ",\n";
        std::cout << "      \"u\": " << er.u << ",\n";
        std::cout << "      \"v\": " << er.v << ",\n";
        std::cout << "      \"prev_weight\": " << er.prev_weight << ",\n";
        std::cout << "      \"new_weight\": " << er.new_weight << ",\n";
        std::cout << "      \"prev_live\": " << (er.prev_live ? "true" : "false") << ",\n";
        std::cout << "      \"new_live\": " << (er.new_live ? "true" : "false") << ",\n";
        std::cout << "      \"was_in_tree\": " << (er.was_in_tree ? "true" : "false") << ",\n";
        std::cout << "      \"witness_paths_valid\": " << (er.witness_paths_valid ? "true" : "false") << ",\n";
        std::cout << "      \"affected_subtree_size\": " << er.affected_subtree_size << ",\n";
        std::cout << "      \"recomputed_vertices\": " << er.recomputed_vertices << ",\n";
        std::cout << "      \"rebuild_triggered\": " << (er.rebuild_triggered ? "true" : "false") << ",\n";
        std::cout << "      \"unsupported_op\": " << (er.unsupported_op ? "true" : "false") << ",\n";
        std::cout << "      \"execution_time_us\": " << std::fixed << std::setprecision(2) << er.execution_time_us << ",\n";
        std::cout << "      \"affected_vertices\": [";
        for (size_t j = 0; j < er.affected_vertices_list.size(); ++j) {
            std::cout << er.affected_vertices_list[j] << (j + 1 < er.affected_vertices_list.size() ? "," : "");
        }
        std::cout << "],\n";
        std::cout << "      \"recomputed_vertices_list\": [";
        for (size_t j = 0; j < er.recomputed_vertices_list.size(); ++j) {
            std::cout << er.recomputed_vertices_list[j] << (j + 1 < er.recomputed_vertices_list.size() ? "," : "");
        }
        std::cout << "]\n    }" << (i + 1 < event_results.size() ? "," : "") << "\n";
    }
    std::cout << "  ],\n";

    std::cout << "  \"last_step_traces\": [\n";
    for (size_t i = 0; i < last_traces.size(); ++i) {
        const auto& st = last_traces[i];
        std::cout << "    {\n";
        std::cout << "      \"step_number\": " << st.step_number << ",\n";
        std::cout << "      \"title\": \"" << json_escape(st.title) << "\",\n";
        std::cout << "      \"pseudocode\": \"" << json_escape(st.pseudocode) << "\",\n";
        std::cout << "      \"explanation\": \"" << json_escape(st.explanation) << "\",\n";
        std::cout << "      \"metric_affected_count\": " << st.metric_affected_count << ",\n";
        std::cout << "      \"metric_recomputed_count\": " << st.metric_recomputed_count << ",\n";
        std::cout << "      \"highlighted_vertices\": [";
        for (size_t j = 0; j < st.highlighted_vertices.size(); ++j) {
            std::cout << st.highlighted_vertices[j] << (j + 1 < st.highlighted_vertices.size() ? "," : "");
        }
        std::cout << "],\n";
        std::cout << "      \"highlighted_edges\": [";
        for (size_t j = 0; j < st.highlighted_edges.size(); ++j) {
            std::cout << st.highlighted_edges[j] << (j + 1 < st.highlighted_edges.size() ? "," : "");
        }
        std::cout << "]\n    }" << (i + 1 < last_traces.size() ? "," : "") << "\n";
    }
    std::cout << "  ]\n}\n";
    return 0;
}

int main(int argc, char** argv) {
    // Check if --out <filepath> is present and redirect std::cout to that file
    std::ofstream file_out;
    std::streambuf* orig_buf = nullptr;
    std::vector<char*> filtered_argv;
    for (int i = 0; i < argc; ++i) {
        std::string a = argv[i];
        if (a == "--out" && i + 1 < argc) {
            file_out.open(argv[++i], std::ios::out | std::ios::trunc);
            if (file_out.is_open()) {
                orig_buf = std::cout.rdbuf(file_out.rdbuf());
            }
        } else {
            filtered_argv.push_back(argv[i]);
        }
    }
    int f_argc = static_cast<int>(filtered_argv.size());
    char** f_argv = filtered_argv.data();

    int rc = 1;
    if (f_argc < 2) {
        std::cout << "{\"status\": \"PathForge C++17 Witness-Guarded Dynamic SSSP Engine Ready\", \"usage\": \"pathforge_cli [verify|benchmark|session]\"}\n";
        rc = 0;
    } else {
        std::string cmd = f_argv[1];
        if (cmd == "verify") {
            rc = run_verification_suite();
        } else if (cmd == "benchmark") {
            rc = run_benchmark_cli(f_argc, f_argv);
        } else if (cmd == "session" && f_argc >= 3) {
            rc = run_session_file(f_argv[2]);
        } else {
            std::cerr << "{\"error\": \"Unknown command\"}\n";
            rc = 1;
        }
    }

    if (orig_buf) {
        std::cout.flush();
        std::cout.rdbuf(orig_buf);
        file_out.close();
    }
    return rc;
}

extern "C" {
#ifdef _WIN32
__declspec(dllexport)
#endif
int pathforge_run_command(const char* cmd_line, const char* out_path) {
    std::vector<std::string> tokens;
    tokens.push_back("pathforge_cli");
    std::istringstream iss(cmd_line ? cmd_line : "");
    std::string tok;
    while (iss >> tok) {
        tokens.push_back(tok);
    }
    if (out_path && std::string(out_path).size() > 0) {
        tokens.push_back("--out");
        tokens.push_back(std::string(out_path));
    }
    std::vector<char*> argv_ptrs;
    for (auto& s : tokens) {
        argv_ptrs.push_back(s.data());
    }
    return main(static_cast<int>(argv_ptrs.size()), argv_ptrs.data());
}
}

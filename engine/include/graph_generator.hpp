#pragma once

#include "pathforge_engine.hpp"
#include <random>
#include <set>
#include <numeric>

namespace pathforge {

enum class GraphFamily {
    SPARSE_RANDOM,
    DENSE_RANDOM,
    GRID_NETWORK,
    PLANAR_DELAUNAY_LIKE,
    SCALE_FREE_BA,
    ADVERSARIAL_TREE_CLOSURE
};

enum class SequenceProfile {
    INSERTION_ONLY,
    DECREASE_ONLY,
    INCREASE_ONLY,
    CLOSURE_ONLY,
    MIXED_REALISTIC,
    REOPENING_CYCLES,
    ADVERSARIAL_TREE_ATTACK
};

struct GeneratedInstance {
    int num_vertices;
    int source;
    std::vector<std::tuple<int, int, int64_t>> initial_edges;
    std::vector<UpdateEvent> events;
};

class GraphGenerator {
public:
    static GeneratedInstance generate(
        GraphFamily family,
        SequenceProfile seq_profile,
        int num_vertices,
        int target_edges,
        int num_events,
        double closure_rate,
        uint64_t seed,
        int source = 0
    ) {
        std::mt19937_64 rng(seed);
        GeneratedInstance inst;
        inst.num_vertices = std::max(4, num_vertices);
        inst.source = std::clamp(source, 0, inst.num_vertices - 1);

        int n = inst.num_vertices;
        std::uniform_int_distribution<int64_t> w_dist(10, 250);

        // Always build a base spanning tree from source so vertices start reachable
        std::vector<int> order(n);
        std::iota(order.begin(), order.end(), 0);
        if (inst.source != 0) std::swap(order[0], order[inst.source]);
        std::shuffle(order.begin() + 1, order.end(), rng);

        std::set<std::pair<int, int>> existing;
        auto add_e = [&](int u, int v, int64_t w) {
            if (u == v) return;
            if (existing.count({u, v})) return;
            existing.insert({u, v});
            inst.initial_edges.push_back({u, v, w});
        };

        if (family == GraphFamily::GRID_NETWORK) {
            int cols = std::max(2, static_cast<int>(std::sqrt(n)));
            for (int u = 0; u < n; ++u) {
                int c = u % cols;
                if (c + 1 < cols && u + 1 < n) {
                    add_e(u, u + 1, w_dist(rng));
                    add_e(u + 1, u, w_dist(rng));
                }
                if (u + cols < n) {
                    add_e(u, u + cols, w_dist(rng));
                    add_e(u + cols, u, w_dist(rng));
                }
            }
        } else if (family == GraphFamily::PLANAR_DELAUNAY_LIKE) {
            // Layered planar-like triangulation mesh
            int cols = std::max(2, static_cast<int>(std::sqrt(n)));
            for (int u = 0; u < n; ++u) {
                int c = u % cols;
                if (c + 1 < cols && u + 1 < n) add_e(u, u + 1, w_dist(rng));
                if (u + cols < n) add_e(u, u + cols, w_dist(rng));
                if (c + 1 < cols && u + cols + 1 < n) add_e(u, u + cols + 1, w_dist(rng));
                if (u > 0 && (u % 5 == 0)) add_e(u, u - 1, w_dist(rng));
            }
        } else if (family == GraphFamily::SCALE_FREE_BA) {
            // Barabasi-Albert preferential attachment
            std::vector<int> deg_pool;
            for (int i = 1; i < n; ++i) {
                int p = order[std::uniform_int_distribution<int>(0, i - 1)(rng)];
                add_e(p, order[i], w_dist(rng));
                deg_pool.push_back(p);
                deg_pool.push_back(order[i]);
            }
            int m_target = std::max(n, target_edges);
            std::uniform_int_distribution<int> v_dist(0, n - 1);
            int attempts = 0;
            while (static_cast<int>(inst.initial_edges.size()) < m_target && attempts < m_target * 4) {
                attempts++;
                int u = deg_pool[std::uniform_int_distribution<size_t>(0, deg_pool.size() - 1)(rng)];
                int v = v_dist(rng);
                add_e(u, v, w_dist(rng));
            }
        } else if (family == GraphFamily::ADVERSARIAL_TREE_CLOSURE) {
            // Deep shortest-path tree with high-weight backup detours
            for (int i = 1; i < n; ++i) {
                int p = order[std::max(0, i - 1 - std::uniform_int_distribution<int>(0, 2)(rng))];
                add_e(p, order[i], 10 + (i % 7)); // Very light tree edges
            }
            std::uniform_int_distribution<int> v_dist(0, n - 1);
            int m_target = std::max(n * 2, target_edges);
            for (int i = 0; i < m_target; ++i) {
                add_e(v_dist(rng), v_dist(rng), 120 + w_dist(rng)); // Heavy backup edges
            }
        } else {
            // SPARSE_RANDOM or DENSE_RANDOM
            for (int i = 1; i < n; ++i) {
                int p = order[std::uniform_int_distribution<int>(0, i - 1)(rng)];
                add_e(p, order[i], w_dist(rng));
            }
            int desired_m = target_edges;
            if (family == GraphFamily::DENSE_RANDOM) {
                desired_m = std::max(target_edges, std::min(n * (n - 1) / 2, n * 8));
            }
            std::uniform_int_distribution<int> v_dist(0, n - 1);
            int attempts = 0;
            while (static_cast<int>(inst.initial_edges.size()) < desired_m && attempts < desired_m * 5) {
                attempts++;
                add_e(v_dist(rng), v_dist(rng), w_dist(rng));
            }
        }

        // Simulate a temporary engine to pick realistic edges (including tree vs non-tree edges)
        PathForgeEngine temp(n, inst.source, 0.35);
        for (const auto& [u, v, w] : inst.initial_edges) {
            temp.add_initial_edge(u, v, w, true);
        }
        temp.initialize_sssp();

        int m_init = static_cast<int>(inst.initial_edges.size());
        std::uniform_int_distribution<int> v_dist(0, n - 1);
        std::uniform_real_distribution<double> u01(0.0, 1.0);
        std::vector<int> closed_pool;

        for (int eid_ev = 0; eid_ev < num_events; ++eid_ev) {
            EventType et = EventType::INSERT;
            if (seq_profile == SequenceProfile::INSERTION_ONLY) {
                et = EventType::INSERT;
            } else if (seq_profile == SequenceProfile::DECREASE_ONLY) {
                et = EventType::DECREASE;
            } else if (seq_profile == SequenceProfile::INCREASE_ONLY) {
                et = EventType::INCREASE;
            } else if (seq_profile == SequenceProfile::CLOSURE_ONLY) {
                et = EventType::CLOSE;
            } else if (seq_profile == SequenceProfile::REOPENING_CYCLES) {
                if (!closed_pool.empty() && (eid_ev % 2 == 1)) {
                    et = EventType::REOPEN;
                } else {
                    et = EventType::CLOSE;
                }
            } else if (seq_profile == SequenceProfile::ADVERSARIAL_TREE_ATTACK) {
                et = (eid_ev % 3 == 0) ? EventType::CLOSE : EventType::INCREASE;
            } else {
                // MIXED_REALISTIC respecting closure_rate
                double r = u01(rng);
                if (r < closure_rate) {
                    et = EventType::CLOSE;
                } else if (!closed_pool.empty() && r < closure_rate * 1.5) {
                    et = EventType::REOPEN;
                } else if (r < closure_rate + 0.30) {
                    et = EventType::INCREASE;
                } else if (r < closure_rate + 0.65) {
                    et = EventType::DECREASE;
                } else {
                    et = EventType::INSERT;
                }
            }

            UpdateEvent ev{};
            ev.event_id = eid_ev + 1;
            ev.type = et;

            if (et == EventType::INSERT) {
                int u = v_dist(rng);
                int v = v_dist(rng);
                if (u == v) v = (u + 1) % n;
                ev.edge_id = -1;
                ev.u = u;
                ev.v = v;
                ev.new_weight = std::max<int64_t>(5, w_dist(rng) / 2);
            } else if (et == EventType::REOPEN && !closed_pool.empty()) {
                int chosen = closed_pool.back();
                closed_pool.pop_back();
                const auto& [u, v, w] = inst.initial_edges[chosen % m_init];
                ev.edge_id = chosen;
                ev.u = u;
                ev.v = v;
                ev.new_weight = std::max<int64_t>(8, w - 5);
            } else if (seq_profile == SequenceProfile::ADVERSARIAL_TREE_ATTACK) {
                // Deliberately pick a live tree edge from initial edges if possible
                const auto& p_edges = temp.parent_edges();
                std::vector<int> tree_eids;
                for (int pe : p_edges) {
                    if (pe >= 0 && pe < m_init) tree_eids.push_back(pe);
                }
                int chosen = tree_eids.empty()
                             ? std::uniform_int_distribution<int>(0, m_init - 1)(rng)
                             : tree_eids[std::uniform_int_distribution<size_t>(0, tree_eids.size() - 1)(rng)];
                const auto& [u, v, w] = inst.initial_edges[chosen];
                ev.edge_id = chosen;
                ev.u = u;
                ev.v = v;
                ev.new_weight = w + 150;
                if (et == EventType::CLOSE) closed_pool.push_back(chosen);
            } else {
                int chosen = std::uniform_int_distribution<int>(0, m_init - 1)(rng);
                const auto& [u, v, w] = inst.initial_edges[chosen];
                ev.edge_id = chosen;
                ev.u = u;
                ev.v = v;
                if (et == EventType::DECREASE) {
                    ev.new_weight = std::max<int64_t>(1, w / 2);
                } else if (et == EventType::INCREASE) {
                    ev.new_weight = w + 80;
                } else {
                    ev.new_weight = w;
                    if (et == EventType::CLOSE) closed_pool.push_back(chosen);
                }
            }

            inst.events.push_back(ev);
        }

        return inst;
    }
};

} // namespace pathforge

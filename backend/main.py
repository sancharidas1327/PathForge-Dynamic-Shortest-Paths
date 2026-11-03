"""
PathForge Backend Server — Starlette/ASGI Research & Benchmarking API
Integrates directly with the compiled C++17 Witness-Guarded Dynamic SSSP Engine.
"""

import csv
import ctypes
import io
import json
import os
import platform
import subprocess
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

from starlette.applications import Starlette
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.routing import Route

ROOT_DIR = Path(__file__).resolve().parent.parent
ENGINE_DIR = ROOT_DIR / "engine"
BIN_DIR = ENGINE_DIR / "bin"
RESULTS_DIR = Path(__file__).resolve().parent / "results"
RESULTS_DIR.mkdir(parents=True, exist_ok=True)


def get_engine_binary() -> Path:
    exe_name = "pathforge_cli.exe" if os.name == "nt" else "pathforge_cli"
    bin_path = BIN_DIR / exe_name
    if bin_path.exists():
        return bin_path

    # Auto-compile if missing (e.g., inside Docker or fresh checkout)
    BIN_DIR.mkdir(parents=True, exist_ok=True)
    compiler = "g++"
    if os.name == "nt" and Path(r"C:\msys64\ucrt64\bin\g++.exe").exists():
        compiler = r"C:\msys64\ucrt64\bin\g++.exe"

    cmd = [
        compiler,
        "-std=c++17",
        "-O3",
        f"-I{ENGINE_DIR / 'include'}",
        str(ENGINE_DIR / "src" / "pathforge_cli.cpp"),
        "-o",
        str(bin_path),
    ]
    if os.name == "nt":
        cmd.append("-static")
    subprocess.run(cmd, check=True)
    return bin_path


_SHARED_LIB: Any = None


def get_engine_shared_lib() -> Any:
    global _SHARED_LIB
    if _SHARED_LIB is not None:
        return _SHARED_LIB

    lib_name = "pathforge_engine.dll" if os.name == "nt" else "libpathforge_engine.so"
    lib_path = BIN_DIR / lib_name
    if not lib_path.exists():
        BIN_DIR.mkdir(parents=True, exist_ok=True)
        compiler = "g++"
        if os.name == "nt" and Path(r"C:\msys64\ucrt64\bin\g++.exe").exists():
            compiler = r"C:\msys64\ucrt64\bin\g++.exe"
        cmd = [
            compiler,
            "-std=c++17",
            "-O3",
            "-shared",
            f"-I{ENGINE_DIR / 'include'}",
            str(ENGINE_DIR / "src" / "pathforge_cli.cpp"),
            "-o",
            str(lib_path),
        ]
        if os.name == "nt":
            cmd.append("-static")
        else:
            cmd.append("-fPIC")
        subprocess.run(cmd, check=True)

    _SHARED_LIB = ctypes.CDLL(str(lib_path))
    _SHARED_LIB.pathforge_run_command.argtypes = [ctypes.c_char_p, ctypes.c_char_p]
    _SHARED_LIB.pathforge_run_command.restype = ctypes.c_int
    return _SHARED_LIB


def run_cpp_engine(args: List[str], timeout: int = 60) -> Dict[str, Any]:
    lib = get_engine_shared_lib()
    with tempfile.NamedTemporaryFile("w+", suffix=".json", delete=False, encoding="utf-8") as out_f:
        out_path = out_f.name

    try:
        cmd_line = " ".join(str(a) for a in args)
        rc = lib.pathforge_run_command(cmd_line.encode("utf-8"), out_path.encode("utf-8"))
        content = Path(out_path).read_text(encoding="utf-8").strip()
        if rc != 0 and not content:
            raise RuntimeError(f"C++ Engine returned error code {rc}")
        return json.loads(content)
    finally:
        if os.path.exists(out_path):
            try:
                os.remove(out_path)
            except OSError:
                pass


def get_default_research_graph() -> Dict[str, Any]:
    """Default curated 10-vertex directed weighted research graph with rich witness paths and backup detours."""
    return {
        "num_vertices": 10,
        "source": 0,
        "target_vertex": 9,
        "invalidation_budget": 0.35,
        "mode": "B1",
        "nodes": [
            {"id": 0, "label": "v0 (Src)", "x": 80, "y": 240},
            {"id": 1, "label": "v1", "x": 230, "y": 110},
            {"id": 2, "label": "v2", "x": 230, "y": 370},
            {"id": 3, "label": "v3", "x": 410, "y": 90},
            {"id": 4, "label": "v4", "x": 410, "y": 240},
            {"id": 5, "label": "v5", "x": 410, "y": 390},
            {"id": 6, "label": "v6", "x": 600, "y": 130},
            {"id": 7, "label": "v7", "x": 600, "y": 350},
            {"id": 8, "label": "v8", "x": 770, "y": 130},
            {"id": 9, "label": "v9 (Dst)", "x": 820, "y": 270},
        ],
        "initial_edges": [
            {"id": 0, "u": 0, "v": 1, "weight": 12, "live": True},
            {"id": 1, "u": 0, "v": 2, "weight": 18, "live": True},
            {"id": 2, "u": 0, "v": 4, "weight": 34, "live": True},
            {"id": 3, "u": 1, "v": 3, "weight": 14, "live": True},
            {"id": 4, "u": 1, "v": 4, "weight": 11, "live": True},
            {"id": 5, "u": 2, "v": 4, "weight": 9, "live": True},
            {"id": 6, "u": 2, "v": 5, "weight": 15, "live": True},
            {"id": 7, "u": 3, "v": 6, "weight": 13, "live": True},
            {"id": 8, "u": 4, "v": 6, "weight": 19, "live": True},
            {"id": 9, "u": 4, "v": 7, "weight": 16, "live": True},
            {"id": 10, "u": 5, "v": 7, "weight": 12, "live": True},
            {"id": 11, "u": 6, "v": 8, "weight": 11, "live": True},
            {"id": 12, "u": 6, "v": 9, "weight": 29, "live": True},
            {"id": 13, "u": 7, "v": 9, "weight": 15, "live": True},
            {"id": 14, "u": 8, "v": 9, "weight": 10, "live": True},
            {"id": 15, "u": 3, "v": 8, "weight": 38, "live": True},
        ],
        "events": [
            {"event_id": 1, "type": "INCREASE", "edge_id": 2, "u": 0, "v": 4, "new_weight": 65},
            {"event_id": 2, "type": "CLOSE", "edge_id": 4, "u": 1, "v": 4, "new_weight": 11},
            {"event_id": 3, "type": "DECREASE", "edge_id": 15, "u": 3, "v": 8, "new_weight": 16},
            {"event_id": 4, "type": "INSERT", "edge_id": -1, "u": 5, "v": 9, "new_weight": 18},
            {"event_id": 5, "type": "REOPEN", "edge_id": 4, "u": 1, "v": 4, "new_weight": 8},
        ],
    }


def evaluate_graph_session(payload: Dict[str, Any]) -> Dict[str, Any]:
    num_vertices = int(payload.get("num_vertices", 10))
    source = int(payload.get("source", 0))
    budget = float(payload.get("invalidation_budget", 0.35))
    mode = str(payload.get("mode", "B1")).upper()
    target_vertex = int(payload.get("target_vertex", max(0, num_vertices - 1)))

    initial_edges = payload.get("initial_edges", [])
    events = payload.get("events", [])

    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False, encoding="utf-8") as tf:
        tf_path = tf.name
        tf.write(f"{num_vertices} {source} {budget} {mode} {target_vertex}\n")
        tf.write(f"{len(initial_edges)}\n")
        for e in initial_edges:
            u = int(e["u"])
            v = int(e["v"])
            w = int(e["weight"])
            live = 1 if e.get("live", True) else 0
            tf.write(f"{u} {v} {w} {live}\n")

        tf.write(f"{len(events)}\n")
        for idx, ev in enumerate(events):
            ev_id = int(ev.get("event_id", idx + 1))
            ev_type = str(ev.get("type", "INSERT")).upper()
            eid = int(ev.get("edge_id", -1))
            u = int(ev.get("u", 0))
            v = int(ev.get("v", 1))
            nw = int(ev.get("new_weight", 10))
            tf.write(f"{ev_id} {ev_type} {eid} {u} {v} {nw}\n")

    try:
        engine_out = run_cpp_engine(["session", tf_path])
        if "nodes" in payload:
            engine_out["nodes"] = payload["nodes"]
        return engine_out
    finally:
        if os.path.exists(tf_path):
            os.remove(tf_path)


async def health_endpoint(request: Request) -> JSONResponse:
    lib = get_engine_shared_lib()
    return JSONResponse({
        "status": "healthy",
        "service": "PathForge Witness-Guarded Dynamic SSSP API",
        "cpp_engine_binary": "pathforge_engine.dll" if os.name == "nt" else "libpathforge_engine.so",
        "cpp_engine_ready": lib is not None,
        "platform": platform.platform(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })


async def default_workspace_endpoint(request: Request) -> JSONResponse:
    default_graph = get_default_research_graph()
    evaluated = evaluate_graph_session(default_graph)
    return JSONResponse({
        "preset": default_graph,
        "engine_state": evaluated,
    })


async def evaluate_session_endpoint(request: Request) -> JSONResponse:
    try:
        body = await request.json()
        result = evaluate_graph_session(body)
        return JSONResponse(result)
    except Exception as exc:
        return JSONResponse({"error": str(exc)}, status_code=400)


async def verify_correctness_endpoint(request: Request) -> JSONResponse:
    try:
        res = run_cpp_engine(["verify"])
        return JSONResponse(res)
    except Exception as exc:
        return JSONResponse({"error": str(exc)}, status_code=500)


async def run_benchmark_endpoint(request: Request) -> JSONResponse:
    try:
        body = await request.json() if request.method == "POST" else {}
    except Exception:
        body = {}

    family = str(body.get("family", "SPARSE_RANDOM"))
    sequence = str(body.get("sequence", "MIXED_REALISTIC"))
    vertices = max(10, min(5000, int(body.get("vertices", 400))))
    edges = max(15, min(25000, int(body.get("edges", 1600))))
    events = max(5, min(2000, int(body.get("events", 150))))
    closure_rate = max(0.0, min(0.8, float(body.get("closure_rate", 0.05))))
    seed = int(body.get("seed", 42))
    source = max(0, min(vertices - 1, int(body.get("source", 0))))
    budget = max(0.02, min(1.0, float(body.get("invalidation_budget", 0.35))))
    reps = max(1, min(10, int(body.get("repetitions", 1))))

    args = [
        "benchmark",
        "--family", family,
        "--sequence", sequence,
        "--vertices", str(vertices),
        "--edges", str(edges),
        "--events", str(events),
        "--closure-rate", str(closure_rate),
        "--seed", str(seed),
        "--source", str(source),
        "--budget", str(budget),
        "--reps", str(reps),
    ]

    try:
        res = run_cpp_engine(args, timeout=90)
        res["metadata"] = {
            "run_id": f"bench_{int(time.time() * 1000)}",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "algorithm_version": "PathForge-v1.0.0-CPP17-O3",
            "hardware_env": f"{platform.system()} {platform.release()} ({platform.machine()})",
            "compiler": "GCC 14.2.0 (-std=c++17 -O3)",
        }
        latest_file = RESULTS_DIR / "latest_benchmark.json"
        latest_file.write_text(json.dumps(res, indent=2), encoding="utf-8")
        return JSONResponse(res)
    except Exception as exc:
        return JSONResponse({"error": str(exc)}, status_code=500)


async def export_benchmark_endpoint(request: Request) -> Response:
    fmt = request.query_params.get("format", "json").lower()
    latest_file = RESULTS_DIR / "latest_benchmark.json"
    if not latest_file.exists():
        res = run_cpp_engine(["benchmark"])
        res["metadata"] = {
            "run_id": f"bench_{int(time.time() * 1000)}",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "algorithm_version": "PathForge-v1.0.0-CPP17-O3",
            "hardware_env": f"{platform.system()} {platform.release()} ({platform.machine()})",
        }
        latest_file.write_text(json.dumps(res, indent=2), encoding="utf-8")
    else:
        res = json.loads(latest_file.read_text(encoding="utf-8"))

    if fmt == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "Mode Code", "Mode Label", "Total Time (us)", "Avg Latency (us)",
            "P99 Latency (us)", "Max Latency (us)", "Full Rebuilds",
            "Invalidated Vertices", "Recomputed Vertices", "Recursive Repairs",
            "Live Edges", "Allocated Edges", "Unsupported Events",
            "Correctness Violations", "Peak Memory (KB)"
        ])
        for m in res.get("modes", []):
            writer.writerow([
                m["code"], m["label"], m["total_time_us"], m["avg_latency_us"],
                m["p99_latency_us"], m["max_latency_us"], m["rebuilds"],
                m["invalidated_vertices"], m["recomputed_vertices"], m["recursive_repairs"],
                m["live_edges"], m["total_edges_allocated"], m["unsupported_events"],
                m["correctness_violations"], m["peak_memory_kb"]
            ])
        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=pathforge_benchmark.csv"},
        )

    return Response(
        content=json.dumps(res, indent=2),
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=pathforge_benchmark.json"},
    )


routes = [
    Route("/api/health", health_endpoint, methods=["GET"]),
    Route("/api/workspace/default", default_workspace_endpoint, methods=["GET"]),
    Route("/api/workspace/evaluate", evaluate_session_endpoint, methods=["POST"]),
    Route("/api/verify", verify_correctness_endpoint, methods=["GET", "POST"]),
    Route("/api/benchmark/run", run_benchmark_endpoint, methods=["GET", "POST"]),
    Route("/api/benchmark/export", export_benchmark_endpoint, methods=["GET"]),
]

middleware = [
    Middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
]

app = Starlette(debug=False, routes=routes, middleware=middleware)

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)

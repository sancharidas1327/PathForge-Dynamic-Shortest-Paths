import asyncio
import json
from starlette.requests import Request
from main import (
    health_endpoint,
    default_workspace_endpoint,
    verify_correctness_endpoint,
    run_benchmark_endpoint,
)


def make_req(method: str = "GET", body: dict | None = None) -> Request:
    raw = json.dumps(body).encode("utf-8") if body else b""
    scope = {
        "type": "http",
        "method": method,
        "path": "/",
        "headers": [(b"content-type", b"application/json")],
        "query_string": b"",
    }
    async def receive():
        return {"type": "http.request", "body": raw, "more_body": False}
    return Request(scope, receive)


def test_health_endpoint():
    res = asyncio.run(health_endpoint(make_req()))
    assert res.status_code == 200
    data = json.loads(res.body)
    assert data["status"] == "healthy"
    assert data["cpp_engine_ready"] is True


def test_default_workspace():
    res = asyncio.run(default_workspace_endpoint(make_req()))
    assert res.status_code == 200
    data = json.loads(res.body)
    assert "preset" in data
    assert "engine_state" in data
    assert data["engine_state"]["correctness"]["passed"] is True
    assert data["engine_state"]["num_vertices"] == 10


def test_verify_correctness():
    res = asyncio.run(verify_correctness_endpoint(make_req()))
    assert res.status_code == 200
    data = json.loads(res.body)
    assert data["all_passed"] is True
    assert data["passed_suites"] == 11


def test_run_benchmark():
    res = asyncio.run(run_benchmark_endpoint(make_req("POST", {
        "family": "SPARSE_RANDOM",
        "sequence": "MIXED_REALISTIC",
        "vertices": 120,
        "edges": 400,
        "events": 40,
        "closure_rate": 0.05,
        "seed": 42,
        "source": 0,
        "invalidation_budget": 0.35,
        "repetitions": 1
    })))
    assert res.status_code == 200
    data = json.loads(res.body)
    assert "modes" in data
    assert len(data["modes"]) == 6
    assert "size_sweep" in data
    assert "closure_sweep" in data
    assert data["modes"][1]["correctness_violations"] == 0

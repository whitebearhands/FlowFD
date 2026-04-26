"""
LangGraph StateGraph 파이프라인.
CrewAI 제거 후 LangGraph로 전면 교체.
병렬 실행: asyncio.gather 사용.
"""

import asyncio
from typing import Literal

from langgraph.graph import END, StateGraph

from app.core.firestore import update_job_state
from app.crew.nodes import (
    api_designer_node,
    backend_architect_node,
    context_builder_node,
    cps_critic_node,
    data_modeler_node,
    design_critic_node,
    development_planner_node,
    fact_extractor_node,
    feature_writer_node,
    frontend_architect_node,
    goal_definer_node,
    nonfunc_writer_node,
    performance_designer_node,
    prd_critic_node,
    problem_definer_node,
    risk_writer_node,
    scope_definer_node,
    security_designer_node,
    sentiment_analyzer_node,
    solution_synthesizer_node,
    system_architect_node,
    technical_analyzer_node,
    user_researcher_node,
)
from app.crew.schemas import PipelineState


# ─────────────────────────────────────────
# 병렬 실행 래퍼
# ─────────────────────────────────────────


async def _run_parallel(state: PipelineState, *node_fns) -> dict:
    """여러 노드를 asyncio.gather로 병렬 실행 후 결과 병합."""
    loop = asyncio.get_event_loop()
    tasks = [loop.run_in_executor(None, fn, state) for fn in node_fns]
    results = await asyncio.gather(*tasks)
    merged = {}
    for r in results:
        merged.update(r)
    return merged


# ─────────────────────────────────────────
# 복합 노드 (병렬 그룹)
# ─────────────────────────────────────────


async def phase1_parallel_node(state: PipelineState) -> dict:
    """Layer 1: fact_extractor + sentiment_analyzer 병렬."""
    return await _run_parallel(
        state,
        fact_extractor_node,
        sentiment_analyzer_node,
    )


async def phase2a_parallel_node(state: PipelineState) -> dict:
    """Layer 2: context_builder + problem_definer + technical_analyzer 병렬."""
    return await _run_parallel(
        state,
        context_builder_node,
        problem_definer_node,
        technical_analyzer_node,
    )


async def phase3a_parallel_node(state: PipelineState) -> dict:
    """Layer 5: goal_definer + user_researcher + scope_definer 병렬."""
    return await _run_parallel(
        state,
        goal_definer_node,
        user_researcher_node,
        scope_definer_node,
    )


async def phase3b_parallel_node(state: PipelineState) -> dict:
    """Layer 6: feature_writer + nonfunc_writer + risk_writer 병렬."""
    return await _run_parallel(
        state,
        feature_writer_node,
        nonfunc_writer_node,
        risk_writer_node,
    )


async def phase4a_parallel_node(state: PipelineState) -> dict:
    """Layer 9: data_modeler + api_designer + frontend_architect + backend_architect 병렬."""
    return await _run_parallel(
        state,
        data_modeler_node,
        api_designer_node,
        frontend_architect_node,
        backend_architect_node,
    )


async def phase4b_parallel_node(state: PipelineState) -> dict:
    """Layer 10: security_designer + performance_designer 병렬."""
    return await _run_parallel(
        state,
        security_designer_node,
        performance_designer_node,
    )


# ─────────────────────────────────────────
# Conditional Edge 라우터
# ─────────────────────────────────────────


def route_after_cps_critic(
    state: PipelineState,
) -> Literal["cps_retry", "phase3_start"]:
    block_issues = [
        i for i in (state.get("issues") or []) if i.get("severity") == "block"
    ]
    if not block_issues:
        return "phase3_start"
    retry_count = (state.get("retry_count") or {}).get("cps", 0)
    if retry_count < 2:
        return "cps_retry"
    return "phase3_start"  # 2회 초과 → warn 강등 후 통과


def route_after_prd_critic(
    state: PipelineState,
) -> Literal["prd_retry", "phase4_start"]:
    block_issues = [
        i
        for i in (state.get("issues") or [])
        if i.get("severity") == "block" and i.get("phase") == "prd"
    ]
    if not block_issues:
        return "phase4_start"
    retry_count = (state.get("retry_count") or {}).get("prd", 0)
    if retry_count < 2:
        return "prd_retry"
    return "phase4_start"


def cps_retry_node(state: PipelineState) -> dict:
    """CPS retry: 재시도 카운트 증가 후 solution_synthesizer부터 재실행."""
    retry_count = dict(state.get("retry_count") or {})
    retry_count["cps"] = retry_count.get("cps", 0) + 1
    # block 이슈 제거 (재시도 전 초기화)
    issues = [i for i in (state.get("issues") or []) if i.get("severity") != "block"]
    return {"retry_count": retry_count, "issues": issues}


def prd_retry_node(state: PipelineState) -> dict:
    """PRD retry: 재시도 카운트 증가."""
    retry_count = dict(state.get("retry_count") or {})
    retry_count["prd"] = retry_count.get("prd", 0) + 1
    issues = [
        i
        for i in (state.get("issues") or [])
        if not (i.get("severity") == "block" and i.get("phase") == "prd")
    ]
    return {"retry_count": retry_count, "issues": issues}


# ─────────────────────────────────────────
# Phase 1+2 그래프 (CPS 분석)
# ─────────────────────────────────────────


def build_cps_graph() -> StateGraph:
    g = StateGraph(PipelineState)

    g.add_node("phase1", phase1_parallel_node)
    g.add_node("phase2a", phase2a_parallel_node)
    g.add_node("solution_synthesizer", solution_synthesizer_node)
    g.add_node("cps_critic", cps_critic_node)
    g.add_node("cps_retry", cps_retry_node)

    g.set_entry_point("phase1")
    g.add_edge("phase1", "phase2a")
    g.add_edge("phase2a", "solution_synthesizer")
    g.add_edge("solution_synthesizer", "cps_critic")
    g.add_conditional_edges(
        "cps_critic",
        route_after_cps_critic,
        {
            "cps_retry": "cps_retry",
            "phase3_start": END,
        },
    )
    g.add_edge("cps_retry", "solution_synthesizer")

    return g.compile()


# ─────────────────────────────────────────
# Phase 3 그래프 (PRD)
# ─────────────────────────────────────────


def build_prd_graph() -> StateGraph:
    g = StateGraph(PipelineState)

    g.add_node("phase3a", phase3a_parallel_node)
    g.add_node("phase3b", phase3b_parallel_node)
    g.add_node("prd_critic", prd_critic_node)
    g.add_node("prd_retry", prd_retry_node)

    g.set_entry_point("phase3a")
    g.add_edge("phase3a", "phase3b")
    g.add_edge("phase3b", "prd_critic")
    g.add_conditional_edges(
        "prd_critic",
        route_after_prd_critic,
        {
            "prd_retry": "prd_retry",
            "phase4_start": END,
        },
    )
    g.add_edge("prd_retry", "phase3b")

    return g.compile()


# ─────────────────────────────────────────
# Phase 4 그래프 (설계)
# ─────────────────────────────────────────


def build_design_graph() -> StateGraph:
    g = StateGraph(PipelineState)

    g.add_node("system_architect", system_architect_node)
    g.add_node("phase4a", phase4a_parallel_node)
    g.add_node("phase4b", phase4b_parallel_node)
    g.add_node("design_critic", design_critic_node)
    g.add_node("development_planner", development_planner_node)

    g.set_entry_point("system_architect")
    g.add_edge("system_architect", "phase4a")
    g.add_edge("phase4a", "phase4b")
    g.add_edge("phase4b", "design_critic")
    g.add_edge("design_critic", "development_planner")
    g.add_edge("development_planner", END)

    return g.compile()


# ─────────────────────────────────────────
# 실행 진입점
# ─────────────────────────────────────────


async def run_cps_pipeline(initial_state: PipelineState) -> PipelineState:
    await update_job_state(
        initial_state["job_id"],
        {
            "status": "processing",
            "current_node": "phase1",
            "total_layers": 4,
        },
    )
    graph = build_cps_graph()
    result = await graph.ainvoke(initial_state)
    await update_job_state(
        initial_state["job_id"],
        {
            "status": "completed",
            "coins_used": 5 if initial_state.get("analysis_mode") == "smart" else 8,
        },
    )
    return result


async def run_prd_pipeline(initial_state: PipelineState) -> PipelineState:
    await update_job_state(
        initial_state["job_id"],
        {
            "status": "processing",
            "current_node": "phase3a",
            "total_layers": 3,
        },
    )
    graph = build_prd_graph()
    result = await graph.ainvoke(initial_state)
    await update_job_state(
        initial_state["job_id"],
        {
            "status": "completed",
            "coins_used": 10,
        },
    )
    return result


async def run_design_pipeline(initial_state: PipelineState) -> PipelineState:
    await update_job_state(
        initial_state["job_id"],
        {
            "status": "processing",
            "current_node": "system_architect",
            "total_layers": 4,
        },
    )
    graph = build_design_graph()
    result = await graph.ainvoke(initial_state)
    await update_job_state(
        initial_state["job_id"],
        {
            "status": "completed",
            "coins_used": 15,
        },
    )
    return result

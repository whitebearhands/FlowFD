from fastapi.responses import JSONResponse
import json
from urllib.parse import quote

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.responses import Response
from pydantic import BaseModel

from app.core.auth import CurrentUser, get_current_user
from app.core.firestore import get_db
from app.jobs import design_generator_job
from app.services.design_service import (
    create_job,
    get_design,
    save_architecture,
    save_plan,
)
from app.core.billing_deps import raise_if_insufficient
from app.core.credits import CREDITS_DESIGN
from app.services import billing_service
from app.services.project_service import get_project, resolve_project_params
from app.services.github_markdown import design_to_markdown

router = APIRouter(prefix="/projects/{project_id}", tags=["plan"])


class GenerateDesignRequest(BaseModel):
    tech_stack: dict[str, str]
    constraints: list[str] = []
    llm_model: str | None = None


class JobResponse(BaseModel):
    job_id: str
    status: str


class DesignResponse(BaseModel):
    plan: dict | None = None
    architecture: dict | None = None
    updated_at: str | None = None


class UpdateDesignRequest(BaseModel):
    plan: dict | None = None
    architecture: dict | None = None


def _check_project(db, group_id: str, project_id: str) -> None:
    if get_project(db, group_id, project_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found",
        )


@router.post("/design/test/generate")
async def generate_design_test(
    project_id: str,
    body: GenerateDesignRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> JobResponse:
    db = get_db()
    group_id, real_project_id = resolve_project_params(project_id, current_user.group_id)
    _check_project(db, group_id, real_project_id)

    if group_id == "samples":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sample projects are read-only",
        )
    job_id = create_job(db, group_id, real_project_id, "design_generation")
    design = await design_generator_job.run(
        db,
        group_id,
        real_project_id,
        job_id,
        current_user.user_id,
        body.tech_stack,
        body.constraints,
    )
    return JSONResponse(content=design)


@router.post("/design/generate", response_model=JobResponse, status_code=202)
async def generate_design(
    project_id: str,
    body: GenerateDesignRequest,
    background_tasks: BackgroundTasks,
    current_user: CurrentUser = Depends(get_current_user),
) -> JobResponse:
    db = get_db()

    credits = billing_service.get_credits(db, current_user.user_id)
    raise_if_insufficient(credits["total_credits"], CREDITS_DESIGN)
    billing_service.deduct_credits(
        db, current_user.user_id, CREDITS_DESIGN, "Design Generation"
    )

    group_id, real_project_id = resolve_project_params(project_id, current_user.group_id)
    _check_project(db, group_id, real_project_id)

    if group_id == "samples":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sample projects are read-only",
        )
    job_id = create_job(db, group_id, real_project_id, "design_generation")
    background_tasks.add_task(
        design_generator_job.run,
        db,
        group_id,
        real_project_id,
        job_id,
        current_user.user_id,
        body.tech_stack,
        body.constraints,
    )
    return JobResponse(job_id=job_id, status="processing")


@router.get("/design", response_model=DesignResponse)
async def get_design_endpoint(
    project_id: str,
    current_user: CurrentUser = Depends(get_current_user),
) -> DesignResponse:
    db = get_db()
    group_id, real_project_id = resolve_project_params(project_id, current_user.group_id)
    _check_project(db, group_id, real_project_id)
    design = get_design(db, group_id, real_project_id)
    if design is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Design not found. Generate design first.",
        )
    return DesignResponse(
        plan=design.get("plan"),
        architecture=design.get("architecture"),
        updated_at=str(design.get("updated_at", "")),
    )


@router.patch("/design", status_code=204)
async def update_design_endpoint(
    project_id: str,
    body: UpdateDesignRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> None:
    db = get_db()
    group_id, real_project_id = resolve_project_params(project_id, current_user.group_id)
    _check_project(db, group_id, real_project_id)

    if group_id == "samples":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sample projects are read-only",
        )

    if body.plan is not None:
        save_plan(db, group_id, real_project_id, body.plan)
    if body.architecture is not None:
        save_architecture(db, group_id, real_project_id, body.architecture)


@router.get("/design/export")
async def export_design(
    project_id: str,
    current_user: CurrentUser = Depends(get_current_user),
) -> Response:
    db = get_db()
    group_id, real_project_id = resolve_project_params(project_id, current_user.group_id)
    _check_project(db, group_id, real_project_id)
    design = get_design(db, group_id, real_project_id)
    if design is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Design not found"
        )
    project = get_project(db, group_id, real_project_id)
    project_name = (project.name if project else None) or project_id
    md = design_to_markdown(design)
    safe_name = project_name.replace(" ", "_").replace("/", "_")
    filename = f"design_{safe_name}.md"
    encoded_filename = quote(filename)
    return Response(
        content=md.encode("utf-8"),
        media_type="text/markdown; charset=utf-8",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}",
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


def _design_to_markdown(design: dict, project_name: str) -> str:
    """Design JSON → 마크다운 문자열 변환."""
    updated_at = design.get("updated_at", "")
    if hasattr(updated_at, "isoformat"):
        updated_at = updated_at.isoformat()

    arch_raw = design.get("architecture")
    try:
        sections: dict = (
            json.loads(arch_raw) if isinstance(arch_raw, str) else (arch_raw or {})
        )
    except Exception:
        sections = {}

    plan = design.get("plan", "")

    lines: list[str] = []
    lines.append(f"# 아키텍처 설계: {project_name}")
    lines.append(f"> 생성일: {updated_at}")
    lines.append("")

    # 개발 계획
    if plan:
        lines.append("## 개발 계획")
        lines.append(str(plan))
        lines.append("")

    # 시스템 아키텍처
    sys_arch = sections.get("system_architecture")
    if sys_arch and isinstance(sys_arch, dict):
        lines.append("## 시스템 아키텍처")
        if sys_arch.get("data_flow"):
            lines.append(f"**데이터 흐름**: {sys_arch['data_flow']}")
            lines.append("")
        tech = sys_arch.get("tech_stack")
        if tech and isinstance(tech, dict):
            lines.append("### 기술 스택")
            for k, v in tech.items():
                lines.append(f"- **{k}**: {v}")
            lines.append("")
        components = sys_arch.get("components")
        if components and isinstance(components, list):
            lines.append("### 컴포넌트")
            for c in components:
                name = c.get("name") or c.get("type", "")
                desc = c.get("description") or c.get("responsibility", "")
                lines.append(f"- **{name}**: {desc}")
            lines.append("")
        decisions = sys_arch.get("design_decisions")
        if decisions and isinstance(decisions, list):
            lines.append("### 주요 설계 결정")
            for d in decisions:
                title = d.get("decision") or d.get("title", "")
                reason = d.get("reason") or d.get("rationale", "")
                lines.append(f"**{title}**")
                if reason:
                    lines.append(f"{reason}")
                lines.append("")

    # 데이터 모델
    data_model = sections.get("data_model")
    if data_model and isinstance(data_model, dict):
        lines.append("## 데이터 모델")
        collections = data_model.get("collections") or data_model.get("tables", [])
        if collections:
            for col in collections:
                name = col.get("table_name") or col.get("name", "")
                lines.append(f"### {name}")
                fields = col.get("columns") or col.get("fields", [])
                if fields:
                    lines.append("| 필드 | 타입 | 속성 |")
                    lines.append("|------|------|------|")
                    for f in fields:
                        pk = (
                            " PK"
                            if (
                                f.get("pk")
                                or "PRIMARY KEY"
                                in str(f.get("constraints", "")).upper()
                            )
                            else ""
                        )
                        fk = (
                            " FK"
                            if (
                                f.get("fk")
                                or "REFERENCES" in str(f.get("constraints", "")).upper()
                            )
                            else ""
                        )
                        lines.append(
                            f"| {f.get('name','')} | {f.get('type','')} | {pk}{fk} |"
                        )
                lines.append("")
        relationships = data_model.get("relationships", [])
        if relationships:
            lines.append("### 관계")
            for r in relationships:
                if isinstance(r, dict):
                    lines.append(
                        f"- {r.get('from','')} → {r.get('to','')} ({r.get('type','')})"
                    )
            lines.append("")
        indexes = data_model.get("indexes", [])
        if indexes:
            lines.append("### 인덱스")
            for idx in indexes:
                if isinstance(idx, dict):
                    cols = ", ".join(idx.get("columns", []))
                    lines.append(
                        f"- `{idx.get('name','')}` on {idx.get('table','')}({cols}) [{idx.get('type','')}]"
                    )
            lines.append("")

    # API 명세
    api_spec = sections.get("api_spec")
    if api_spec and isinstance(api_spec, dict):
        lines.append("## API 명세")
        endpoints = api_spec.get("endpoints", [])
        if endpoints:
            lines.append("| 메서드 | 엔드포인트 | 설명 | 도메인 |")
            lines.append("|--------|-----------|------|--------|")
            for ep in endpoints:
                lines.append(
                    f"| {ep.get('method','')} | `{ep.get('path',ep.get('endpoint',''))}` | {ep.get('description','')} | {ep.get('domain','—')} |"
                )
        lines.append("")

    # 보안 설계
    security = sections.get("security_design")
    if security and isinstance(security, dict):
        lines.append("## 보안 설계")
        for sec_key, sec_val in security.items():
            label = sec_key.replace("_", " ").title()
            lines.append(f"### {label}")
            lines.append(_nested_to_md(sec_val, depth=0))
            lines.append("")

    # 성능/캐싱
    perf = sections.get("performance_design")
    if perf and isinstance(perf, dict):
        lines.append("## 성능 / 캐싱")
        caching = perf.get("caching", [])
        if caching:
            lines.append("### 캐싱 전략")
            for c in caching:
                if isinstance(c, dict):
                    lines.append(
                        f"**{c.get('strategy','')}**: {c.get('description','')}"
                    )
                    if c.get("implementation_details"):
                        lines.append(f"  - 구현: {c['implementation_details']}")
            lines.append("")
        bottlenecks = perf.get("bottlenecks", [])
        if bottlenecks:
            lines.append("### 병목 포인트")
            for b in bottlenecks:
                if isinstance(b, dict):
                    lines.append(
                        f"- **{b.get('component','')}**: {b.get('description','')} → 대응: {b.get('mitigation','')}"
                    )
            lines.append("")

    return "\n".join(lines)


def _nested_to_md(obj: object, depth: int = 0) -> str:
    """중첩 객체를 들여쓰기 마크다운으로 변환."""
    indent = "  " * depth
    if isinstance(obj, str):
        return f"{indent}{obj}"
    if isinstance(obj, list):
        return "\n".join(f"{indent}- {_nested_to_md(item, 0)}" for item in obj)
    if isinstance(obj, dict):
        parts = []
        for k, v in obj.items():
            label = k.replace("_", " ")
            if isinstance(v, (dict, list)):
                parts.append(f"{indent}- **{label}**:")
                parts.append(_nested_to_md(v, depth + 1))
            else:
                parts.append(f"{indent}- **{label}**: {v}")
        return "\n".join(parts)
    return f"{indent}{obj}"

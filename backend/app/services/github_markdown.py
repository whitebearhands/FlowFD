"""CPS / PRD / Design / Meeting → GitHub 업로드용 Markdown 변환."""

from __future__ import annotations


def _v(val: object) -> str:
    """None이면 '—', datetime이면 isoformat, 나머지는 str."""
    if val is None or val == "":
        return "—"
    if hasattr(val, "isoformat"):
        return val.isoformat()
    return str(val)


def cps_to_markdown(cps: dict) -> str:
    meta = cps.get("meta") or {}
    ctx = cps.get("context") or {}
    prob = cps.get("problem") or {}
    sol = cps.get("solution") or {}
    assumptions = cps.get("assumptions") or []
    out_of_scope = cps.get("out_of_scope") or []
    risks = cps.get("risks") or {}
    pending = cps.get("pending") or {}
    log = cps.get("decision_log") or []

    lines: list[str] = [
        f"# CPS — {_v(meta.get('client'))}",
        "",
        f"> Version: `{_v(meta.get('version'))}` | Updated: {_v(meta.get('last_updated'))}",
        "",
        "---",
        "",
        "## Context",
        "",
        f"**Background**  \n{_v(ctx.get('background'))}",
        "",
        f"**Environment**  \n{_v(ctx.get('environment'))}",
        "",
        f"**Stakeholders**  \n{_v(ctx.get('stakeholders'))}",
        "",
        f"**Constraints**  \n{_v(ctx.get('constraints'))}",
        "",
        "---",
        "",
        "## Problem",
        "",
        f"**Business Problem**  \n{_v(prob.get('business_problem'))}",
        "",
        f"**Technical Problem**  \n{_v(prob.get('technical_problem'))}",
        "",
        f"**Impact**  \n{_v(prob.get('impact'))}",
        "",
    ]

    rc = prob.get("root_cause") or {}
    lines += [
        f"**Root Cause** _(confidence: {_v(rc.get('confidence'))})_  \n{_v(rc.get('content'))}",
        "",
        "---",
        "",
        "## Solution",
        "",
        f"**Proposed by Client**  \n{_v(sol.get('proposed_by_client'))}",
        "",
        f"**Proposed by FDE**  \n{_v(sol.get('proposed_by_fde'))}",
        "",
    ]

    hyp = sol.get("hypothesis") or {}
    lines += [
        f"**Hypothesis** _(confidence: {_v(hyp.get('confidence'))})_  \n{_v(hyp.get('content'))}",
        "",
        f"**Success Criteria**  \n{_v(sol.get('success_criteria'))}",
        "",
    ]

    if assumptions:
        lines += ["---", "", "## Assumptions", ""]
        for a in assumptions or []:
            a = a or {}
            lines += [
                f"- {_v(a.get('content'))}",
                f"  - _Risk if wrong: {_v(a.get('risk_if_wrong'))}_",
            ]
        lines.append("")

    if out_of_scope:
        lines += ["---", "", "## Out of Scope", ""]
        for item in out_of_scope:
            lines.append(f"- {item}")
        lines.append("")

    tech = risks.get("technical") or []
    biz = risks.get("business") or []
    if tech or biz:
        lines += ["---", "", "## Risks", ""]
        if tech:
            lines += ["**Technical**", ""]
            for r in tech:
                lines.append(f"- {r}")
            lines.append("")
        if biz:
            lines += ["**Business**", ""]
            for r in biz:
                lines.append(f"- {r}")
            lines.append("")

    qs = pending.get("questions") or []
    ins = pending.get("insights") or []
    ideas = pending.get("solution_ideas") or []
    if qs or ins or ideas:
        lines += ["---", "", "## Pending", ""]
        if qs:
            lines += ["**Questions**", ""]
            for q in qs:
                lines.append(f"- [ ] {q}")
            lines.append("")
        if ins:
            lines += ["**Insights**", ""]
            for i in ins:
                lines.append(f"- {i}")
            lines.append("")
        if ideas:
            lines += ["**Solution Ideas**", ""]
            for s in ideas:
                lines.append(f"- {s}")
            lines.append("")

    if log:
        lines += [
            "---",
            "",
            "## Decision Log",
            "",
            "| Meeting | Changed | Reason |",
            "|---|---|---|",
        ]
        for entry in log:
            e = entry or {}
            lines.append(
                f"| {_v(e.get('meeting_id'))} | {_v(e.get('changed'))} | {_v(e.get('reason'))} |"
            )
        lines.append("")

    return "\n".join(lines)


def prd_to_markdown(prd: dict, version: str = "") -> str:
    raw = prd.get("content") or {}
    content = raw if isinstance(raw, dict) else {}

    overview = content.get("overview") or ""
    goals = content.get("goals") or {}
    users = content.get("users") or []
    scope = content.get("scope") or {}
    features = content.get("features") or []
    non_functional = content.get("non_functional") or []
    risks = content.get("risks") or []
    open_questions = content.get("open_questions") or []

    lines: list[str] = ["# PRD — Product Requirements Document", ""]
    if version:
        lines += [f"> Version: `{version}`", ""]

    if overview:
        lines += ["## Overview", "", overview, ""]

    business_goals = (
        goals.get("business_goals") or [] if isinstance(goals, dict) else []
    )
    success_metrics = (
        goals.get("success_metrics") or [] if isinstance(goals, dict) else []
    )
    if business_goals or success_metrics:
        lines += ["---", "", "## Goals", ""]
        if business_goals:
            lines += ["**Business Goals**", ""]
            for g in business_goals:
                lines.append(f"- {g}")
            lines.append("")
        if success_metrics:
            lines += [
                "**Success Metrics**",
                "",
                "| Metric | AS-IS | TO-BE |",
                "|---|---|---|",
            ]
            for m in success_metrics:
                m = m or {}
                lines.append(
                    f"| {_v(m.get('metric'))} | {_v(m.get('before'))} | {_v(m.get('after'))} |"
                )
            lines.append("")

    if users:
        lines += ["---", "", "## Users", ""]
        for u in users:
            u = u or {}
            lines += [
                f"### {_v(u.get('type'))}",
                f"- **Goal:** {_v(u.get('goal'))}",
                f"- **Pain:** {_v(u.get('pain'))}",
                f"- **Frequency:** {_v(u.get('frequency'))}",
                "",
            ]

    if features:
        lines += ["---", "", "## Feature Requirements", ""]
        for f in features:
            f = f or {}
            lines += [
                f"### `{_v(f.get('id'))}` {_v(f.get('title'))} — _{_v(f.get('priority'))}_",
                "",
                _v(f.get("description")),
                "",
            ]

    in_scope = scope.get("in_scope") or [] if isinstance(scope, dict) else []
    oos = scope.get("out_of_scope") or [] if isinstance(scope, dict) else []
    if in_scope or oos:
        lines += ["---", "", "## Scope", ""]
        if in_scope:
            lines += [
                "**In Scope**",
                "",
                "| ID | Description | Priority |",
                "|---|---|---|",
            ]
            for s in in_scope:
                s = s or {}
                lines.append(
                    f"| {_v(s.get('fr_id'))} | {_v(s.get('description'))} | {_v(s.get('priority'))} |"
                )
            lines.append("")
        if oos:
            lines += ["**Out of Scope**", ""]
            for s in oos:
                lines.append(f"- {s}")
            lines.append("")

    if non_functional:
        lines += [
            "---",
            "",
            "## Non-Functional Requirements",
            "",
            "| Category | Requirement | Metric |",
            "|---|---|---|",
        ]
        for nf in non_functional:
            nf = nf or {}
            lines.append(
                f"| {_v(nf.get('category'))} | {_v(nf.get('requirement'))} | {_v(nf.get('metric'))} |"
            )
        lines.append("")

    if risks:
        lines += ["---", "", "## Risks", ""]
        for r in risks:
            r = r or {}
            lines.append(f"- {_v(r.get('description'))}")
        lines.append("")

    if open_questions:
        lines += ["---", "", "## Open Questions", ""]
        for q in open_questions:
            lines.append(f"- [ ] {q}")
        lines.append("")

    return "\n".join(lines)


def design_to_markdown(design: dict) -> str:
    lines: list[str] = ["# Architecture & Development Plan", ""]

    plan = design.get("plan") or {}
    arch = design.get("architecture") or {}

    if plan:
        phases = plan.get("phases") or []
        milestones = plan.get("milestones") or []
        critical_path = plan.get("critical_path") or []
        notes = plan.get("notes") or ""

        lines += ["## Development Plan", ""]
        for ph in phases:
            ph = ph or {}
            lines += [
                f"### {_v(ph.get('phase_name'))}",
                "",
                _v(ph.get("description")),
                "",
            ]
            for t in ph.get("tasks") or []:
                t = t or {}
                deps = ", ".join(t.get("dependencies") or []) or "—"
                lines.append(
                    f"- **{_v(t.get('task_name'))}**: {_v(t.get('description'))} _(deps: {deps})_"
                )
            lines.append("")

        if milestones:
            lines += ["### Milestones", ""]
            for m in milestones:
                m = m or {}
                lines.append(f"- **{_v(m.get('title'))}**: {_v(m.get('description'))}")
            lines.append("")

        if critical_path:
            lines += ["### Critical Path", ""]
            for step in critical_path:
                lines.append(f"- {step}")
            lines.append("")

        if notes:
            lines += ["### Notes", "", notes, ""]

    sys_arch = arch.get("system_architecture") or {}
    if sys_arch:
        lines += ["---", "", "## System Architecture", ""]
        components = sys_arch.get("components") or []
        if components:
            lines += [
                "### Components",
                "",
                "| Name | Type | Description |",
                "|---|---|---|",
            ]
            for c in components:
                c = c or {}
                lines.append(
                    f"| {_v(c.get('name'))} | {_v(c.get('type'))} | {_v(c.get('description'))} |"
                )
            lines.append("")

        tech_stack = sys_arch.get("tech_stack") or {}
        if tech_stack:
            lines += ["### Tech Stack", "", "| Area | Technology |", "|---|---|"]
            for k, v in tech_stack.items():
                lines.append(f"| {k} | {_v(v)} |")
            lines.append("")

        data_flow = sys_arch.get("data_flow") or ""
        if data_flow:
            lines += ["### Data Flow", "", data_flow, ""]

    dm = arch.get("data_model") or {}
    if dm:
        lines += ["---", "", "## Data Model", ""]
        for col in dm.get("collections") or []:
            col = col or {}
            lines += [
                f"### `{_v(col.get('table_name'))}`",
                "",
                "| Field | Type | Constraints |",
                "|---|---|---|",
            ]
            for field in col.get("columns") or []:
                field = field or {}
                lines.append(
                    f"| {_v(field.get('name'))} | {_v(field.get('type'))} | {_v(field.get('constraints'))} |"
                )
            lines.append("")

    api = arch.get("api_spec") or {}
    if api:
        lines += ["---", "", "## API Spec", ""]
        auth = api.get("auth") or ""
        if auth:
            lines += [f"**Auth:** {auth}", ""]
        endpoints = api.get("endpoints") or []
        if endpoints:
            lines += ["| Method | Path | Description |", "|---|---|---|"]
            for ep in endpoints:
                ep = ep or {}
                lines.append(
                    f"| {_v(ep.get('method'))} | `{_v(ep.get('path'))}` | {_v(ep.get('description'))} |"
                )
            lines.append("")

    sec = arch.get("security_design") or {}
    if sec:
        lines += ["---", "", "## Security Design", ""]
        for key, label in [
            ("authentication", "Authentication"),
            ("authorization", "Authorization"),
            ("data_protection", "Data Protection"),
            ("api_security", "API Security"),
        ]:
            item = sec.get(key) or {}
            detail = item.get("details") or "" if isinstance(item, dict) else str(item)
            if detail:
                lines += [f"**{label}**  \n{detail}", ""]

    fe = arch.get("frontend_arch") or {}
    if fe:
        lines += ["---", "", "## Frontend Architecture", ""]
        routing = fe.get("routing") or []
        if routing:
            lines += [
                "### Routing",
                "",
                "| Path | Component | Description |",
                "|---|---|---|",
            ]
            for r in routing:
                r = r or {}
                lines.append(
                    f"| `{_v(r.get('path'))}` | {_v(r.get('component'))} | {_v(r.get('description'))} |"
                )
            lines.append("")
        components = fe.get("components") or []
        if components:
            lines += ["### Components", "", "| Name | Description |", "|---|---|"]
            for c in components:
                c = c or {}
                lines.append(f"| {_v(c.get('name'))} | {_v(c.get('description'))} |")
            lines.append("")
        state_mgmt = fe.get("state_management") or ""
        if state_mgmt:
            lines += [f"**State Management**  \n{state_mgmt}", ""]
        api_deps = fe.get("api_dependencies") or []
        if api_deps:
            lines += [
                "### API Dependencies",
                "",
                "| Endpoint | Method | Description |",
                "|---|---|---|",
            ]
            for d in api_deps:
                d = d or {}
                lines.append(
                    f"| `{_v(d.get('endpoint'))}` | {_v(d.get('method'))} | {_v(d.get('description'))} |"
                )
            lines.append("")

    be = arch.get("backend_arch") or {}
    if be:
        lines += ["---", "", "## Backend Architecture", ""]
        layers = be.get("layers") or {}
        if isinstance(layers, dict):
            for layer_key, layer_label in [
                ("routers", "Routers"),
                ("services", "Services"),
                ("repositories", "Repositories"),
            ]:
                items = layers.get(layer_key) or []
                if items:
                    lines += [
                        f"### {layer_label}",
                        "",
                        "| Name | Description |",
                        "|---|---|",
                    ]
                    for item in items:
                        item = item or {}
                        lines.append(
                            f"| {_v(item.get('name'))} | {_v(item.get('description'))} |"
                        )
                    lines.append("")
        jobs = be.get("jobs") or []
        if jobs:
            lines += [
                "### Background Jobs",
                "",
                "| Name | Schedule | Description |",
                "|---|---|---|",
            ]
            for j in jobs:
                j = j or {}
                lines.append(
                    f"| {_v(j.get('name'))} | {_v(j.get('schedule'))} | {_v(j.get('description'))} |"
                )
            lines.append("")
        integrations = be.get("external_integrations") or []
        if integrations:
            lines += [
                "### External Integrations",
                "",
                "| Name | Description |",
                "|---|---|",
            ]
            for i in integrations:
                i = i or {}
                lines.append(f"| {_v(i.get('name'))} | {_v(i.get('description'))} |")
            lines.append("")

    perf = arch.get("performance_design") or {}
    if perf:
        lines += ["---", "", "## Performance Design", ""]
        caching = perf.get("caching") or []
        if caching:
            lines += ["### Caching", ""]
            for c in caching:
                c = c or {}
                lines += [
                    f"**{_v(c.get('strategy'))}**  \n{_v(c.get('description'))}",
                    f"- Implementation: {_v(c.get('implementation_details'))}",
                    f"- Invalidation: {_v(c.get('cache_invalidation'))}",
                    "",
                ]
        query_opts = perf.get("query_optimization") or []
        if query_opts:
            lines += [
                "### Query Optimization",
                "",
                "| Query Type | Optimization | Details |",
                "|---|---|---|",
            ]
            for q in query_opts:
                q = q or {}
                lines.append(
                    f"| {_v(q.get('query_type'))} | {_v(q.get('optimization'))} | {_v(q.get('details'))} |"
                )
            lines.append("")
        scaling = perf.get("scaling") or ""
        if scaling:
            lines += [f"**Scaling**  \n{scaling}", ""]
        bottlenecks = perf.get("bottlenecks") or []
        if bottlenecks:
            lines += [
                "### Bottlenecks",
                "",
                "| Component | Description | Mitigation |",
                "|---|---|---|",
            ]
            for b in bottlenecks:
                b = b or {}
                lines.append(
                    f"| {_v(b.get('component'))} | {_v(b.get('description'))} | {_v(b.get('mitigation'))} |"
                )
            lines.append("")

    return "\n".join(lines)


def meeting_to_markdown(meeting: dict) -> str:
    title = meeting.get("title") or "(Untitled)"
    date = _v(meeting.get("date"))
    participants = meeting.get("participants") or []
    content = meeting.get("content") or ""

    parts_str = ", ".join(str(p) for p in participants) if participants else "—"

    lines: list[str] = [
        f"# {title}",
        "",
        f"> Date: {date} | Participants: {parts_str}",
        "",
        "---",
        "",
        content,
    ]
    return "\n".join(lines)


def readme_to_markdown(project_name: str, client: str, description: str | None) -> str:
    lines: list[str] = [
        f"# {project_name}",
        "",
        f"> Client: {client}",
        "",
    ]
    if description:
        lines += [description, ""]
    lines += [
        "## Documents",
        "",
        "- [CPS](docs/cps.md) — Context-Problem-Solution",
        "- [PRD](docs/prd.md) — Product Requirements Document",
        "- [Design](docs/design.md) — Architecture & Development Plan",
        "- [Meetings](docs/meetings/) — Meeting records",
        "",
        "---",
        "",
        "_Generated by [FlowFD](https://app.flowfd.com)_",
    ]
    return "\n".join(lines)

# FlowFD — LangGraph 파이프라인 설계

## 개요

미팅 원본을 CPS → PRD → 설계 문서로 변환하는 23개 노드 파이프라인.
LangGraph + LangChain(Gemini) 기반. 백그라운드 잡으로 실행.
CrewAI 제거 — OpenAI 의존성 문제로 LangGraph로 전면 교체.

---

## 실행 단위

| 트리거 | 실행 Phase | 코인 소모 |
|--------|-----------|-----------|
| 미팅 저장 (스마트 분석) | Phase 1 + 2 | 5코인 |
| 미팅 저장 (전체 재분석) | Phase 1 + 2 | 8코인 |
| PRD 생성 버튼 | Phase 3 | 10코인 |
| 설계 생성 버튼 | Phase 4 | 15코인 |
| 전체 파이프라인 | Phase 1~4 | 30코인 |

---

## 기술 스택

```
LangGraph       StateGraph 기반 파이프라인 오케스트레이션
LangChain       LLM 호출 추상화
langchain-google-genai  Gemini 모델 연동
Pydantic        입출력 스키마 검증
```

---

## 파이프라인 구조

### State 정의

```python
class PipelineState(TypedDict):
    # 입력
    new_meeting: str
    existing_cps: dict | None
    meeting_summaries: list[str]
    analysis_mode: str              # "smart" | "full"
    job_id: str

    # Phase 1 결과
    cleaned_transcript: str
    meeting_summary: str
    extracted_facts: dict
    sentiment_report: dict

    # Phase 2 결과
    context_draft: dict
    problem_draft: dict
    technical_draft: dict
    solution_draft: dict
    validated_cps: dict
    cps_score: int

    # Phase 3 결과
    goals_draft: dict
    users_draft: dict
    scope_draft: dict
    features_draft: dict
    nonfunc_draft: dict
    risks_draft: dict
    validated_prd: dict

    # Phase 4 결과
    system_architecture: dict
    data_model: dict
    api_spec: dict
    frontend_arch: dict
    backend_arch: dict
    security_design: dict
    performance_design: dict
    validated_design: dict

    # 제어
    retry_count: dict
    pending_questions: list[str]
    issues: list[dict]
    error: str | None
```

---

## 노드 구성 (23개)

### Phase 1 — 미팅 분석 (병렬 실행)

| 노드 | 역할 | 모델 |
|------|------|------|
| meeting_cleaner | 원본 정제 + 요약본 생성 | gemini-2.5-flash-lite |
| fact_extractor | 사실 정보만 추출 | gemini-2.5-flash-lite |
| sentiment_analyzer | 이해관계자 감정 파악 | gemini-2.5-flash-lite |

→ `phase1_fan_in`: 세 결과 state에 병합

### Phase 2 — CPS 구성 (부분 병렬)

| 노드 | 역할 | 모델 |
|------|------|------|
| context_builder | Context 섹션 작성 | gemini-2.5-flash |
| problem_definer | Problem 섹션 작성 | gemini-2.5-flash |
| technical_analyzer | 기술적 원인 분석 | gemini-3.1-flash-lite-preview |
| solution_synthesizer | Solution 섹션 종합 | gemini-3.1-flash-lite-preview |
| cps_critic | CPS 검증 + 스코어링 | gemini-3.1-flash |

→ context_builder, problem_definer, technical_analyzer 병렬  
→ solution_synthesizer 순차  
→ cps_critic 순차 (Conditional Edge: block → retry / pass → Phase 3)

### Phase 3 — PRD (부분 병렬)

| 노드 | 역할 | 모델 |
|------|------|------|
| goal_definer | 비즈니스 목표 | gemini-3.1-flash-lite-preview |
| user_researcher | 사용자 정의 | gemini-2.5-flash-lite |
| scope_definer | 범위 정의 | gemini-2.5-flash-lite |
| feature_writer | FR 카드 작성 | gemini-3.1-flash |
| nonfunc_writer | 비기능 요구사항 | gemini-2.5-flash-lite |
| risk_writer | 리스크/미결 사항 | gemini-3.1-flash-lite-preview |
| prd_critic | PRD 검증 | gemini-3.1-flash |

→ goal_definer, user_researcher, scope_definer 병렬  
→ feature_writer, nonfunc_writer, risk_writer 병렬  
→ prd_critic 순차

### Phase 4 — 설계 (부분 병렬)

| 노드 | 역할 | 모델 |
|------|------|------|
| system_architect | 전체 아키텍처 | gemini-3.1-flash |
| data_modeler | ERD / DB 스키마 | gemini-3.1-flash |
| api_designer | API 명세 | gemini-3.1-flash |
| frontend_architect | 프론트엔드 구조 | gemini-3.1-flash-lite-preview |
| backend_architect | 백엔드 구조 | gemini-3.1-flash |
| security_designer | 보안 설계 | gemini-3.1-flash |
| performance_designer | 성능/캐싱 전략 | gemini-3.1-flash-lite-preview |
| design_critic | 설계 검증 | gemini-3.1-flash |

→ system_architect 순차 (선행 필요)  
→ data_modeler, api_designer, frontend_architect, backend_architect 병렬  
→ security_designer, performance_designer 병렬  
→ design_critic 순차

---

## 실행 레이어 (병렬 최적화)

```
Layer 1:  meeting_cleaner, fact_extractor, sentiment_analyzer   병렬  ~10초
Layer 2:  context_builder, problem_definer, technical_analyzer  병렬  ~10초
Layer 3:  solution_synthesizer                                  순차  ~10초
Layer 4:  cps_critic                                            순차  ~10초
────────────────────── Phase 1+2 완료 ~40초
Layer 5:  goal_definer, user_researcher, scope_definer          병렬  ~10초
Layer 6:  feature_writer, nonfunc_writer, risk_writer           병렬  ~15초
Layer 7:  prd_critic                                            순차  ~10초
────────────────────── Phase 3 완료 ~35초
Layer 8:  system_architect                                      순차  ~15초
Layer 9:  data_modeler, api_designer, frontend_architect,
          backend_architect                                     병렬  ~15초
Layer 10: security_designer, performance_designer              병렬  ~10초
Layer 11: design_critic                                         순차  ~10초
────────────────────── Phase 4 완료 ~50초
총 예상: ~2분
```

---

## 재작업 처리

```python
RETRY_POLICY = {
    "insufficient_data":  {"retry": False, "action": "move_to_pending"},
    "quality_issue":      {"retry": True,  "max_retries": 2, "fallback": "warn"},
    "consistency_error":  {"retry": True,  "max_retries": 2},
    "system_error":       {"retry": True,  "max_retries": 3, "backoff": "exponential"},
    "scope_creep":        {"retry": False, "action": "delete_and_log"},
}
```

### Conditional Edge 라우팅

```python
def route_after_cps_critic(state: PipelineState) -> str:
    issues = [i for i in state["issues"] if i["severity"] == "block"]
    if not issues:
        return "phase3_start"
    retry_count = state["retry_count"].get("cps", 0)
    if retry_count < 2:
        return "cps_retry"
    return "phase3_start"   # 2회 초과 시 warn으로 강등 후 통과
```

---

## 컨텍스트 구조

```python
# Phase 1+2 노드 공통 입력
{
    "new_meeting": str,              # 새 미팅 원본 전체
    "existing_cps": dict | None,    # 기존 CPS
    "meeting_summaries": list[str], # 기존 미팅 요약본 (압축)
    "analysis_mode": "smart" | "full"
}
# 스마트: new_meeting + existing_cps + meeting_summaries
# 전체 재분석: 모든 summaries + new_meeting (existing_cps 무시)
```

---

## 모델 믹스

```python
MODEL_CONFIG= {
    # 단순 정제/추출
    "meeting_cleaner": "gemini-2.5-flash-lite",
    "fact_extractor": "gemini-2.5-flash-lite",
    "sentiment_analyzer": "gemini-2.5-flash-lite",
    "user_researcher": "gemini-2.5-flash-lite",
    "scope_definer": "gemini-2.5-flash-lite",
    "nonfunc_writer": "gemini-2.5-flash-lite",
    "frontend_architect": "gemini-2.5-flash-lite",
    "performance_designer": "gemini-2.5-flash-lite",
    # 분류/분석
    "context_builder": "gemini-2.5-flash",
    "problem_definer": "gemini-2.5-flash",
    # 판단/종합
    "technical_analyzer": "gemini-3-flash-preview",
    "solution_synthesizer": "gemini-3-flash-preview",
    "goal_definer": "gemini-3-flash-preview",
    "risk_writer": "gemini-3-flash-preview",
    # Critic + 핵심 설계
    "cps_critic": "gemini-3-flash-preview",
    "feature_writer": "gemini-3-flash-preview",
    "prd_critic": "gemini-3-flash-preview",
    "system_architect": "gemini-3-flash-preview",
    "data_modeler": "gemini-3-flash-preview",
    "api_designer": "gemini-3-flash-preview",
    "backend_architect": "gemini-3-flash-preview",
    "security_designer": "gemini-3-flash-preview",
    "design_critic": "gemini-3-flash-preview",
}
```

---

## CPS 품질 스코어

```
90~100  confirmed 필드 대부분     초록 배지
70~89   probable 위주             파란 배지
50~69   suspected 많음            주황 배지 + "추가 미팅 권장"
0~49    데이터 심각하게 부족       빨간 배지 + "분석 품질 낮음"
```

---

## Firestore Job 상태 스키마

```
jobs/{jobId}
  ├── type: "cps_analysis" | "prd_generation" | "design_generation"
  ├── status: "pending" | "processing" | "completed" | "failed"
  ├── analysis_mode: "smart" | "full"
  ├── current_layer: 4
  ├── total_layers: 11
  ├── current_node: "cps_critic"
  ├── completed_nodes: ["meeting_cleaner ✓", ...]
  ├── issues: [{type, severity, field, message}]
  ├── pending_added: ["다음 미팅에서 확인 필요: ..."]
  ├── coins_used: 5
  ├── created_at: timestamp
  └── completed_at: timestamp | null
```

---

## 설정 옵션 (사용자별)

```
settings/automation
  ├── default_analysis_mode: "smart" | "full"  (기본: smart)
  ├── auto_regenerate_prd: bool                (기본: false)
  └── auto_regenerate_cps: bool                (기본: false)
```

---

## 패키지

```
uv add langgraph langchain langchain-google-genai
uv remove crewai
```
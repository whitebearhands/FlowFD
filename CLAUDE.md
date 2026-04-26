# FlowFD

## 필수 문서 (작업 전 반드시 읽을 것)

@docs/naming.md
@docs/design.md
@docs/prd.md
@docs/cps_prompt.md
@docs/ui.md
@docs/landing.md
@docs/crew.md
@docs/paddle.md
@docs/legal.md

---

## 프로젝트 개요

`FlowFD`는 Forward Deployed Engineer(FDE)의 업무를 자동화하는 SaaS 플랫폼이다.
미팅 내용을 CPS(Context/Problem/Solution) 문서로 구조화하고,
PRD 생성 → 설계 → 코드 생성 → GitHub sync까지 이어지는 파이프라인을 제공한다.

---

## 레포 구조

```
easyfd/
  ├── CLAUDE.md
  ├── frontend/     Next.js (App Router, TypeScript, Tailwind)
  ├── backend/      FastAPI (Python 3.13, uv)
  └── docs/
```

---

## 도메인 구조

```
www.flowfd.com   → 랜딩 페이지 (서비스 소개, 로그인/시작하기 버튼)
app.flowfd.com   → SaaS 앱 (로그인 후 실제 서비스)
```

하나의 Next.js 앱에서 미들웨어로 서브도메인을 분기한다.

```
frontend/
  ├── middleware.ts          ← 서브도메인 분기 핵심
  ├── app/
  │     ├── (landing)/       ← www.flowfd.com
  │     │     └── page.tsx     랜딩 페이지
  │     ├── (auth)/          ← app.flowfd.com/login 등
  │     └── (app)/           ← app.flowfd.com/dashboard 등
  └── ...
```

`middleware.ts` 동작 방식:
- `app.flowfd.com` 접속 → `/app/*` 경로로 rewrite
- `www.flowfd.com` 접속 → 랜딩 페이지 그대로

---

## 핵심 데이터 구조 원칙

FlowFD는 그룹(FDE 팀/회사) 개념을 중심으로 설계된다.
나중에 RAG 시스템을 추가해서 그룹 내 모든 프로젝트 경험을 검색할 수 있어야 한다.
**이 구조는 처음부터 반드시 지켜야 한다. 나중에 바꾸면 전체 마이그레이션이 필요하다.**

### Firestore 구조

```
groups/{groupId}                    # FDE 팀/회사
  - name: string
  - created_at: timestamp

  └── members/{userId}              # 그룹 멤버
        - role: "admin" | "member"
        - joined_at: timestamp

  └── projects/{projectId}          # 프로젝트는 그룹 하위
        └── meetings/{meetingId}
        └── cps/{version}
        └── prd/{version}
        └── design/{docId}
        └── codes/{codeId}
        └── github_syncs/{syncId}
        └── jobs/{jobId}

users/{userId}                      # 사용자 프로필
  - email: string
  - display_name: string
  - group_id: string                # 소속 그룹 참조
  - created_at: timestamp
  - settings:
      llm: { ... }
      github: { ... }
```

### 데이터 접근 규칙

```
개인 설정   users/{userId}              본인만 접근
프로젝트    groups/{groupId}/projects/  같은 그룹 멤버 접근 가능
RAG 검색    그룹 내 전체 프로젝트       (향후 구현)
```

### 반드시 지켜야 할 구조 규칙

- `users/{userId}/projects/` 구조는 절대 사용하지 않는다
- 모든 프로젝트는 반드시 `groups/{groupId}/projects/` 하위에 생성한다
- 1인 사용자도 가입 시 기본 그룹을 자동 생성해서 그 하위에 넣는다
- 가입 시 그룹 생성(신규) 또는 그룹 초대코드 입력(기존 팀 합류) 선택

---

## 향후 확장 계획 (현재 구현하지 않음)

아래 기능은 현재 구현 범위 밖이다. 단, 위 Firestore 구조를 지키면 나중에 자연스럽게 추가 가능하다.

- **RAG 시스템**: 그룹 내 모든 프로젝트의 CPS/PRD/코드를 벡터 인덱싱해서 유사 문제 해결 사례 검색
- **팀 협업**: 같은 그룹 멤버가 동일 프로젝트 공동 작업
- **그룹 대시보드**: 팀 전체 프로젝트 현황 한눈에 보기

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | Next.js (App Router), TypeScript, Tailwind |
| Hosting | Firebase Hosting |
| Backend | FastAPI, Python 3.13, uv |
| Backend Infra | Cloud Run |
| Database | Firestore |
| Auth | Firebase Auth |
| LLM 오케스트레이션 | LangGraph + LangChain |
| LLM 기본 모델 | gemini-2.5-flash (모델 믹스, crew.md 참고) |
| GitHub 연동 | PyGithub |
| Python 린터 | Ruff |
| 다국어 | next-intl (한국어/영어) |

### LLM 패키지 (uv add)
```
langgraph
langchain
langchain-google-genai
langchain-anthropic
langchain-openai
```

---

## 다국어 (i18n)

### 지원 언어
- `ko` 한국어 (기본값)
- `en` 영어

### 규칙
- UI 텍스트는 하드코딩 금지. 반드시 `next-intl`의 `useTranslations()` 훅을 사용한다
- 번역 파일 위치: `frontend/messages/en.json`, `frontend/messages/ko.json`
- 언어 설정은 `users/{userId}.settings.locale`에 저장
- 기본값: `ko`

### 콘텐츠 언어 (CPS/PRD 생성)
- LLM이 미팅 내용의 언어를 자동 감지한다
- CPS/PRD는 미팅과 같은 언어로 생성한다
- 프롬프트에 반드시 포함: `"Detect the language of the meeting content and generate the output in the same language."`

### 타임존
- 사용자 설정에 타임존 저장: `users/{userId}.settings.timezone`
- 기본값: `Asia/Seoul`
- 날짜/시간 표시는 항상 사용자 타임존 기준으로 변환

### 향후 추가 언어
- 일본어, 중국어 등은 `messages/` 파일 추가만으로 확장 가능하도록 설계

---

## 네이밍 규칙 요약

상세 규칙은 `@docs/naming.md` 참고. 아래는 핵심만.

### Python
- 클래스: PascalCase → `MeetingService`, `CpsAnalyzerJob`
- 함수/변수: snake_case → `create_meeting()`, `meeting_id`
- 파일: snake_case → `meeting_service.py`
- 접미사 규칙: 라우터 `Router`, 서비스 `Service`, 잡 `Job`
- 요청/응답: `CreateMeetingRequest`, `CreateMeetingResponse`

### TypeScript
- 컴포넌트/타입: PascalCase → `MeetingCard`, `CpsDocument`
- 함수/변수: camelCase → `createMeeting()`, `meetingId`
- 컴포넌트 파일: PascalCase → `MeetingCard.tsx`
- 유틸/훅/api 파일: camelCase → `meetingApi.ts`, `useCps.ts`

### 도메인 용어 (변경 금지)
- 미팅: `meeting` (session, conversation 사용 금지)
- CPS 문서: `cps` (analysis, summary 사용 금지)
- PRD 문서: `prd` (spec, requirement 사용 금지)
- 백그라운드 잡: `job` (task, worker 사용 금지)

---

## 백엔드 폴더 구조

```
backend/
  ├── app/
  │     ├── main.py
  │     ├── routers/
  │     ├── services/
  │     ├── jobs/
  │     │     ├── cps_analyzer_job.py     # CrewAI Phase 1+2 실행
  │     │     ├── prd_updater_job.py      # CrewAI Phase 3 실행
  │     │     └── design_generator_job.py # CrewAI Phase 4 실행
  │     ├── crew/
  │     │     ├── nodes.py               # 23개 에이전트 정의
  │     │     ├── pipeline.py             # Phase별 파이프라인
  │     │     └── schemas.py              # 입출력 스키마
  │     ├── models/
  │     ├── prompts/
  │     │     ├── prompt.py           # CPS_SYSTEM_PROMPT
  │     └── core/
  └── tests/
```

## 프론트엔드 폴더 구조

```
frontend/
  ├── middleware.ts             # 서브도메인 분기 (www vs app)
  ├── app/
  │     ├── (landing)/          # www.flowfd.com
  │     │     └── page.tsx        랜딩 페이지
  │     ├── (auth)/             # app.flowfd.com/login 등
  │     └── (app)/              # app.flowfd.com/dashboard 등
  ├── components/
  │     ├── landing/            # 랜딩 페이지 전용 컴포넌트
  │     ├── meeting/
  │     ├── cps/
  │     ├── prd/
  │     ├── code/
  │     ├── github/
  │     └── ui/
  ├── messages/
  │     ├── en.json
  │     └── ko.json
  ├── lib/
  │     ├── api/
  │     ├── firebase/
  │     └── utils/
  └── types/
```

---

## 배포 구조

```
GitHub (easyfd 모노레포)
  ├── frontend/ 변경 → Firebase App Hosting 자동 배포
  └── backend/  변경 → Cloud Run 자동 배포
```

GitHub Actions 워크플로우 파일:
```
.github/
  └── workflows/
        ├── deploy-frontend.yml   # frontend/** 변경 시 트리거
        └── deploy-backend.yml    # backend/** 변경 시 트리거
```

---

## 작업 원칙

- 내가 요청한 것만 만든다. 요청하지 않은 기능을 미리 만들지 않는다
- 각 Step이 끝나면 반드시 확인을 받고 다음으로 넘어간다
- 네이밍 규칙을 임의로 바꾸지 않는다
- 모든 코드는 Ruff 린팅을 통과해야 한다

---

## UI 컴포넌트

- UI는 shadcn/ui를 기본으로 사용한다
- 필요한 컴포넌트는 `npx shadcn@latest add {component}` 로 추가한다
- shadcn으로 커버 안 되는 것만 `components/ui/` 에 직접 만든다
- 스타일은 Tailwind 유틸리티 클래스만 사용한다. 인라인 style 속성 사용 금지

---

## 작업 순서

```
Step 1.  프로젝트 기반 세팅              ✓ 완료
Step 2.  Firebase Auth + 그룹 연동       ✓ 완료
Step 3.  프로젝트 CRUD                   ✓ 완료
Step 4.  미팅 CRUD + Firestore 저장      ✓ 완료
Step 5.  CPS 자동 생성 (Langgraph)       ✓ 완료
Step 6.  CPS 자동 업데이트 (백그라운드 잡) ✓ 완료
Step 7.  PRD 생성 및 업데이트            ✓ 완료
Step 8.  설계 문서 생성                  ✓ 완료
Step 9.  PRD 화면 개선 (칸반)            ✓ 완료
Step 10. 미팅 저장 파이프라인 알림        ✓ 완료
Step 11. GitHub Sync                    ✓ 완료
Step 12. Paddle 결제 연동                ✓ 완료(sandbox)
Step 13. Pricing / Terms / Privacy / Refund 페이지   ✓ 완료
Step 14. Automation Pipeline 저장 및 적용    ✓ 완료
Step 15. Analyze Mode 에 따른 분석 방법 선택  ✓ 완료
────────────── 개발을 위한 설계서 완성 목표
Step 16. 사용자 LLM Token 사용 지원(OpenAI,Claude,Gemini)
Step 17. 코드 생성 + Ruff 린팅 (나중에)
Step 18. Group 기능 강화(그룹 데이터 RAG, 프로젝트 공유)
Step 19. 외부툴 연동(jira, slack, teams...)
Step 20. 미팅작성시 stt 사용 가능하도록 업데이트
Step 21. 모바일/태블릿 버젼 개발
```
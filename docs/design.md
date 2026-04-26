# FlowFD — 설계 문서

**Version**: 1.0.0  
**Date**: 2026-04-14  

---

## 1. API 명세

### 공통 규칙

- Base URL: `https://api.sample.com/v1`
- 모든 요청 헤더: `Authorization: Bearer {firebase_jwt}`
- 모든 응답 형식: JSON
- 에러 형식:
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "설명"
  }
}
```

---

### 1.1 프로젝트 API

**GET** `/projects`  
사용자의 프로젝트 목록 조회

Response:
```json
{
  "projects": [
    {
      "project_id": "string",
      "name": "string",
      "client": "string",
      "status": "active | archived",
      "last_meeting_at": "datetime",
      "created_at": "datetime"
    }
  ]
}
```

---

**POST** `/projects`  
프로젝트 생성

Request:
```json
{
  "name": "string",
  "client": "string",
  "description": "string | null",
  "tags": ["string"]
}
```

Response:
```json
{
  "project_id": "string",
  "name": "string",
  "client": "string",
  "created_at": "datetime"
}
```

---

**GET** `/projects/{project_id}`  
프로젝트 상세 조회

Response:
```json
{
  "project_id": "string",
  "name": "string",
  "client": "string",
  "description": "string | null",
  "tags": ["string"],
  "status": "active | archived",
  "github_repo": "string | null",
  "created_at": "datetime",
  "last_meeting_at": "datetime"
}
```

---

**PATCH** `/projects/{project_id}`  
프로젝트 수정 (부분 업데이트)

Request:
```json
{
  "name": "string | null",
  "description": "string | null",
  "status": "active | archived | null",
  "tags": ["string"] | null
}
```

---

### 1.2 미팅 API

**GET** `/projects/{project_id}/meetings`  
미팅 목록 조회 (시간순)

Response:
```json
{
  "meetings": [
    {
      "meeting_id": "string",
      "title": "string | null",
      "date": "date",
      "participants": ["string"],
      "analysis_status": "pending | processing | completed | failed",
      "created_at": "datetime"
    }
  ]
}
```

---

**POST** `/projects/{project_id}/meetings`  
미팅 기록 추가 → 저장 후 CPS/PRD 분석 백그라운드 트리거

Request:
```json
{
  "title": "string | null",
  "date": "date",
  "participants": ["string"],
  "content": "string"
}
```

Response:
```json
{
  "meeting_id": "string",
  "analysis_status": "processing",
  "created_at": "datetime"
}
```

---

**GET** `/projects/{project_id}/meetings/{meeting_id}`  
미팅 상세 조회 (원본 포함)

Response:
```json
{
  "meeting_id": "string",
  "title": "string | null",
  "date": "date",
  "participants": ["string"],
  "content": "string",
  "analysis_status": "pending | processing | completed | failed",
  "created_at": "datetime"
}
```

---

### 1.3 CPS API

**GET** `/projects/{project_id}/cps`  
현재 CPS 조회 (최신 버전)

Response:
```json
{
  "version": "string",
  "cps": { /* CPS 스키마 전체 */ },
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

---

**GET** `/projects/{project_id}/cps/history`  
CPS 버전 히스토리

Response:
```json
{
  "versions": [
    {
      "version": "string",
      "changed_fields": ["string"],
      "source_meeting_id": "string | null",
      "change_type": "auto | manual_edit",
      "created_at": "datetime"
    }
  ]
}
```

---

**GET** `/projects/{project_id}/cps/{version}`  
특정 버전 CPS 조회

---

**PATCH** `/projects/{project_id}/cps`  
CPS 수동 편집 → decision_log에 "manual_edit" 기록

Request:
```json
{
  "field_path": "string",
  "value": "any",
  "reason": "string | null"
}
```

---

### 1.4 PRD API

**GET** `/projects/{project_id}/prd`  
현재 PRD 조회 (최신 버전)

**GET** `/projects/{project_id}/prd/history`  
PRD 버전 히스토리

**PATCH** `/projects/{project_id}/prd`  
PRD 수동 편집

Request:
```json
{
  "section": "string",
  "content": "string",
  "reason": "string | null"
}
```

---

### 1.5 설계 API

**POST** `/projects/{project_id}/plan/generate`  
개발 계획 자동 생성 (PRD 기반)

Request:
```json
{
  "llm_model": "string | null"
}
```

Response:
```json
{
  "job_id": "string",
  "status": "processing"
}
```

---

**POST** `/projects/{project_id}/design/generate`  
아키텍처 설계 자동 생성

Request:
```json
{
  "tech_stack": {
    "frontend": "string",
    "backend": "string",
    "database": "string"
  },
  "constraints": ["string"],
  "llm_model": "string | null"
}
```

---

**GET** `/projects/{project_id}/design`  
설계 문서 조회

**PATCH** `/projects/{project_id}/design`  
설계 문서 수동 편집

---

### 1.6 코드 생성 API

**POST** `/projects/{project_id}/code/generate`  
코드 생성 요청

Request:
```json
{
  "target": "module | component | function",
  "target_name": "string",
  "llm_model": "string | null"
}
```

Response:
```json
{
  "job_id": "string",
  "status": "processing"
}
```

---

**GET** `/projects/{project_id}/code`  
생성된 코드 목록

**GET** `/projects/{project_id}/code/{code_id}`  
코드 상세 + 린팅 결과

Response:
```json
{
  "code_id": "string",
  "target": "string",
  "content": "string",
  "lint_status": "passed | failed | pending",
  "lint_report": {
    "issues": [
      {
        "rule": "string",
        "line": "number",
        "message": "string",
        "fixed": "boolean"
      }
    ]
  },
  "created_at": "datetime"
}
```

---

### 1.7 GitHub Sync API

**POST** `/projects/{project_id}/github/repo`  
GitHub repo 생성 또는 연결

Request:
```json
{
  "action": "create | connect",
  "repo_name": "string",
  "repo_url": "string | null"
}
```

---

**GET** `/projects/{project_id}/github/diff`  
sync 전 변경사항 미리보기

Response:
```json
{
  "changes": [
    {
      "file_path": "string",
      "change_type": "added | modified | deleted",
      "diff": "string"
    }
  ],
  "last_synced_at": "datetime | null"
}
```

---

**POST** `/projects/{project_id}/github/sync`  
GitHub sync 실행 (Human-in-the-loop)

Request:
```json
{
  "commit_message": "string"
}
```

Response:
```json
{
  "commit_sha": "string",
  "commit_url": "string",
  "synced_files": ["string"],
  "synced_at": "datetime"
}
```

---

**GET** `/projects/{project_id}/github/syncs`  
sync 히스토리

---

### 1.8 설정 API

**GET** `/settings`  
사용자 설정 전체 조회

**PATCH** `/settings/llm`  
LLM 설정 업데이트

Request:
```json
{
  "api_keys": {
    "gemini": "string | null",
    "claude": "string | null",
    "openai": "string | null"
  },
  "default_models": {
    "cps_generation": "string",
    "prd_generation": "string",
    "code_generation": "string"
  }
}
```

---

**PATCH** `/settings/github`  
GitHub 설정 업데이트

Request:
```json
{
  "personal_access_token": "string"
}
```

---

### 1.9 백그라운드 잡 상태 API

**GET** `/jobs/{job_id}`  
백그라운드 잡 상태 조회  
(프론트에서 polling 또는 Firestore 실시간 리스닝으로 대체 가능)

Response:
```json
{
  "job_id": "string",
  "type": "cps_analysis | prd_update | code_generation | plan_generation",
  "status": "pending | processing | completed | failed",
  "result": { } ,
  "error": "string | null",
  "created_at": "datetime",
  "completed_at": "datetime | null"
}
```

---

## 2. DB 스키마 (Firestore)

### 컬렉션 구조

```
users/{user_id}
  - email: string
  - display_name: string
  - created_at: timestamp
  - settings:
      llm:
        api_keys:
          gemini: string (encrypted)
          claude: string (encrypted)
          openai: string (encrypted)
        default_models:
          cps_generation: string
          prd_generation: string
          code_generation: string
      github:
        personal_access_token: string (encrypted)

  └── projects/{project_id}
        - name: string
        - client: string
        - description: string | null
        - tags: string[]
        - status: "active" | "archived"
        - github_repo: string | null
        - created_at: timestamp
        - last_meeting_at: timestamp | null

        └── meetings/{meeting_id}
              - title: string | null
              - date: string (YYYY-MM-DD)
              - participants: string[]
              - content: string          # 원본 보존
              - analysis_status: "pending" | "processing" | "completed" | "failed"
              - created_at: timestamp

        └── cps/{version}              # version: "1.0.0", "1.1.0" ...
              - meta:
                  project_id: string
                  client: string
                  version: string
                  last_updated: timestamp
                  source_meetings: string[]
                  change_type: "auto" | "manual_edit"
              - context: { ... }
              - problem: { ... }
              - solution: { ... }
              - assumptions: [ ... ]
              - out_of_scope: [ ... ]
              - risks: { ... }
              - pending: { ... }
              - decision_log: [ ... ]
              - created_at: timestamp

        └── prd/{version}
              - version: string
              - content: string          # Markdown 형식
              - source_cps_version: string
              - change_type: "auto" | "manual_edit"
              - created_at: timestamp

        └── design/{doc_id}            # doc_id: "latest" 고정 또는 버전
              - plan: string            # 개발 계획 Markdown
              - architecture: string   # 아키텍처 설계 Markdown
              - updated_at: timestamp

        └── codes/{code_id}
              - target: string
              - target_name: string
              - content: string
              - llm_model: string
              - lint_status: "pending" | "passed" | "failed"
              - lint_report: { ... }
              - created_at: timestamp

        └── github_syncs/{sync_id}
              - commit_sha: string
              - commit_url: string
              - commit_message: string
              - synced_files: string[]
              - synced_at: timestamp

        └── jobs/{job_id}
              - type: string
              - status: "pending" | "processing" | "completed" | "failed"
              - result: map | null
              - error: string | null
              - created_at: timestamp
              - completed_at: timestamp | null
```

### Firestore 보안 규칙 원칙

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null
                         && request.auth.uid == userId;
    }
  }
}
```

모든 데이터는 `users/{userId}` 하위에 있어서
로그인한 본인만 읽기/쓰기 가능.

---

## 3. 컴포넌트 구조 (Frontend)

### 3.1 폴더 구조

```
frontend/
  ├── app/
  │     ├── (auth)/
  │     │     ├── login/
  │     │     │     └── page.tsx
  │     │     └── layout.tsx
  │     │
  │     ├── (app)/
  │     │     ├── dashboard/
  │     │     │     └── page.tsx
  │     │     │
  │     │     ├── projects/
  │     │     │     ├── new/
  │     │     │     │     └── page.tsx
  │     │     │     └── [projectId]/
  │     │     │           ├── page.tsx           # 프로젝트 홈
  │     │     │           ├── meetings/
  │     │     │           │     └── page.tsx
  │     │     │           ├── cps/
  │     │     │           │     └── page.tsx
  │     │     │           ├── prd/
  │     │     │           │     └── page.tsx
  │     │     │           ├── plan/
  │     │     │           │     └── page.tsx
  │     │     │           ├── code/
  │     │     │           │     └── page.tsx
  │     │     │           └── sync/
  │     │     │                 └── page.tsx
  │     │     │
  │     │     ├── settings/
  │     │     │     ├── page.tsx
  │     │     │     ├── llm/
  │     │     │     │     └── page.tsx
  │     │     │     └── github/
  │     │     │           └── page.tsx
  │     │     │
  │     │     └── layout.tsx              # 사이드바 + 헤더
  │     │
  │     └── layout.tsx                    # 루트 레이아웃
  │
  ├── components/
  │     ├── project/
  │     │     ├── ProjectCard.tsx
  │     │     ├── ProjectForm.tsx
  │     │     └── ProjectStatusBadge.tsx
  │     │
  │     ├── meeting/
  │     │     ├── MeetingCard.tsx
  │     │     ├── MeetingForm.tsx
  │     │     └── AnalysisStatusBadge.tsx
  │     │
  │     ├── cps/
  │     │     ├── CpsViewer.tsx           # 섹션별 펼침/접힘
  │     │     ├── CpsEditor.tsx           # 필드 수동 편집
  │     │     ├── CpsVersionHistory.tsx
  │     │     └── PendingItemList.tsx
  │     │
  │     ├── prd/
  │     │     ├── PrdViewer.tsx
  │     │     ├── PrdEditor.tsx
  │     │     └── PrdVersionHistory.tsx
  │     │
  │     ├── code/
  │     │     ├── CodeViewer.tsx
  │     │     ├── CodeGenerateForm.tsx
  │     │     └── LintReport.tsx
  │     │
  │     ├── github/
  │     │     ├── SyncDiffViewer.tsx      # 변경사항 미리보기
  │     │     ├── SyncForm.tsx            # 커밋 메시지 입력
  │     │     └── SyncHistory.tsx
  │     │
  │     └── ui/                           # 공통 UI
  │           ├── Button.tsx
  │           ├── Badge.tsx
  │           ├── Modal.tsx
  │           ├── Spinner.tsx
  │           └── SectionCollapse.tsx
  │
  ├── lib/
  │     ├── api/
  │     │     ├── projectApi.ts
  │     │     ├── meetingApi.ts
  │     │     ├── cpsApi.ts
  │     │     ├── prdApi.ts
  │     │     ├── codeApi.ts
  │     │     ├── githubApi.ts
  │     │     └── settingsApi.ts
  │     │
  │     ├── firebase/
  │     │     ├── firebaseConfig.ts
  │     │     ├── auth.ts
  │     │     └── firestore.ts            # 실시간 리스닝 훅
  │     │
  │     └── utils/
  │           ├── dateUtils.ts
  │           └── diffUtils.ts
  │
  └── types/
        ├── project.ts
        ├── meeting.ts
        ├── cps.ts
        ├── prd.ts
        ├── code.ts
        └── github.ts
```

### 3.2 핵심 화면별 컴포넌트 구성

**Dashboard** `/dashboard`
```
DashboardPage
  └── ProjectCard (n개)
        ├── 프로젝트명 + 고객사명
        ├── 최근 미팅 일시
        └── AnalysisStatusBadge
```

**미팅 목록** `/projects/[id]/meetings`
```
MeetingsPage
  ├── MeetingForm (추가)
  └── MeetingCard (n개)
        ├── 날짜, 참석자, 제목
        └── AnalysisStatusBadge
              # Firestore 실시간 리스닝으로 자동 갱신
```

**CPS 뷰어** `/projects/[id]/cps`
```
CpsPage
  ├── CpsVersionHistory (사이드)
  └── CpsViewer
        ├── SectionCollapse: Context
        ├── SectionCollapse: Problem
        │     └── confidence 배지 (suspected | probable | confirmed)
        ├── SectionCollapse: Solution
        │     └── confidence 배지
        ├── SectionCollapse: Assumptions
        ├── SectionCollapse: Risks
        ├── SectionCollapse: Out of Scope
        ├── PendingItemList
        │     └── 항목별 체크 + 필드 이동
        └── SectionCollapse: Decision Log
```

**GitHub Sync** `/projects/[id]/sync`
```
SyncPage
  ├── SyncDiffViewer
  │     └── 파일별 변경사항 diff
  ├── SyncForm
  │     ├── 커밋 메시지 (자동 생성 + 수정 가능)
  │     └── Sync 버튼
  └── SyncHistory
```

---

## 4. 백엔드 모듈 구조

```
backend/
  ├── app/
  │     ├── main.py
  │     ├── routers/
  │     │     ├── project_router.py
  │     │     ├── meeting_router.py
  │     │     ├── cps_router.py
  │     │     ├── prd_router.py
  │     │     ├── plan_router.py
  │     │     ├── code_router.py
  │     │     ├── github_router.py
  │     │     └── settings_router.py
  │     │
  │     ├── services/
  │     │     ├── project_service.py
  │     │     ├── meeting_service.py
  │     │     ├── cps_service.py          # CPS 생성 + 업데이트 로직
  │     │     ├── prd_service.py
  │     │     ├── plan_service.py
  │     │     ├── code_service.py
  │     │     ├── github_service.py
  │     │     └── llm_service.py          # LangChain 래퍼
  │     │
  │     ├── jobs/
  │     │     ├── cps_analyzer_job.py     # 미팅 → CPS 분석
  │     │     └── prd_updater_job.py      # CPS 변경 → PRD 검사
  │     │
  │     ├── models/
  │     │     ├── project_model.py
  │     │     ├── meeting_model.py
  │     │     ├── cps_model.py
  │     │     ├── prd_model.py
  │     │     └── code_model.py
  │     │
  │     ├── prompts/
  │     │     ├── cps_prompt.py           # CPS 변환 프롬프트
  │     │     └── prd_prompt.py
  │     │
  │     └── core/
  │           ├── auth.py                 # Firebase JWT 검증
  │           ├── firestore.py            # Firestore 클라이언트
  │           └── config.py
  │
  └── tests/
        ├── test_cps_service.py
        └── test_llm_service.py
```

---

## 5. 백그라운드 잡 흐름

```
POST /meetings  (미팅 저장)
      ↓
meeting_service.create_meeting()
      ↓
  Firestore에 meeting 저장
  jobs/{job_id} status: "processing"
      ↓
  FastAPI BackgroundTasks 트리거
      ↓
cps_analyzer_job.run()
  └── llm_service.generate_cps(meeting, existing_cps)
  └── cps_service.update_cps(result)
  └── prd_updater_job.run()         # CPS 바뀌었으면
        └── llm_service.update_prd(cps, existing_prd)
        └── prd_service.update_prd(result)
      ↓
  jobs/{job_id} status: "completed"
      ↓
Firestore 실시간 리스닝 → 프론트 자동 갱신
```

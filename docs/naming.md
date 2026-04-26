# FlowFD — 네이밍 컨벤션

**Version**: 1.0.0  
**Date**: 2026-04-14  
**적용 범위**: 프론트엔드(Next.js), 백엔드(FastAPI) 전체

> 이 문서는 어떤 LLM 모델로 코드를 생성하더라도 동일한 코드 스타일이 나오도록 강제하는 규칙이다.
> 린터가 이 규칙을 자동으로 검사한다.

---

## 1. 공통 원칙

- 약어는 사용하지 않는다. `cps_gen` → `cps_generator`
- 단, 도메인 용어는 예외다. `cps`, `prd`, `llm`, `fde`는 약어가 아닌 도메인 용어로 허용
- 이름만 보고 역할을 알 수 있어야 한다
- Boolean 변수는 `is_`, `has_`, `can_` 접두사를 붙인다
- 복수형은 `_list` 대신 자연스러운 복수형을 사용한다. `meeting_list` → `meetings`

---

## 2. 도메인 용어 통일

같은 개념을 여러 이름으로 부르지 않는다.

| 개념 | 사용 (O) | 사용 금지 (X) |
|------|----------|--------------|
| 미팅 원본 | `meeting` | `session`, `conversation`, `record` |
| CPS 문서 | `cps` | `analysis`, `summary`, `document` |
| PRD 문서 | `prd` | `spec`, `requirement`, `product_doc` |
| 프로젝트 | `project` | `workspace`, `client`, `engagement` |
| 사용자 | `user` | `account`, `member`, `person` |
| 백그라운드 잡 | `job` | `task`, `worker`, `process` |
| 버전 | `version` | `revision`, `snapshot`, `iteration` |
| GitHub sync | `sync` | `push`, `commit_action`, `export` |
| 린터 결과 | `lint_report` | `check_result`, `validation`, `report` |
| 분석 상태 | `analysis_status` | `job_status`, `state`, `progress` |

---

## 3. 백엔드 (Python / FastAPI)

### 3.1 기본 규칙

| 대상 | 규칙 | 예시 |
|------|------|------|
| 클래스 | PascalCase | `MeetingService`, `CpsAnalyzerJob` |
| 함수/메서드 | snake_case | `create_meeting()`, `update_cps()` |
| 변수 | snake_case | `meeting_id`, `cps_document` |
| 상수 | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT`, `DEFAULT_LLM_MODEL` |
| 파일 | snake_case | `meeting_service.py`, `cps_analyzer_job.py` |
| 모듈/패키지 | snake_case | `routers/`, `services/` |

### 3.2 레이어별 클래스 네이밍

```python
# Router
class MeetingRouter       # 라우터는 Router 접미사
class CpsRouter
class GithubRouter

# Service
class MeetingService      # 서비스는 Service 접미사
class CpsService
class LlmService

# Job (백그라운드)
class CpsAnalyzerJob      # 잡은 Job 접미사
class PrdUpdaterJob

# Model (Pydantic)
class Meeting             # 모델은 접미사 없음
class CpsDocument
class PrdDocument
class Project
class User

# Request/Response 스키마
class CreateMeetingRequest    # Request 접미사
class CreateMeetingResponse   # Response 접미사
class UpdateCpsRequest
class GetCpsResponse
```

### 3.3 함수 네이밍 패턴

```python
# CRUD
create_{resource}()       # create_meeting(), create_project()
get_{resource}()          # get_meeting(), get_cps()
get_{resource}_list()     # get_meeting_list(), get_project_list()
update_{resource}()       # update_cps(), update_prd()
delete_{resource}()       # delete_project()
archive_{resource}()      # archive_project()

# 비즈니스 로직
generate_{resource}()     # generate_cps(), generate_prd()
analyze_{resource}()      # analyze_meeting()
sync_{resource}()         # sync_to_github()
validate_{resource}()     # validate_cps_schema()

# 상태 확인
is_{condition}()          # is_cps_outdated(), is_sync_needed()
has_{resource}()          # has_github_connected()
```

### 3.4 변수 네이밍 패턴

```python
# ID 변수
user_id: str
project_id: str
meeting_id: str
job_id: str

# 상태 변수
analysis_status: str       # "pending" | "processing" | "completed" | "failed"
lint_status: str           # "pending" | "passed" | "failed"
change_type: str           # "auto" | "manual_edit"
confidence: str            # "suspected" | "probable" | "confirmed"

# Boolean
is_archived: bool
has_github_connected: bool
is_cps_updated: bool

# 목록
meetings: list[Meeting]
projects: list[Project]
changed_fields: list[str]
```

### 3.5 파일 네이밍

```
routers/
  meeting_router.py
  cps_router.py
  prd_router.py
  project_router.py
  github_router.py
  settings_router.py

services/
  meeting_service.py
  cps_service.py
  prd_service.py
  project_service.py
  github_service.py
  llm_service.py

jobs/
  cps_analyzer_job.py
  prd_updater_job.py

models/
  meeting_model.py
  cps_model.py
  prd_model.py
  project_model.py
  user_model.py

prompts/
  cps_prompt.py
  prd_prompt.py
```

---

## 4. 프론트엔드 (TypeScript / Next.js)

### 4.1 기본 규칙

| 대상 | 규칙 | 예시 |
|------|------|------|
| 컴포넌트 | PascalCase | `MeetingCard`, `CpsViewer` |
| 함수 | camelCase | `createMeeting()`, `updateCps()` |
| 변수 | camelCase | `meetingId`, `cpsDocument` |
| 상수 | UPPER_SNAKE_CASE | `MAX_FILE_SIZE`, `API_BASE_URL` |
| 타입/인터페이스 | PascalCase | `Meeting`, `CpsDocument` |
| 파일(컴포넌트) | PascalCase | `MeetingCard.tsx`, `CpsViewer.tsx` |
| 파일(유틸/훅/api) | camelCase | `meetingApi.ts`, `useCps.ts` |
| 파일(상수/타입) | camelCase | `meeting.ts`, `cps.ts` |

### 4.2 컴포넌트 네이밍 패턴

```typescript
// 뷰어 (읽기 전용)
MeetingCard           // 목록용 카드
CpsViewer             // 상세 뷰어
PrdViewer
SyncHistory

// 에디터 (편집 가능)
CpsEditor
PrdEditor

// 폼 (입력/생성)
MeetingForm           // Form 접미사
ProjectForm
SyncForm
CodeGenerateForm

// 상태 표시
AnalysisStatusBadge   // Badge 접미사
ProjectStatusBadge
LintStatusBadge

// 공통 UI
SectionCollapse       // 기능 설명
DiffViewer
VersionHistory
```

### 4.3 훅 네이밍 패턴

```typescript
// 데이터 fetch
useMeetings(projectId)       // use + 복수 도메인
useCps(projectId)
usePrd(projectId)
useProjects()

// 실시간 리스닝 (Firestore)
useLiveCps(projectId)        // useLive 접두사
useLiveJobStatus(jobId)
useLiveAnalysisStatus(meetingId)

// 액션
useCreateMeeting()           // useCreate 접두사
useUpdateCps()
useSyncToGithub()
useGenerateCode()
```

### 4.4 API 함수 네이밍 패턴

```typescript
// lib/api/meetingApi.ts
fetchMeetings(projectId)       // fetch + 복수 = 목록
fetchMeeting(projectId, meetingId)  // fetch + 단수 = 단건
createMeeting(projectId, data)
updateMeeting(projectId, meetingId, data)

// lib/api/cpsApi.ts
fetchCps(projectId)
fetchCpsHistory(projectId)
fetchCpsVersion(projectId, version)
updateCps(projectId, data)

// lib/api/githubApi.ts
fetchSyncDiff(projectId)
syncToGithub(projectId, data)
fetchSyncHistory(projectId)
```

### 4.5 타입 네이밍 패턴

```typescript
// types/meeting.ts
type Meeting = { ... }
type CreateMeetingRequest = { ... }
type CreateMeetingResponse = { ... }
type AnalysisStatus = "pending" | "processing" | "completed" | "failed"

// types/cps.ts
type CpsDocument = { ... }
type CpsVersion = { ... }
type CpsChangeType = "auto" | "manual_edit"
type Confidence = "suspected" | "probable" | "confirmed"

// types/github.ts
type SyncDiff = { ... }
type SyncHistory = { ... }
type SyncRequest = { ... }
```

### 4.6 파일 네이밍

```
components/
  meeting/
    MeetingCard.tsx
    MeetingForm.tsx
    AnalysisStatusBadge.tsx
  cps/
    CpsViewer.tsx
    CpsEditor.tsx
    CpsVersionHistory.tsx
    PendingItemList.tsx
  prd/
    PrdViewer.tsx
    PrdEditor.tsx
    PrdVersionHistory.tsx
  code/
    CodeViewer.tsx
    CodeGenerateForm.tsx
    LintReport.tsx
  github/
    SyncDiffViewer.tsx
    SyncForm.tsx
    SyncHistory.tsx
  ui/
    Button.tsx
    Badge.tsx
    Modal.tsx
    Spinner.tsx
    SectionCollapse.tsx

lib/
  api/
    projectApi.ts
    meetingApi.ts
    cpsApi.ts
    prdApi.ts
    codeApi.ts
    githubApi.ts
    settingsApi.ts
  firebase/
    firebaseConfig.ts
    auth.ts
    firestore.ts
  utils/
    dateUtils.ts
    diffUtils.ts

types/
  project.ts
  meeting.ts
  cps.ts
  prd.ts
  code.ts
  github.ts
```

---

## 5. API 경로 네이밍

```
# 복수형 명사로 시작
/projects
/projects/{project_id}/meetings
/projects/{project_id}/cps
/projects/{project_id}/prd
/projects/{project_id}/code
/projects/{project_id}/github/sync
/projects/{project_id}/github/syncs   # 히스토리는 복수형

# 액션은 동사로
/projects/{project_id}/plan/generate
/projects/{project_id}/design/generate
/projects/{project_id}/code/generate
/projects/{project_id}/github/sync    # 동사(sync)로 액션 표현

# 설정
/settings
/settings/llm
/settings/github
```

---

## 6. Firestore 컬렉션/필드 네이밍

```
# 컬렉션: snake_case 복수형
users
projects
meetings
cps           # 단수 (버전별 문서)
prd           # 단수 (버전별 문서)
codes
github_syncs
jobs

# 필드: snake_case
project_id
meeting_id
analysis_status
lint_status
change_type
created_at
updated_at
last_meeting_at
source_meetings
decision_log
```

---

## 7. 환경 변수 네이밍

```bash
# 백엔드 (Python)
FIREBASE_PROJECT_ID
FIREBASE_SERVICE_ACCOUNT_KEY
ALLOWED_ORIGINS

# 프론트엔드 (Next.js, NEXT_PUBLIC_ 접두사는 클라이언트 노출)
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_API_BASE_URL
```

---

## 8. Git 커밋 메시지

```
feat: 기능 추가
fix: 버그 수정
refactor: 리팩토링
docs: 문서 수정
test: 테스트 추가/수정
chore: 빌드/설정 변경

예시:
feat(cps): add auto-update on new meeting
fix(github): handle token expiry on sync
refactor(llm): extract langchain wrapper to llm_service
docs(api): update cps endpoint spec
```

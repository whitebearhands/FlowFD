# FlowFD — Product Requirements Document

**Version**: 1.1.0  
**Date**: 2026-04-14  
**Status**: Draft

---

## 1. 개요

FlowFD는 Forward Deployed Engineer(FDE)의 업무 전 과정을 자동화하는 SaaS 플랫폼이다.
고객사와의 미팅 내용을 구조화된 문서(CPS, PRD)로 변환하고, 이를 기반으로 설계 및 코드 생성까지 이어지는 파이프라인을 제공한다. 여러 고객사 프로젝트를 동시에 관리하면서도 컨텍스트가 격리되어 혼재되지 않는다.

---

## 2. 목표

### 2.1 비즈니스 목표
- FDE의 반복적인 문서화 작업을 자동화해서 실제 개발에 집중할 수 있게 한다
- 문서 품질을 개인 역량이 아닌 시스템으로 보장한다
- 핸드오프 시 고객사가 프로젝트 히스토리를 완전히 이해할 수 있게 한다

### 2.2 성공 지표
- 미팅 후 CPS 생성까지 5분 이내
- 새 미팅 추가 시 CPS/PRD 자동 검사 및 업데이트
- 어떤 LLM 모델을 사용해도 동일한 코드 스타일 출력
- FDE 1인이 여러 프로젝트를 컨텍스트 혼재 없이 관리 가능

---

## 3. 사용자

### 3.1 주 사용자: FDE
- 여러 고객사 프로젝트를 동시에 담당
- 하루에도 여러 번 비정형적인 미팅 진행
- 미팅 → 문서화 → 설계 → 개발 → 핸드오프 사이클 반복
- 다양한 LLM 도구를 상황에 따라 혼용

---

## 4. 기능 요구사항

### 4.1 인증 및 사용자 관리

**FR-AUTH-001** 이메일/소셜 로그인  
사용자는 이메일 또는 소셜 계정(Google)으로 가입 및 로그인할 수 있다.

**FR-AUTH-002** 사용자별 데이터 격리  
로그인한 사용자의 데이터는 다른 사용자와 완전히 격리된다.

---

### 4.2 프로젝트 관리

**FR-PROJ-001** 프로젝트 생성  
사용자는 고객사별로 프로젝트를 생성할 수 있다.  
필수 입력: 프로젝트명, 고객사명  
선택 입력: 설명, 태그

**FR-PROJ-002** 프로젝트 목록 조회  
사용자는 자신의 프로젝트 목록을 볼 수 있다.  
표시 정보: 프로젝트명, 고객사명, 최근 미팅 일시, 현재 단계

**FR-PROJ-003** 프로젝트 아카이브  
완료된 프로젝트를 아카이브할 수 있다.

---

### 4.3 미팅 관리

**FR-MEET-001** 미팅 기록 입력  
사용자는 프로젝트에 미팅 기록을 추가할 수 있다.  
입력 방식: 텍스트 직접 입력 또는 텍스트 파일 업로드  
필수 입력: 미팅 날짜, 참석자, 미팅 내용  
선택 입력: 미팅 제목

**FR-MEET-002** 미팅 목록 조회  
프로젝트 내 미팅 목록을 시간순으로 조회할 수 있다.

**FR-MEET-003** 미팅 원본 보존  
입력된 미팅 내용은 원본 그대로 영구 보존된다. 분석 결과와 별개로 원본을 언제든 확인할 수 있다.

**FR-MEET-004** 미팅 저장 후 자동 분석 트리거  
미팅이 저장되면 백그라운드에서 CPS/PRD 자동 검사가 시작된다.  
사용자에게 "분석 중" 상태를 표시하고, 완료 시 자동으로 업데이트된다.

---

### 4.4 CPS 관리

**FR-CPS-001** CPS 자동 생성  
첫 번째 미팅 저장 시 CPS가 자동으로 생성된다.  
생성 기준: CPS 프롬프트 v1.0 스키마 적용

**FR-CPS-002** CPS 자동 업데이트  
새 미팅이 추가될 때마다 백그라운드에서 기존 CPS를 검사한다.  
변경이 필요한 필드가 있으면 자동으로 업데이트하고 decision_log에 기록한다.  
변경이 없으면 업데이트하지 않는다.

**FR-CPS-003** CPS 조회  
현재 CPS를 구조화된 형태로 조회할 수 있다.  
섹션별(Context, Problem, Solution, Pending 등) 펼침/접힘 가능

**FR-CPS-004** CPS 수동 편집  
사용자가 직접 CPS 내용을 수정할 수 있다.  
수동 수정 시 decision_log에 "manual_edit"으로 기록된다.

**FR-CPS-005** CPS 버전 히스토리  
CPS의 모든 버전을 조회하고 비교할 수 있다.  
어떤 미팅에서 어떤 필드가 왜 바뀌었는지 추적 가능하다.

**FR-CPS-006** Pending 항목 관리  
pending.questions, pending.insights, pending.solution_ideas를 별도로 관리할 수 있다.  
완료된 항목은 체크하고 관련 필드로 이동시킬 수 있다.

---

### 4.5 PRD 관리

**FR-PRD-001** PRD 자동 생성  
CPS가 생성된 후 사용자 요청 또는 자동으로 PRD가 생성된다.  
CPS의 problem과 solution을 기반으로 PRD를 작성한다.

**FR-PRD-002** PRD 자동 업데이트  
CPS가 업데이트될 때 PRD도 검사하여 필요 시 업데이트한다.

**FR-PRD-003** PRD 조회 및 편집  
PRD를 구조화된 형태로 조회하고 수동 편집할 수 있다.

**FR-PRD-004** PRD 버전 히스토리  
PRD의 모든 버전을 조회할 수 있다.

---

### 4.6 개발 계획 및 설계

**FR-PLAN-001** 개발 계획 생성  
PRD를 기반으로 개발 계획(마일스톤, 태스크 목록)을 자동 생성한다.

**FR-PLAN-002** 아키텍처 설계 생성  
PRD와 기술 스택 정보를 입력받아 시스템 아키텍처 설계를 자동 생성한다.  
입력: 기술 스택, 제약사항  
출력: 컴포넌트 구조, API 명세 초안, DB 스키마 초안

**FR-PLAN-003** 설계 문서 조회 및 편집  
생성된 설계 문서를 조회하고 수정할 수 있다.

---

### 4.7 코드 생성

**FR-CODE-001** 코드 생성 요청  
설계 문서를 기반으로 코드 생성을 요청할 수 있다.  
생성 단위: 모듈, 컴포넌트, 함수 단위 선택 가능

**FR-CODE-002** LLM 모델 선택  
코드 생성 시 사용할 LLM 모델을 선택할 수 있다.  
기본값: Gemini  
지원: 멀티 모델 (LangChain 기반)

**FR-CODE-003** 네이밍 규칙 강제  
생성된 코드에 프로젝트 또는 플랫폼 단위 네이밍 규칙을 자동으로 적용한다.  
규칙: 함수명, 클래스명, 변수명, 파일명 컨벤션  
효과: 어떤 LLM을 사용해도 동일한 코드 스타일 보장

**FR-CODE-004** 코드 린팅 결과 조회  
린팅 통과 여부와 수정 내역을 확인할 수 있다.

---

### 4.8 GitHub 연동

**FR-GIT-001** GitHub 계정 연결  
사용자는 GitHub Personal Access Token을 등록할 수 있다.  
저장: 암호화하여 사용자별 격리 저장.  
권한 범위: repo (private repo 생성 및 관리)

**FR-GIT-002** 프로젝트별 repo 자동 생성  
프로젝트 생성 시 GitHub에 연결된 repo를 자동 생성할 수 있다.  
repo명: 프로젝트명 기반 자동 생성 (사용자가 수정 가능)  
기존 repo 연결도 가능.  
repo 가시성: private 기본

**FR-GIT-003** 수동 GitHub Sync (Human-in-the-loop)  
사용자가 "Sync to GitHub" 버튼을 누를 때만 커밋이 발생한다.  
커밋 전 변경 사항 diff 미리보기 제공.  
커밋 메시지 자동 생성 + 사용자 수정 가능.  
sync 대상: 문서(CPS, PRD, 설계) + 생성된 코드 전체

**FR-GIT-004** repo 구조 자동 관리  
sync 시 아래 구조로 자동 정리:
```
{repo}/
  ├── docs/
  │     ├── cps.md
  │     ├── prd.md
  │     └── design.md
  ├── src/
  └── README.md   (프로젝트 요약 자동 생성)
```

**FR-GIT-005** sync 히스토리 조회  
언제 누가 어떤 내용을 sync했는지 FlowFD 내에서 조회할 수 있다.

---

### 4.9 LLM 설정

**FR-LLM-001** API 키 관리  
사용자는 자신의 LLM API 키를 등록하고 관리할 수 있다.  
지원 모델: Gemini, Claude, OpenAI  
저장: 암호화하여 사용자별 격리 저장

**FR-LLM-002** 기본 모델 설정  
기능별로 기본 사용 모델을 설정할 수 있다.  
예: CPS 생성은 Gemini Pro, 코드 생성은 Claude 사용

---

## 5. 비기능 요구사항

### 5.1 성능
- CPS 생성 응답: 60초 이내 (백그라운드 처리 기준)
- 페이지 로드: 3초 이내
- Firestore 실시간 업데이트: 2초 이내 반영

### 5.2 보안
- Firebase Auth JWT로 모든 API 요청 인증
- 사용자 데이터 Firestore 보안 규칙으로 접근 제어
- LLM API 키 암호화 저장
- HTTPS 강제

### 5.3 가용성
- Cloud Run 자동 스케일링
- Firestore 자동 백업

### 5.4 확장성
- 사용자 수 증가에 따른 Cloud Run 자동 스케일
- LLM 모델 추가 시 LangChain 어댑터만 추가

---

## 6. 기술 스택

| 영역 | 기술 |
|------|------|
| Frontend | Next.js (App Router) |
| Hosting | Firebase Hosting |
| Backend | FastAPI (Python) |
| Backend Infra | Cloud Run |
| Database | Firestore |
| Auth | Firebase Auth |
| LLM | LangChain (Gemini 기본, 멀티 모델) |
| VCS 연동 | GitHub API (PyGithub) |

### 6.1 레포 구조 (모노레포)

```
FlowFD/
  ├── frontend/       Next.js
  ├── backend/        FastAPI
  ├── docs/           설계 문서
  └── README.md
```

---

## 7. 데이터 모델 (개요)

```
users/{userId}
  └── projects/{projectId}
        ├── meetings/{meetingId}
        │     ├── content        : 미팅 원본
        │     ├── participants   : 참석자
        │     └── date           : 미팅 일시
        │
        ├── cps/{version}
        │     ├── (CPS 스키마 전체)
        │     └── created_from   : meetingId
        │
        ├── prd/{version}
        │     ├── (PRD 내용)
        │     └── created_from   : cps version
        │
        ├── github_syncs/{syncId}
        │     ├── synced_at      : sync 일시
        │     ├── commit_sha     : GitHub 커밋 해시
        │     └── commit_message : 커밋 메시지
        │
        └── settings
              ├── llm_config     : 모델별 설정
              ├── naming_rules   : 네이밍 컨벤션
              └── github_repo    : 연결된 repo URL
```

---

## 8. 화면 구성 (개요)

```
/                       랜딩 + 로그인
/dashboard              프로젝트 목록
/projects/new           프로젝트 생성

/projects/[id]          프로젝트 홈 (요약)
/projects/[id]/meetings 미팅 목록 + 추가
/projects/[id]/cps      CPS 뷰어/에디터
/projects/[id]/prd      PRD 뷰어/에디터
/projects/[id]/plan     개발 계획 + 설계
/projects/[id]/code     코드 생성
/projects/[id]/sync     GitHub Sync (diff 미리보기 + 커밋)

/settings               계정 설정
/settings/llm           LLM API 키 관리
/settings/github        GitHub 연결 관리
```

---

## 9. 1차 범위 외

- 미팅 음성 자동 녹취/변환
- 고객사 직접 접근 포털
- 코드 자동 배포 (GitHub sync까지만, 배포는 수동)
- 팀 협업 (여러 FDE가 같은 프로젝트 공유)
- 프로젝트 간 패턴 분석
- 핸드오프 문서 자동 생성
- GitHub Actions 자동 설정
- 다국어 지원(한국어/영어/일어)

---

## 10. 미결 사항

- 미팅 입력 방식: 텍스트 외에 파일 업로드 포맷 범위 (md, txt, docx?)
- LLM API 키를 사용자가 직접 관리 vs FlowFD가 통합 제공
- CPS/PRD 자동 업데이트 알림 방식 (in-app 알림, 이메일 등)
- GitHub repo 가시성 기본값: private 고정 vs 사용자 선택

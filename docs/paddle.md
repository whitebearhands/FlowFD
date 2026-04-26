# FlowFD — Paddle 결제 연동 설계

## 개요

Paddle Billing을 사용해 구독과 1회성 크레딧 구매를 처리한다.
Paddle은 Merchant of Record로서 VAT/세금을 대신 처리해 글로벌 판매가 가능하다.

---

## 가격 정책 (확정)

### 1회성 크레딧 구매
| 상품명 | 크레딧 | 가격 | 단가 |
|--------|--------|------|------|
| Starter | 200 크레딧 | $10.00 | $0.050/크레딧 |
| Standard | 500 크레딧 | $22.00 | $0.044/크레딧 |
| Pro | 1,000 크레딧 | $40.00 | $0.040/크레딧 |

- 구매한 크레딧은 만료 없음
- 구독과 무관하게 언제든 구매 가능

### 구독 플랜
| 플랜 | 가격 | 크레딧 | 단가 | 비고 |
|------|------|--------|------|------|
| 월간 | $29/월 | 1,000 크레딧/월 | $0.029/크레딧 | 언제든 해지 가능 |
| 연간 | $290/년 | 12,000 크레딧/년 | $0.024/크레딧 | 17% 할인 |

- 구독 크레딧: 매월 1일 지급, 최대 2,000 크레딧까지 이월
- 해지 시: 남은 구독 기간까지 유효, 크레딧은 30일 후 만료
- 충전 크레딧: 구독 해지와 무관하게 영구 유효

### 크레딧 소모 정책
| 작업 | 소모 |
|------|------|
| 미팅 + CPS (스마트 분석) | 5 크레딧 |
| 미팅 + CPS (전체 재분석) | 8 크레딧 |
| PRD 생성 | 10 크레딧 |
| 설계 생성 | 15 크레딧 |
| 전체 파이프라인 | 30 크레딧 |

---

## Paddle 상품 구조

### Product / Price 설계

```
Products:
  flowfd_credits_200    # 1회성 200 크레딧
  flowfd_credits_500    # 1회성 500 크레딧
  flowfd_credits_1000   # 1회성 1,000 크레딧
  flowfd_pro_monthly    # 구독 월간
  flowfd_pro_annual     # 구독 연간

Prices:
  각 Product에 USD 가격 1개씩 연결
  구독은 billing_cycle: monthly / yearly
```

### Paddle Checkout 방식
- Paddle Overlay Checkout (JS SDK) 사용
- 별도 결제 페이지 이동 없이 모달로 처리
- 완료 후 success_url 리디렉션

---

## 아키텍처

```
Frontend (Next.js)
  └── Paddle.js SDK
        ├── Checkout 열기 (구독/1회성)
        └── success_url → /billing/success

Backend (FastAPI)
  └── /webhooks/paddle
        ├── transaction.completed   → 크레딧 지급
        ├── subscription.activated  → 구독 활성화 + 크레딧 지급
        ├── subscription.updated    → 플랜 변경 처리
        ├── subscription.canceled   → 구독 취소 처리
        └── subscription.renewed    → 월간 크레딧 갱신

Firestore
  └── users/{userId}
        ├── subscription (구독 정보)
        └── credits (크레딧 정보)
        └── credit_transactions (내역)
```

---

## Firestore 스키마

### users/{userId}/subscription

```typescript
{
  paddle_customer_id: string        // Paddle Customer ID
  paddle_subscription_id: string | null
  plan: "none" | "monthly" | "annual"
  status: "active" | "canceled" | "past_due" | "paused"
  current_period_start: timestamp
  current_period_end: timestamp
  cancel_at_period_end: boolean
  created_at: timestamp
  updated_at: timestamp
}
```

### users/{userId}/credits

```typescript
{
  // 구독 크레딧 (해지 시 만료)
  subscription_credits: number      // 현재 잔액
  subscription_credits_expires_at: timestamp | null

  // 충전 크레딧 (영구)
  purchased_credits: number         // 현재 잔액

  // 합계 (실제 사용 가능)
  total_credits: number             // subscription_credits + purchased_credits

  updated_at: timestamp
}
```

**크레딧 차감 우선순위**: 구독 크레딧 먼저 → 충전 크레딧

### groups/{groupId}/projects/{projectId}/credit_transactions/{txId}

```typescript
{
  user_id: string
  type: "subscription_grant"        // 구독 월간 지급
       | "purchase"                 // 1회성 구매
       | "usage"                    // 파이프라인 사용
       | "refund"                   // 환불
  amount: number                    // 양수: 지급 / 음수: 차감
  balance_after: number             // 차감 후 잔액
  description: string               // 예: "CPS 분석 — WMS 재고 연동"
  job_id: string | null             // 파이프라인 잡 ID
  paddle_transaction_id: string | null
  created_at: timestamp
}
```

---

## 백엔드 API

### Paddle Checkout 세션 생성

```
POST /billing/checkout
```

Request:
```json
{
  "product_type": "subscription" | "credits",
  "plan": "monthly" | "annual" | null,
  "credits_product": "credits_200" | "credits_500" | "credits_1000" | null
}
```

Response:
```json
{
  "checkout_url": "https://...",    // Overlay Checkout URL
  "transaction_id": "txn_..."
}
```

### Paddle Webhook 수신

```
POST /webhooks/paddle
```

- Paddle-Signature 헤더 검증 필수
- 멱등성 보장: `paddle_transaction_id` 중복 처리 방지
- 처리 실패 시 200 반환 (Paddle 재시도 방지), 내부 오류 로깅

### 크레딧 잔액 조회

```
GET /billing/credits
```

Response:
```json
{
  "subscription_credits": 840,
  "purchased_credits": 200,
  "total_credits": 1040,
  "subscription": {
    "plan": "monthly",
    "status": "active",
    "current_period_end": "2026-05-01T00:00:00Z",
    "cancel_at_period_end": false
  }
}
```

### 구독 취소/재개

```
POST /billing/subscription/cancel
POST /billing/subscription/resume
```

### 크레딧 내역

```
GET /billing/transactions?limit=20&cursor=...
```

---

## 크레딧 차감 미들웨어

파이프라인 실행 전 크레딧 검증:

```python
async def check_credits(user_id: str, required: int) -> bool:
    credits = await get_user_credits(user_id)
    if credits.total_credits < required:
        raise InsufficientCreditsError(
            balance=credits.total_credits,
            required=required
        )
    return True

async def deduct_credits(user_id: str, amount: int, description: str, job_id: str):
    # Firestore 트랜잭션으로 원자적 차감
    # 구독 크레딧 먼저, 부족하면 충전 크레딧에서
    ...
```

에러 응답:
```json
{
  "error": "insufficient_credits",
  "balance": 3,
  "required": 5,
  "message": "크레딧이 부족합니다. 현재 잔액: 3 크레딧"
}
```

---

## 월간 크레딧 갱신 (subscription.renewed)

```python
async def handle_subscription_renewed(event: PaddleEvent):
    user_id = event.custom_data["user_id"]
    plan = get_plan_from_price_id(event.data.price_id)

    credits_to_grant = 1000 if plan == "monthly" else 1000  # 연간은 매월 1,000씩

    await grant_subscription_credits(
        user_id=user_id,
        amount=credits_to_grant,
        max_balance=2000,  # 이월 한도
        expires_at=event.data.current_period_end + timedelta(days=30)
    )
```

---

## 프론트엔드 구성

### 페이지 목록

```
app/(app)/billing/
  ├── page.tsx              # 현재 구독 + 크레딧 현황
  ├── plans/page.tsx        # 구독 플랜 선택
  └── success/page.tsx      # 결제 완료 (Paddle redirect)

app/(landing)/pricing/
  └── page.tsx              # Pricing 공개 페이지 (비로그인 접근 가능)
```

### 법적 페이지 (landing)

```
app/(landing)/
  ├── pricing/page.tsx
  ├── terms/page.tsx
  ├── privacy/page.tsx
  └── refund/page.tsx
```

### Billing 대시보드 UI 구성

```
현재 플랜 카드
  └── 플랜명 / 상태 / 다음 갱신일 / 업그레이드 버튼

크레딧 현황 카드
  └── 구독 크레딧 + 충전 크레딧 + 총 잔액 + 크레딧 구매 버튼

크레딧 사용 내역 테이블
  └── 날짜 / 설명 / 소모량 / 잔액
```

---

## Paddle 환경 변수

```bash
# backend/.env
PADDLE_API_KEY=
PADDLE_WEBHOOK_SECRET=
PADDLE_ENVIRONMENT=sandbox  # 개발: sandbox / 운영: production

# Paddle Product ID
PADDLE_PRICE_CREDITS_200=
PADDLE_PRICE_CREDITS_500=
PADDLE_PRICE_CREDITS_1000=
PADDLE_PRICE_MONTHLY=
PADDLE_PRICE_ANNUAL=

# frontend/.env
NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=
NEXT_PUBLIC_PADDLE_ENVIRONMENT=sandbox
```

---

## 패키지

```bash
# backend
uv add paddle-python  # 공식 Python SDK

# frontend
npm install @paddle/paddle-js
```

---

## 구현 순서

```
Step 1. Firestore 스키마 (subscription, credits, transactions) => 완료
Step 2. Paddle Webhook 핸들러 (transaction.completed, subscription.*) => 완료
Step 3. 크레딧 차감 미들웨어
Step 4. Billing API (checkout, credits, cancel)
Step 5. Billing 대시보드 UI
```
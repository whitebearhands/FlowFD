import LegalPageLayout from "../components/LegalPageLayout";

const content = {
  ko: `## 3. 환불 정책\n\n**환불 정책**\n\n**3.1 구독 환불**\n\n월간 구독 ($29/월):\n- 결제 후 7일 이내, 크레딧 50 미만 사용 시 전액 환불\n- 7일 초과 또는 크레딧 50 이상 사용 시 환불 불가\n- 해지 시 남은 구독 기간까지 서비스 및 크레딧 이용 가능\n\n연간 구독 ($290/년):\n- 결제 후 14일 이내, 크레딧 100 미만 사용 시 전액 환불\n- 14일 초과 시 남은 월 수에 비례한 부분 환불\n  - 예: 3개월 사용 후 해지 → $290 × (9/12) = $217.50 환불\n- 지급된 크레딧 중 사용분은 차감 후 환불\n\n**3.2 1회성 크레딧 구매 환불**\n- 크레딧 미사용 시: 구매 후 7일 이내 전액 환불\n- 일부 사용 시: 잔여 크레딧 × 구매 단가 환불\n- 전부 사용 후: 환불 불가\n\n**3.3 환불 불가 케이스**\n- AI 생성 결과물(CPS/PRD/설계)의 품질 불만족 — AI 특성상 결과물의 완벽함을 보장하기 어렵습니다\n- 단, 서비스 오류로 크레딧이 차감됐지만 작업이 미완료된 경우 크레딧 복구\n- 이용약관 위반으로 계정이 정지된 경우\n\n**3.4 환불 처리**\n- 요청: wb.hands.dev@gmail.com\n- 처리 기간: 영업일 기준 3~5일\n- 환불 수단: 원래 결제 수단으로 환불 (Paddle 처리)\n\n**3.5 서비스 종료 시**\n- 30일 전 사전 고지\n- 잔여 구독 기간 비례 전액 환불\n- 충전 크레딧 전액 환불`,
  en: `## 3. Refund Policy\n\n**Refund Policy**\n\n**3.1 Subscription Refunds**\n\nMonthly Plan ($29/month):\n- Full refund within 7 days of payment if fewer than 50 credits have been used\n- No refund after 7 days or if 50 or more credits have been used\n- Upon cancellation, service and credits remain available through the end of the billing period\n\nAnnual Plan ($290/year):\n- Full refund within 14 days of payment if fewer than 100 credits have been used\n- After 14 days: prorated refund based on unused months remaining\n  - Example: Cancel after 3 months → $290 × (9/12) = $217.50 refunded\n- Credits already used are deducted before calculating the refund amount\n\n**3.2 One-Time Credit Purchase Refunds**\n- If no credits used: full refund within 7 days of purchase\n- If partially used: refund for remaining credits at the original per-credit price\n- If fully used: no refund\n\n**3.3 Non-Refundable Cases**\n- Dissatisfaction with AI-generated output quality (CPS, PRD, design) — we cannot guarantee perfection from AI-generated content\n- Exception: if a service error caused credits to be deducted without completing the task, credits will be restored\n- Accounts terminated due to violations of the Terms of Service\n\n**3.4 Refund Process**\n- Request: wb.hands.dev@gmail.com\n- Processing time: 3–5 business days\n- Refund method: Returned to original payment method via Paddle\n\n**3.5 Service Discontinuation**\n- 30 days advance notice provided\n- Prorated refund for remaining subscription period\n- Full refund of all purchased credits`,
};

export const metadata = {
  title: "환불정책 | FlowFD",
  description: "FlowFD 환불 정책",
};

export default function RefundPage() {
  return <LegalPageLayout content={content} currentHref="/refund" />;
}

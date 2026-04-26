from datetime import datetime
from typing import Literal

from pydantic import BaseModel


SubscriptionPlan = Literal["none", "monthly", "annual"]
SubscriptionStatus = Literal["active", "canceled", "past_due", "paused"]
CreditTransactionType = Literal[
    "subscription_grant", "purchase", "usage", "refund"
]


class Subscription(BaseModel):
    paddle_customer_id: str
    paddle_subscription_id: str | None = None
    plan: SubscriptionPlan = "none"
    status: SubscriptionStatus = "active"
    current_period_start: datetime
    current_period_end: datetime
    cancel_at_period_end: bool = False
    created_at: datetime
    updated_at: datetime


class Credits(BaseModel):
    subscription_credits: int = 0
    subscription_credits_expires_at: datetime | None = None
    purchased_credits: int = 0
    total_credits: int = 0
    updated_at: datetime


class CreditTransaction(BaseModel):
    user_id: str
    type: CreditTransactionType
    amount: int
    balance_after: int
    description: str
    job_id: str | None = None
    paddle_transaction_id: str | None = None
    created_at: datetime


class CheckoutRequest(BaseModel):
    product_type: Literal["subscription", "credits"]
    plan: Literal["monthly", "annual"] | None = None
    credits_product: Literal["credits_200", "credits_500", "credits_1000"] | None = None


class CheckoutResponse(BaseModel):
    checkout_url: str
    transaction_id: str


class BillingCreditsResponse(BaseModel):
    subscription_credits: int
    purchased_credits: int
    total_credits: int
    subscription: dict | None = None

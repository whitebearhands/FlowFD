CREDITS_CPS_SMART = 8
CREDITS_CPS_FULL = 10
CREDITS_PRD = 15
CREDITS_DESIGN = 20

FREE_INITIAL_CREDITS = 100

SUBSCRIPTION_MONTHLY_CREDITS = 1000
SUBSCRIPTION_CREDITS_MAX_CARRY = 2000
SUBSCRIPTION_CREDITS_EXPIRE_DAYS = 30


def calc_analyze_credits(pending_count: int, mode: str = "smart") -> int:
    base = CREDITS_CPS_SMART if mode == "smart" else CREDITS_CPS_FULL
    return base + (pending_count * 2)


CREDIT_PACKAGES = {
    "credits_200": {"credits": 200, "price_usd": 10.00},
    "credits_500": {"credits": 500, "price_usd": 22.00},
    "credits_1000": {"credits": 1000, "price_usd": 40.00},
}

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    firebase_project_id: str
    firebase_service_account_key: str | None = (
        None  # JSON 문자열 또는 파일 경로 (로컬 개발용, Cloud Run은 ADC 자동 사용)
    )
    allowed_origins: list[str] = ["http://localhost:3000"]
    gemini_api_key: str | None = None
    claude_api_key: str | None = None
    openai_api_key: str | None = None

    # Paddle
    paddle_api_key: str | None = None
    paddle_webhook_secret: str | None = None
    paddle_environment: str = "sandbox"
    paddle_price_credits_200: str | None = None
    paddle_price_credits_500: str | None = None
    paddle_price_credits_1000: str | None = None
    paddle_price_monthly: str | None = None
    paddle_price_annual: str | None = None


settings = Settings()

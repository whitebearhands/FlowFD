FROM python:3.13-slim as builder

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

# Set working directory
WORKDIR /app

# Copy dependency files
COPY pyproject.toml uv.lock ./

# Install dependencies with uv
RUN uv sync --frozen --no-dev

# Production stage
FROM python:3.13-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Set working directory
WORKDIR /app

# Copy uv from builder
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

# Copy virtual environment from builder
COPY --from=builder /app/.venv /app/.venv

# Copy application code
COPY . .

# [중요] appuser가 파일을 읽을 수 있도록 권한 변경 (필요 시)
# RUN chown -R appuser:appuser /app

# Ensure virtual environment is activated
ENV PATH="/app/.venv/bin:$PATH"

# [변경 1] 보안을 위해 생성해둔 유저로 전환
USER appuser

# [변경 2] Cloud Run에 맞춘 실행 명령어 추가
# - Cloud Run은 기본적으로 8080 포트로 트래픽을 보냅니다.
# - --env-file .env 옵션은 제거했습니다. (이유는 아래 설명 참고)
# - $PORT 환경변수를 받아서 실행하거나, 기본값 8080을 사용합니다.
CMD uvicorn app.main:app --host 0.0.0.0 --port 8080
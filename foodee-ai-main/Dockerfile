# ==========================================
# Stage 1: Build & Dependency Resolution
# ==========================================
FROM python:3.11-slim AS builder

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip wheel && \
    pip install --no-cache-dir -r requirements.txt

# ==========================================
# Stage 2: Production Lightweight Runner
# ==========================================
FROM python:3.11-slim AS runner

WORKDIR /app

# Install runtime shared libraries for OpenCV and Healthcheck curl
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy virtualenv from builder stage
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    FOOD_UPLOAD_FOLDER=/app/runtime

# Create unprivileged user (appuser)
RUN groupadd -g 10001 appgroup && \
    useradd -u 10001 -g appgroup -s /bin/bash -m appuser

# Copy application source code and models
COPY --chown=appuser:appgroup app/ ./app/
COPY --chown=appuser:appgroup models/ ./models/
COPY --chown=appuser:appgroup gunicorn.conf.py .

# Create runtime directory with appropriate permissions
RUN mkdir -p /app/runtime/jobs && chown -R appuser:appgroup /app/runtime

USER appuser

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

CMD ["gunicorn", "--config", "gunicorn.conf.py", "app:app"]

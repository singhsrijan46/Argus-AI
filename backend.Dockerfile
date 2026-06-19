# ─────────────────────────────────────────────────────────────
#  Argus AI — Backend (FastAPI + ML Models)
# ─────────────────────────────────────────────────────────────
FROM python:3.11-slim AS base

# System deps for scientific python packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies (cached layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source
COPY argus/ ./argus/
COPY demo.py .

# Copy data & models (needed at runtime for scoring)
COPY data/ ./data/
COPY models/ ./models/
COPY results/ ./results/

# Copy env file if exists
COPY .env* ./

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')" || exit 1

CMD ["python", "-m", "argus.api.scoring_api"]

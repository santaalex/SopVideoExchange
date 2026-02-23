FROM python:3.11-slim

# Prevent writing .pyc files & enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install OS-level dependencies (ffmpeg and Chinese fonts for hard-subbing)
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg fonts-wqy-zenhei && \
    rm -rf /var/lib/apt/lists/*

# Fast path for pip
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest
COPY src/ ./src/
COPY test_webhook.py .
COPY test_pipeline_front.py .

# Expose port (Internal FastAPI port)
EXPOSE 8000

# Start trigger main
CMD ["python", "-m", "uvicorn", "src.trigger.main:app", "--host", "0.0.0.0", "--port", "8000"]

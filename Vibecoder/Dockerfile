# ==========================================
# Academic Doubt Forum (Douthub) Dockerfile
# ==========================================
FROM python:3.11-slim

# Prevent bytecode generation and buffer logs
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=3000

# Set container working directory
WORKDIR /app

# Copy application assets and source code
COPY . /app

# Expose forum web and API port
EXPOSE 3000

# Container healthcheck testing the database status endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:3000/api/db/status')" || exit 1

# Start the threading HTTP server
CMD ["python", "-u", "server.py"]

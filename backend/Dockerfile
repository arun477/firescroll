FROM python:3.10-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/*.py .
COPY assets/ assets/
COPY data/ data/
COPY templates/ templates/

RUN mkdir -p output media_library

EXPOSE 8500

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8500"]

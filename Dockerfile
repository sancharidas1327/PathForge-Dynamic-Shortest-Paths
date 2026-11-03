FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    g++ \
    cmake \
    make \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY engine /app/engine
RUN mkdir -p /app/engine/bin && \
    g++ -std=c++17 -O3 -Wall -Wextra -I/app/engine/include /app/engine/src/pathforge_cli.cpp -o /app/engine/bin/pathforge_cli

COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

COPY backend /app/backend

WORKDIR /app/backend
EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

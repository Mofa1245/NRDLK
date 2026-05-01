# Voice API server (Railway / Docker).
# Includes ffmpeg + Python Whisper runtime for local STT (no OpenAI transcription dependency).
FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg python3 python3-pip python3-venv \
  && python3 -m venv /opt/venv \
  && /opt/venv/bin/pip install --no-cache-dir --upgrade pip \
  && /opt/venv/bin/pip install --no-cache-dir openai-whisper \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PATH="/opt/venv/bin:${PATH}"
ENV PYTHON_PATH=/opt/venv/bin/python

CMD ["npm", "start"]

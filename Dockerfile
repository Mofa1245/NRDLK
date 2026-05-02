# Voice API server (Railway / Docker).
# Local STT uses faster-whisper (CTranslate2, int8 on CPU) — fits small Railway RAM.
# PyTorch openai-whisper is optional for laptops only (see STT_LOCAL_ENGINE=whisper).
FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg python3 python3-pip python3-venv \
  && python3 -m venv /opt/venv \
  && /opt/venv/bin/pip install --no-cache-dir --upgrade pip \
  && /opt/venv/bin/pip install --no-cache-dir faster-whisper \
  && /opt/venv/bin/python -c "from faster_whisper import WhisperModel; print('[faster-whisper import OK]')" \
  && rm -rf /var/lib/apt/lists/*

ENV OMP_NUM_THREADS=1
ENV MKL_NUM_THREADS=1
ENV OPENBLAS_NUM_THREADS=1
ENV NUMEXPR_MAX_THREADS=1

# Match scripts/transcribe_faster.py — avoids PyTorch SIGKILL/OOM on low-memory hosts.
ENV STT_LOCAL_ENGINE=faster
ENV FASTER_WHISPER_COMPUTE_TYPE=int8

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PATH="/opt/venv/bin:${PATH}"
ENV PYTHON_PATH=/opt/venv/bin/python

CMD ["npm", "start"]

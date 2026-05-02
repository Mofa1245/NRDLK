# Voice API server (Railway / Docker).
# Includes ffmpeg + Python Whisper runtime for local STT (no OpenAI transcription dependency).
#
# Railway is CPU-only: install PyTorch CPU wheels *before* openai-whisper so pip does not
# pull the default CUDA build (~GB of nvidia-* libs + higher RAM at inference → SIGKILL/OOM).
FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg python3 python3-pip python3-venv \
  && python3 -m venv /opt/venv \
  && /opt/venv/bin/pip install --no-cache-dir --upgrade pip \
  && /opt/venv/bin/pip install --no-cache-dir \
       torch torchaudio \
       --index-url https://download.pytorch.org/whl/cpu \
  && /opt/venv/bin/pip install --no-cache-dir openai-whisper \
  && /opt/venv/bin/pip install --no-cache-dir --force-reinstall \
       torch torchaudio \
       --index-url https://download.pytorch.org/whl/cpu \
  && /opt/venv/bin/python -c "import torch; c=torch.version.cuda; assert c is None, f'Use CPU-only PyTorch in Docker (got cuda={c!r})'; print('[torch CPU]', torch.__version__)" \
  && rm -rf /var/lib/apt/lists/*

# Reduce peak RAM from parallel BLAS inside the container (helps small Railway limits).
ENV OMP_NUM_THREADS=1
ENV MKL_NUM_THREADS=1
ENV OPENBLAS_NUM_THREADS=1
ENV NUMEXPR_MAX_THREADS=1

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PATH="/opt/venv/bin:${PATH}"
ENV PYTHON_PATH=/opt/venv/bin/python

CMD ["npm", "start"]

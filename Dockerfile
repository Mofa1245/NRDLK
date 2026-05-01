# Voice API server (Railway / Docker). Includes ffmpeg for Twilio recording conversion.
# Use TRANSCRIPTION_PROVIDER=openai + OPENAI_API_KEY on Railway (local Python Whisper not installed).
FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production

CMD ["npm", "start"]

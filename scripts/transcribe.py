import os
import sys
sys.stdout.reconfigure(encoding='utf-8')

import whisper

audio_path = sys.argv[1]

# Strongest default model for best Arabic/English accuracy on a capable local machine.
# Override via env when needed (e.g. WHISPER_MODEL=medium for faster debug runs).
model_name = os.getenv("WHISPER_MODEL", "large-v3").strip() or "large-v3"
print(f"[WHISPER MODEL] {model_name}", file=sys.stderr)
model = whisper.load_model(model_name)

# Bilingual: do not set `language=`. Whisper auto-detects per segment (Arabic, English, or mix).
result = model.transcribe(
    audio_path,
    task="transcribe",
    temperature=0,
)

print(result["text"])

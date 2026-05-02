import os
import sys
import traceback

# Apply before numpy/torch import — lowers RAM spikes in constrained containers (e.g. Railway).
for _k, _v in (
    ("OMP_NUM_THREADS", "1"),
    ("MKL_NUM_THREADS", "1"),
    ("OPENBLAS_NUM_THREADS", "1"),
    ("NUMEXPR_MAX_THREADS", "1"),
):
    os.environ.setdefault(_k, _v)

sys.stdout.reconfigure(encoding='utf-8')


def main() -> None:
    import torch

    torch.set_num_threads(1)
    torch.set_num_interop_threads(1)

    import whisper

    audio_path = sys.argv[1]

    # Strongest default model for best Arabic/English accuracy on a capable local machine.
    # Override via env when needed (e.g. WHISPER_MODEL=medium for faster debug runs).
    model_name = os.getenv("WHISPER_MODEL", "large-v3").strip() or "large-v3"
    print(f"[WHISPER MODEL] {model_name}", file=sys.stderr)

    # `in_memory=False` streams weights from disk instead of holding a full bytes copy + torch.load
    # (older Whisper defaults used extra RAM during download/load on small hosts → SIGKILL).
    dl_root = os.getenv("WHISPER_DOWNLOAD_ROOT", "").strip() or None
    model = whisper.load_model(model_name, device="cpu", download_root=dl_root, in_memory=False)

    # Bilingual: do not set `language=`. Whisper auto-detects per segment (Arabic, English, or mix).
    result = model.transcribe(
        audio_path,
        task="transcribe",
        temperature=0,
    )

    print(result["text"])


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)

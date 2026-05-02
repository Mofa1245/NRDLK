"""
Local STT using faster-whisper (CTranslate2). Much lower RAM than openai-whisper+PyTorch
— intended for small cloud instances (e.g. Railway) where `small` PyTorch model SIGKILLs.
"""
import os
import sys
import traceback

# Before numpy/ctranslate2 heavy imports
for _k, _v in (
    ("OMP_NUM_THREADS", "1"),
    ("MKL_NUM_THREADS", "1"),
    ("OPENBLAS_NUM_THREADS", "1"),
    ("NUMEXPR_MAX_THREADS", "1"),
):
    os.environ.setdefault(_k, _v)

sys.stdout.reconfigure(encoding="utf-8")


def main() -> None:
    from faster_whisper import WhisperModel

    audio_path = sys.argv[1]
    model_name = os.getenv("WHISPER_MODEL", "small").strip() or "small"
    # int8 on CPU is the main memory saver vs float32
    compute = (os.getenv("FASTER_WHISPER_COMPUTE_TYPE", "int8").strip() or "int8")
    device = (os.getenv("FASTER_WHISPER_DEVICE", "cpu").strip() or "cpu")
    dl_root = os.getenv("WHISPER_DOWNLOAD_ROOT", "").strip() or None
    num_workers = int(os.getenv("FASTER_WHISPER_NUM_WORKERS", "1") or "1")

    print(f"[FASTER-WHISPER] model={model_name} device={device} compute={compute}", file=sys.stderr)

    model = WhisperModel(
        model_name,
        device=device,
        compute_type=compute,
        download_root=dl_root,
        num_workers=num_workers,
        cpu_threads=1,
    )
    segments, _info = model.transcribe(
        audio_path,
        task="transcribe",
        temperature=0,
        beam_size=1,
        vad_filter=True,
        word_timestamps=False,
    )
    text = "".join(s.text for s in segments).strip()
    print(text)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)

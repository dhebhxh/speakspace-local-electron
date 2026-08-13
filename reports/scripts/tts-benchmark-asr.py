#!/usr/bin/env python3

from __future__ import annotations

import json
import os
import shutil
import subprocess
import unicodedata
from pathlib import Path


CACHE_ROOT = Path(
    os.environ.get(
        "TTS_BENCHMARK_CACHE",
        Path.home() / "Library" / "Caches" / "SpeakSpace-TTS-Benchmark",
    )
).expanduser()
RESULTS_ROOT = CACHE_ROOT / "results"
WHISPER_MODEL = Path(
    os.environ.get(
        "SPEAKSPACE_WHISPER_MODEL",
        Path.home()
        / "Library"
        / "Application Support"
        / "electron-react-boilerplate"
        / "models"
        / "stt"
        / "ggml-tiny.bin",
    )
).expanduser()


def normalize_for_cer(text: str) -> str:
    normalized = unicodedata.normalize("NFKC", text).casefold()
    return "".join(
        character
        for character in normalized
        if not unicodedata.category(character).startswith(("P", "Z", "C"))
    )


def edit_distance(left: str, right: str) -> int:
    if len(left) < len(right):
        left, right = right, left
    previous = list(range(len(right) + 1))
    for left_index, left_character in enumerate(left, start=1):
        current = [left_index]
        for right_index, right_character in enumerate(right, start=1):
            current.append(
                min(
                    current[-1] + 1,
                    previous[right_index] + 1,
                    previous[right_index - 1] + (left_character != right_character),
                )
            )
        previous = current
    return previous[-1]


def main() -> None:
    ffmpeg = shutil.which("ffmpeg")
    whisper_cli = shutil.which("whisper-cli")
    if not ffmpeg or not whisper_cli:
        raise RuntimeError("ffmpeg and whisper-cli must be available on PATH")
    if not WHISPER_MODEL.is_file():
        raise FileNotFoundError(WHISPER_MODEL)

    transcript_root = RESULTS_ROOT / "asr"
    transcript_root.mkdir(parents=True, exist_ok=True)
    entries: list[dict[str, object]] = []
    for model_key in ("kokoro", "melo", "moss"):
        benchmark = json.loads((RESULTS_ROOT / f"{model_key}.json").read_text(encoding="utf-8"))
        for case in benchmark["cases"]:
            stem = f"{model_key}-{case['id']}"
            converted_path = transcript_root / f"{stem}-16k.wav"
            transcript_prefix = transcript_root / stem
            subprocess.run(
                [
                    ffmpeg,
                    "-y",
                    "-loglevel",
                    "error",
                    "-i",
                    case["sample_path"],
                    "-ar",
                    "16000",
                    "-ac",
                    "1",
                    str(converted_path),
                ],
                check=True,
            )
            language = case["language"] if case["language"] in {"zh", "en"} else "auto"
            subprocess.run(
                [
                    whisper_cli,
                    "--model",
                    str(WHISPER_MODEL),
                    "--file",
                    str(converted_path),
                    "--threads",
                    "4",
                    "--language",
                    language,
                    "--output-txt",
                    "--output-file",
                    str(transcript_prefix),
                    "--no-timestamps",
                    "--no-prints",
                ],
                check=True,
                stdout=subprocess.DEVNULL,
            )
            transcript_path = transcript_prefix.with_suffix(".txt")
            transcript = transcript_path.read_text(encoding="utf-8").strip()
            reference_normalized = normalize_for_cer(case["text"])
            transcript_normalized = normalize_for_cer(transcript)
            distance = edit_distance(reference_normalized, transcript_normalized)
            entries.append(
                {
                    "model_key": model_key,
                    "case_id": case["id"],
                    "language_setting": language,
                    "reference": case["text"],
                    "transcript": transcript,
                    "normalized_reference": reference_normalized,
                    "normalized_transcript": transcript_normalized,
                    "edit_distance": distance,
                    "reference_characters": len(reference_normalized),
                    "cer": distance / len(reference_normalized) if reference_normalized else None,
                    "transcript_path": str(transcript_path),
                }
            )
            converted_path.unlink(missing_ok=True)

    result = {
        "schema_version": 1,
        "metric": "normalized character error rate",
        "normalization": "Unicode NFKC + casefold + remove punctuation, separators, and control characters",
        "asr_backend": "whisper.cpp whisper-cli",
        "asr_model": str(WHISPER_MODEL),
        "entries": entries,
    }
    result_path = RESULTS_ROOT / "asr.json"
    result_path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                "result_path": str(result_path),
                "cer_by_model_and_case": {
                    f"{item['model_key']}/{item['case_id']}": item["cer"] for item in entries
                },
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()

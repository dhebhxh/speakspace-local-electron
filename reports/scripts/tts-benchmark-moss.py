#!/usr/bin/env python3

from __future__ import annotations

import json
import math
import os
import platform
import statistics
import sys
import time
import types
from pathlib import Path

import numpy as np
import onnxruntime as ort


PROJECT_ROOT = Path(__file__).resolve().parents[2]
CACHE_ROOT = Path(
    os.environ.get(
        "TTS_BENCHMARK_CACHE",
        Path.home() / "Library" / "Caches" / "SpeakSpace-TTS-Benchmark",
    )
).expanduser()
SOURCE_ROOT = Path(
    os.environ.get(
        "MOSS_TTS_SOURCE",
        CACHE_ROOT / "source" / "MOSS-TTS-Nano",
    )
).expanduser()
MODEL_ROOT = Path(
    os.environ.get(
        "MOSS_TTS_MODEL_DIR",
        CACHE_ROOT / "models" / "MOSS-TTS-Nano",
    )
).expanduser()
OUTPUT_ROOT = CACHE_ROOT / "results"
REPEAT_COUNT = int(os.environ.get("TTS_BENCHMARK_REPEATS", "3"))
THREAD_COUNT = int(os.environ.get("TTS_BENCHMARK_THREADS", "4"))


def _install_unused_audio_module_stubs() -> None:
    """The built-in-voice ONNX path never calls torch/torchaudio.

    Upstream imports them for optional reference-audio encoding, so lightweight
    benchmarking stubs the imports instead of installing the much larger
    PyTorch runtime. Voice cloning is intentionally outside this benchmark.
    """

    sys.modules.setdefault("torch", types.ModuleType("torch"))
    sys.modules.setdefault("torchaudio", types.ModuleType("torchaudio"))


def directory_size_bytes(directory: Path) -> int:
    return sum(item.stat().st_size for item in directory.rglob("*") if item.is_file())


def signal_metrics(waveform: np.ndarray) -> dict[str, float | int]:
    flattened = np.asarray(waveform, dtype=np.float32).reshape(-1)
    finite_mask = np.isfinite(flattened)
    finite = flattened[finite_mask]
    return {
        "peak_absolute": float(np.max(np.abs(finite))) if finite.size else 0.0,
        "rms": float(math.sqrt(float(np.mean(np.square(finite))))) if finite.size else 0.0,
        "clipping_ratio": float(np.mean(np.abs(finite) >= 0.999)) if finite.size else 0.0,
        "non_finite_samples": int(flattened.size - finite.size),
    }


def main() -> None:
    _install_unused_audio_module_stubs()
    sys.path.insert(0, str(SOURCE_ROOT))
    from onnx_tts_runtime import OnnxTtsRuntime  # pylint: disable=import-outside-toplevel

    test_cases = json.loads(
        (Path(__file__).parent / "tts-benchmark-inputs.json").read_text(encoding="utf-8")
    )
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)

    load_started = time.perf_counter()
    runtime = OnnxTtsRuntime(
        model_dir=MODEL_ROOT,
        thread_count=THREAD_COUNT,
        sample_mode="fixed",
        execution_provider="cpu",
        output_dir=OUTPUT_ROOT,
    )
    load_ms = (time.perf_counter() - load_started) * 1000
    voices = runtime.list_builtin_voices()
    voice = "Junhao" if any(item.get("voice") == "Junhao" for item in voices) else voices[0]["voice"]
    case_results: list[dict[str, object]] = []

    for test_case in test_cases:
        runs: list[dict[str, float | int]] = []
        sample_path = OUTPUT_ROOT / f"moss-{test_case['id']}.wav"
        for repeat in range(REPEAT_COUNT):
            output_path = sample_path if repeat == 0 else OUTPUT_ROOT / "moss-working.wav"
            started = time.perf_counter()
            result = runtime.synthesize(
                text=test_case["text"],
                voice=voice,
                output_audio_path=output_path,
                sample_mode="fixed",
                do_sample=True,
                streaming=True,
                max_new_frames=375,
                voice_clone_max_text_tokens=75,
                enable_wetext=False,
                enable_normalize_tts_text=True,
                seed=1234,
            )
            synthesis_ms = (time.perf_counter() - started) * 1000
            waveform = np.asarray(result["waveform"], dtype=np.float32)
            sample_rate = int(result["sample_rate"])
            sample_frames = int(waveform.shape[0])
            channel_count = int(waveform.shape[1]) if waveform.ndim == 2 else 1
            audio_seconds = sample_frames / sample_rate
            runs.append(
                {
                    "repeat": repeat + 1,
                    "synthesis_ms": synthesis_ms,
                    "audio_seconds": audio_seconds,
                    "rtf": synthesis_ms / 1000 / audio_seconds,
                    "characters_per_second": len(test_case["text"]) / (synthesis_ms / 1000),
                    "sample_rate_hz": sample_rate,
                    "sample_frames": sample_frames,
                    "channel_count": channel_count,
                    **signal_metrics(waveform),
                }
            )
        working_path = OUTPUT_ROOT / "moss-working.wav"
        if working_path.exists():
            working_path.unlink()
        case_results.append(
            {
                **test_case,
                "voice": voice,
                "sample_path": str(sample_path),
                "median_synthesis_ms": statistics.median(run["synthesis_ms"] for run in runs),
                "median_rtf": statistics.median(run["rtf"] for run in runs),
                "median_audio_seconds": statistics.median(run["audio_seconds"] for run in runs),
                "first_run_signal": {
                    key: runs[0][key]
                    for key in (
                        "peak_absolute",
                        "rms",
                        "clipping_ratio",
                        "non_finite_samples",
                    )
                },
                "runs": runs,
            }
        )

    result = {
        "schema_version": 1,
        "measured_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "model_key": "moss",
        "model_name": "MOSS-TTS-Nano-100M-ONNX",
        "backend": "onnxruntime-python",
        "backend_version": ort.__version__,
        "python_version": platform.python_version(),
        "model_dir": str(MODEL_ROOT),
        "model_size_bytes": directory_size_bytes(MODEL_ROOT),
        "provider": "cpu",
        "thread_count": THREAD_COUNT,
        "repeat_count": REPEAT_COUNT,
        "load_ms": load_ms,
        "reported_sample_rate_hz": int(runtime.codec_meta["codec_config"]["sample_rate"]),
        "reported_channel_count": int(runtime.codec_meta["codec_config"]["channels"]),
        "reported_voices": [item.get("voice") for item in voices],
        "selected_voice": voice,
        "cases": case_results,
    }
    result_path = OUTPUT_ROOT / "moss.json"
    result_path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                "result_path": str(result_path),
                "model": result["model_name"],
                "load_ms": result["load_ms"],
                "median_rtf_by_case": {
                    item["id"]: item["median_rtf"] for item in result["cases"]
                },
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()

#!/usr/bin/env node

/* eslint-disable global-require, import/no-dynamic-require, no-await-in-loop, no-console, no-continue, no-restricted-syntax */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { performance } = require('perf_hooks');

const projectRoot = path.resolve(__dirname, '../..');
const cacheRoot =
  process.env.TTS_BENCHMARK_CACHE ||
  path.join(os.homedir(), 'Library', 'Caches', 'SpeakSpace-TTS-Benchmark');
const outputRoot = path.join(cacheRoot, 'results');
const repeatCount = Number(process.env.TTS_BENCHMARK_REPEATS || 3);
const threadCount = Number(process.env.TTS_BENCHMARK_THREADS || 4);
const engineName = process.argv[2];

if (!['kokoro', 'melo'].includes(engineName)) {
  throw new Error('Usage: tts-benchmark-sherpa.js <kokoro|melo>');
}

const sherpa = require(
  path.join(projectRoot, 'release', 'app', 'node_modules', 'sherpa-onnx-node'),
);
const testCases = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'tts-benchmark-inputs.json'), 'utf8'),
);

function directorySizeBytes(directory) {
  let total = 0;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const itemPath = path.join(directory, entry.name);
    if (entry.isDirectory()) total += directorySizeBytes(itemPath);
    else if (entry.isFile()) total += fs.statSync(itemPath).size;
  }
  return total;
}

function percentile50(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function signalMetrics(samples) {
  let squareSum = 0;
  let peak = 0;
  let clipped = 0;
  let nonFinite = 0;
  for (const sample of samples) {
    if (!Number.isFinite(sample)) {
      nonFinite += 1;
      continue;
    }
    const absolute = Math.abs(sample);
    peak = Math.max(peak, absolute);
    squareSum += sample * sample;
    if (absolute >= 0.999) clipped += 1;
  }
  const finiteCount = samples.length - nonFinite;
  return {
    peak_absolute: peak,
    rms: finiteCount ? Math.sqrt(squareSum / finiteCount) : 0,
    clipping_ratio: finiteCount ? clipped / finiteCount : 0,
    non_finite_samples: nonFinite,
  };
}

function modelDefinition() {
  if (engineName === 'kokoro') {
    const modelDir =
      process.env.SPEAKSPACE_KOKORO_DIR ||
      path.join(
        os.homedir(),
        'Library',
        'Application Support',
        'electron-react-boilerplate',
        'models',
        'tts',
        'kokoro-multi-lang-v1_0',
      );
    return {
      displayName: 'Kokoro multi-lang v1.0',
      modelDir,
      speakerFor: (testCase) => (testCase.language === 'en' ? 0 : 45),
      config: {
        model: {
          kokoro: {
            model: path.join(modelDir, 'model.onnx'),
            voices: path.join(modelDir, 'voices.bin'),
            tokens: path.join(modelDir, 'tokens.txt'),
            dataDir: path.join(modelDir, 'espeak-ng-data'),
            lexicon: [
              path.join(modelDir, 'lexicon-us-en.txt'),
              path.join(modelDir, 'lexicon-zh.txt'),
            ].join(','),
          },
        },
        numThreads: threadCount,
        maxNumSentences: 1,
        silenceScale: 0.2,
        provider: 'cpu',
      },
    };
  }

  const modelDir =
    process.env.SPEAKSPACE_MELO_DIR ||
    path.join(cacheRoot, 'models', 'vits-melo-tts-zh_en');
  return {
    displayName: 'MeloTTS zh_en (sherpa-onnx VITS)',
    modelDir,
    speakerFor: () => 0,
    config: {
      model: {
        vits: {
          model: path.join(modelDir, 'model.onnx'),
          lexicon: path.join(modelDir, 'lexicon.txt'),
          tokens: path.join(modelDir, 'tokens.txt'),
          dictDir: path.join(modelDir, 'dict'),
        },
      },
      ruleFsts: [
        path.join(modelDir, 'phone.fst'),
        path.join(modelDir, 'date.fst'),
        path.join(modelDir, 'number.fst'),
      ].join(','),
      numThreads: threadCount,
      maxNumSentences: 1,
      silenceScale: 0.2,
      provider: 'cpu',
    },
  };
}

async function main() {
  fs.mkdirSync(outputRoot, { recursive: true });
  const definition = modelDefinition();
  const loadStarted = performance.now();
  const tts = await sherpa.OfflineTts.createAsync(definition.config);
  const loadMs = performance.now() - loadStarted;
  const caseResults = [];

  for (const testCase of testCases) {
    const runs = [];
    let firstSignal = null;
    let samplePath = null;
    for (let repeat = 0; repeat < repeatCount; repeat += 1) {
      const started = performance.now();
      const audio = await tts.generateAsync({
        text: testCase.text,
        sid: definition.speakerFor(testCase),
        speed: 1,
        enableExternalBuffer: false,
      });
      const synthesisMs = performance.now() - started;
      const copiedSamples = Float32Array.from(audio.samples);
      const audioSeconds = copiedSamples.length / audio.sampleRate;
      const metrics = signalMetrics(copiedSamples);
      runs.push({
        repeat: repeat + 1,
        synthesis_ms: synthesisMs,
        audio_seconds: audioSeconds,
        rtf: synthesisMs / 1000 / audioSeconds,
        characters_per_second: testCase.text.length / (synthesisMs / 1000),
        sample_rate_hz: audio.sampleRate,
        sample_count: copiedSamples.length,
        ...metrics,
      });
      if (repeat === 0) {
        firstSignal = metrics;
        samplePath = path.join(outputRoot, `${engineName}-${testCase.id}.wav`);
        sherpa.writeWave(samplePath, {
          samples: copiedSamples,
          sampleRate: audio.sampleRate,
        });
      }
    }
    const rtfValues = runs.map((run) => run.rtf);
    const synthesisValues = runs.map((run) => run.synthesis_ms);
    caseResults.push({
      ...testCase,
      speaker_id: definition.speakerFor(testCase),
      sample_path: samplePath,
      median_synthesis_ms: percentile50(synthesisValues),
      median_rtf: percentile50(rtfValues),
      median_audio_seconds: percentile50(runs.map((run) => run.audio_seconds)),
      first_run_signal: firstSignal,
      runs,
    });
  }

  const result = {
    schema_version: 1,
    measured_at: new Date().toISOString(),
    model_key: engineName,
    model_name: definition.displayName,
    backend: 'sherpa-onnx-node',
    backend_version: require(
      path.join(
        projectRoot,
        'release',
        'app',
        'node_modules',
        'sherpa-onnx-node',
        'package.json',
      ),
    ).version,
    model_dir: definition.modelDir,
    model_size_bytes: directorySizeBytes(definition.modelDir),
    provider: 'cpu',
    thread_count: threadCount,
    repeat_count: repeatCount,
    load_ms: loadMs,
    reported_sample_rate_hz: tts.sampleRate,
    reported_speaker_count: tts.numSpeakers,
    cases: caseResults,
  };
  const resultPath = path.join(outputRoot, `${engineName}.json`);
  fs.writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`);
  process.stdout.write(
    `${JSON.stringify({
      result_path: resultPath,
      model: result.model_name,
      load_ms: result.load_ms,
      median_rtf_by_case: Object.fromEntries(
        result.cases.map((item) => [item.id, item.median_rtf]),
      ),
    })}\n`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

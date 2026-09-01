/**
 * 跨机器基准的统一入口。
 *
 *   npm run bench -- --machine 3060-laptop
 *
 * 这是给「在另一台机器上跑一遍」用的一键命令。它做三件事：
 *  1. 采集机器指纹，之后每份结果都归到 results/machines/<machine-id>/ 下；
 *  2. **串行**跑完所有对硬件敏感的基准（顺序固定，中间不并行）；
 *  3. 打包成一份可以直接拷回来的 bundle，供 bench:aggregate 汇总。
 *
 * ## 为什么默认不跑准确率评测
 *
 * 待办提取与 Agent 的准确率取决于模型和提示词，不取决于机器 —— 换台机器重跑几小时
 * 只会得到同样的数字。跨机器真正要看的是速度、内存、GPU 卸载这些。
 * 需要时用 `--with-accuracy` 显式打开。
 *
 * ## 为什么全程串行
 *
 * 速度和内存是时间敏感量，并行会直接让数据作废。本仓库实测过：并行跑一次 `tsc`
 * 就让 Kokoro 的 RTF 从 0.79 掉到 4.4。这个脚本因此刻意不做任何并行，
 * 也会在开始时提醒使用者不要同时做别的事。
 */

/* eslint-disable no-await-in-loop, no-continue, no-restricted-syntax */

import { spawnSync } from 'child_process';
import fs from 'fs';
import http from 'http';
import path from 'path';
import {
  captureMachineProfile,
  describeMachine,
  machineResultsDir,
  writeMachineProfile,
} from './machine-profile';
import type { MachineProfile } from './machine-profile';
import {
  benchmarkResultsRoot,
  PROJECT_ROOT,
  resolveWhisper,
} from './tts-paths';

type Step = {
  id: string;
  title: string;
  script: string;
  args: string[];
  /** 这一步依赖什么，缺了就跳过而不是报错。 */
  requires: 'tts-models' | 'ollama' | 'stt-ready' | 'none';
  /** 产出哪些结果文件（前缀匹配），用于打包。 */
  outputs: string[];
};

const HARDWARE_STEPS: Step[] = [
  {
    id: 'tts',
    title: 'TTS 合成速度与信号（每模型独立子进程）',
    script: 'bench:tts',
    args: ['--repeats', '3'],
    requires: 'tts-models',
    outputs: ['tts-kokoro', 'tts-vits', 'tts-moss'],
  },
  {
    id: 'tts-memory',
    title: 'TTS 内存增长探针（强制 GC 后采样）',
    script: 'bench:tts:memory',
    args: ['--iterations', '8'],
    requires: 'tts-models',
    outputs: ['tts-memory-'],
  },
  {
    id: 'tts-length',
    title: 'TTS 峰值内存 vs 文本长度',
    script: 'bench:tts:length',
    args: [],
    requires: 'tts-models',
    outputs: ['tts-length-'],
  },
  {
    id: 'llm',
    title: 'LLM 推理速度、显存与 GPU 卸载',
    script: 'bench:llm',
    args: ['--repeats', '3'],
    requires: 'ollama',
    outputs: ['llm-runtime'],
  },
  {
    id: 'stt',
    title: 'STT 转写速度（RTF，不算准确率——同一批录音换机器内容不会变）',
    script: 'bench:stt',
    args: ['--speed-only'],
    requires: 'stt-ready',
    outputs: ['stt-human-speed'],
  },
];

const ACCURACY_STEPS: Step[] = [
  {
    id: 'todo',
    title: '待办提取准确率（与机器无关，仅在需要时跑）',
    script: 'bench:todo',
    args: ['--rounds', '3'],
    requires: 'ollama',
    outputs: ['todo-extraction-eval'],
  },
  {
    id: 'agent',
    title: 'Agent 端到端（与机器无关，仅在需要时跑）',
    script: 'bench:agent',
    args: ['--rounds', '1', '--no-judge'],
    requires: 'ollama',
    outputs: ['agent-eval'],
  },
];

function flagValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

type OllamaStatus = {
  reachable: boolean;
  modelCount: number;
};

function ollamaStatus(): Promise<OllamaStatus> {
  return new Promise((resolve) => {
    const request = http.get(
      `${process.env.OLLAMA_HOST ?? 'http://127.0.0.1:11434'}/api/tags`,
      (response) => {
        let raw = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          raw += chunk;
        });
        response.on('end', () => {
          if (response.statusCode !== 200) {
            resolve({ reachable: false, modelCount: 0 });
            return;
          }
          try {
            const parsed = JSON.parse(raw) as { models?: unknown[] };
            resolve({
              reachable: true,
              modelCount: parsed.models?.length ?? 0,
            });
          } catch {
            resolve({ reachable: true, modelCount: 0 });
          }
        });
      },
    );
    request.on('error', () => resolve({ reachable: false, modelCount: 0 }));
    request.setTimeout(3000, () => {
      request.destroy();
      resolve({ reachable: false, modelCount: 0 });
    });
  });
}

function ttsModelsReady(): boolean {
  // 复用 fetch 脚本的判断逻辑：它只在缺模型时才会真的去下载
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const result = spawnSync(npm, ['run', 'bench:tts:fetch'], {
    cwd: PROJECT_ROOT,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  return result.status === 0;
}

/**
 * whisper 可执行文件和 STT 模型来自应用自己的运行时安装，不像 TTS 模型那样
 * 有一个独立的 fetch 脚本可以自动下载——这里只做只读检查，缺了就跳过，
 * 不会像 ttsModelsReady() 那样去尝试装。录音文件也一并检查：这批文件
 * 不一定跟着仓库分发到每台机器，缺了同样跳过而不是报错中断整个基准。
 */
function sttReady(): boolean {
  const whisper = resolveWhisper();
  if (!whisper.binary || whisper.models.length === 0) return false;
  const recordingDir = path.join(
    PROJECT_ROOT,
    'docs',
    'testing',
    'datasets',
    'stt-human-recordings',
  );
  return fs.existsSync(recordingDir) && fs.readdirSync(recordingDir).length > 0;
}

function runStep(step: Step): { ok: boolean; elapsedMs: number } {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const started = Date.now();
  const result = spawnSync(npm, ['run', step.script, '--', ...step.args], {
    cwd: PROJECT_ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  return { ok: result.status === 0, elapsedMs: Date.now() - started };
}

/**
 * 把这一轮产出的结果文件复制进本机目录。
 *
 * 各个基准脚本仍然写到扁平的 results/ 下（不改它们，避免为了打包去动测量代码），
 * 这里在跑完之后按前缀归集。同一台机器重复跑会覆盖自己的那份，不会碰别人的。
 */
type OutputSnapshot = Map<string, string>;

function outputPrefixes(steps: Step[]): string[] {
  return steps.flatMap((step) => step.outputs);
}

function snapshotOutputs(steps: Step[]): OutputSnapshot {
  const root = benchmarkResultsRoot();
  if (!fs.existsSync(root)) return new Map();
  const prefixes = outputPrefixes(steps);
  return new Map(
    fs
      .readdirSync(root)
      .filter(
        (name) =>
          name.endsWith('.json') &&
          prefixes.some((prefix) => name.startsWith(prefix)),
      )
      .map((name) => {
        const stat = fs.statSync(path.join(root, name));
        return [name, `${stat.mtimeMs}:${stat.size}`];
      }),
  );
}

function collectOutputs(
  profile: MachineProfile,
  steps: Step[],
  before: OutputSnapshot,
): string[] {
  const flat = benchmarkResultsRoot();
  const target = machineResultsDir(profile);
  fs.mkdirSync(target, { recursive: true });
  const prefixes = outputPrefixes(steps);
  const copied: string[] = [];
  if (!fs.existsSync(flat)) return copied;
  for (const name of fs.readdirSync(flat)) {
    if (!name.endsWith('.json')) continue;
    if (!prefixes.some((prefix) => name.startsWith(prefix))) continue;
    const source = path.join(flat, name);
    const stat = fs.statSync(source);
    if (before.get(name) === `${stat.mtimeMs}:${stat.size}`) continue;
    fs.copyFileSync(source, path.join(target, name));
    copied.push(name);
  }

  const copiedSet = new Set(copied);
  for (const name of fs.readdirSync(target)) {
    if (name === 'machine.json' || name === 'run-manifest.json') continue;
    if (!name.endsWith('.json')) continue;
    if (!prefixes.some((prefix) => name.startsWith(prefix))) continue;
    if (!copiedSet.has(name)) fs.unlinkSync(path.join(target, name));
  }
  return copied;
}

async function main(): Promise<void> {
  const profile = captureMachineProfile();
  const withAccuracy = process.argv.includes('--with-accuracy');
  const only = flagValue('--only');
  const steps = [
    ...HARDWARE_STEPS,
    ...(withAccuracy ? ACCURACY_STEPS : []),
  ].filter((step) => !only || only.split(',').includes(step.id));
  const outputSnapshot = snapshotOutputs(steps);

  process.stdout.write(
    `${'='.repeat(64)}\n${describeMachine(profile)}\n${'='.repeat(64)}\n\n` +
      '⚠ 跑基准期间请不要同时做别的事。速度与内存是时间敏感量，\n' +
      '  并行会让数据作废（实测：并行一次 tsc 让 RTF 从 0.79 掉到 4.4）。\n\n',
  );

  const ollama = await ollamaStatus();
  const hasOllama = ollama.reachable && ollama.modelCount > 0;
  const needsTts = steps.some((step) => step.requires === 'tts-models');
  const hasTts = needsTts ? ttsModelsReady() : false;
  const needsStt = steps.some((step) => step.requires === 'stt-ready');
  const hasStt = needsStt ? sttReady() : false;
  if (!ollama.reachable) {
    process.stdout.write('Ollama 未运行：LLM 相关步骤会跳过。\n');
  } else if (ollama.modelCount === 0) {
    process.stdout.write('Ollama 中没有已安装模型：LLM 相关步骤会跳过。\n');
  }
  if (needsTts && !hasTts) {
    process.stdout.write('TTS 模型未就绪：TTS 相关步骤会跳过。\n');
  }
  if (needsStt && !hasStt) {
    process.stdout.write(
      'STT 未就绪（whisper 运行时/模型未装，或缺少录音文件）：STT 速度步骤会跳过。\n',
    );
  }
  process.stdout.write('\n');

  const executed: Record<string, unknown>[] = [];
  for (const [index, step] of steps.entries()) {
    const available =
      step.requires === 'none' ||
      (step.requires === 'ollama' && hasOllama) ||
      (step.requires === 'tts-models' && hasTts) ||
      (step.requires === 'stt-ready' && hasStt);
    if (!available) {
      process.stdout.write(
        `[${index + 1}/${steps.length}] 跳过 ${step.title}（依赖不满足）\n\n`,
      );
      executed.push({ id: step.id, status: 'skipped', reason: step.requires });
      continue;
    }
    process.stdout.write(
      `[${index + 1}/${steps.length}] ${step.title}\n${'-'.repeat(64)}\n`,
    );
    const { ok, elapsedMs } = runStep(step);
    executed.push({
      id: step.id,
      status: ok ? 'ok' : 'failed',
      elapsed_ms: elapsedMs,
    });
    process.stdout.write(
      `${ok ? '完成' : '失败'} · ${(elapsedMs / 1000).toFixed(0)}s\n\n`,
    );
  }

  writeMachineProfile(profile);
  const copied = collectOutputs(profile, steps, outputSnapshot);
  const manifest = {
    schema_version: 1,
    machine: profile,
    ran_at: new Date().toISOString(),
    with_accuracy: withAccuracy,
    steps: executed,
    files: copied,
  };
  const dir = machineResultsDir(profile);
  fs.writeFileSync(
    path.join(dir, 'run-manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  process.stdout.write(
    `${'='.repeat(64)}\n本机结果目录：\n  ${dir}\n\n` +
      `共 ${copied.length} 份结果文件。\n\n` +
      '把整个目录拷回主控机的同名路径下，然后运行：\n' +
      '  npm run bench:aggregate\n' +
      '即可生成多机对比总表与图表。\n',
  );
}

main().catch((error) => {
  process.stderr.write(`${error?.stack ?? error}\n`);
  process.exitCode = 1;
});

/**
 * 把基准结果 JSON 画成 SVG 图，输出到 docs/testing/charts/。
 *
 * 只画数据真的支持的图。缺哪份结果就跳过对应的图，不会用占位数据凑数。
 *
 *   npm run bench:charts
 */

/* eslint-disable no-await-in-loop, no-continue, no-restricted-syntax */

import fs from 'fs';
import path from 'path';
import {
  gridPanel,
  groupedBarChart,
  horizontalBarChart,
  lineChart,
  scatterChart,
  stackedBarChart,
} from './chart-svg';
import { benchmarkResultsRoot, PROJECT_ROOT } from './tts-paths';

type Json = Record<string, any>;

const RESULTS = benchmarkResultsRoot();
const CHARTS = path.join(PROJECT_ROOT, 'docs', 'testing', 'charts');

/** 模型的展示顺序固定，颜色才能在所有图之间保持一致。 */
const MODEL_ORDER = [
  'kokoro-multi-lang-v1_0',
  'vits-melo-tts-zh_en',
  'moss-tts-nano-100m-onnx',
];

function readJson(file: string): Json | null {
  const full = path.join(RESULTS, file);
  if (!fs.existsSync(full)) return null;
  return JSON.parse(fs.readFileSync(full, 'utf8')) as Json;
}

function readAll(prefix: string, requireField?: string): Json[] {
  if (!fs.existsSync(RESULTS)) return [];
  return fs
    .readdirSync(RESULTS)
    .filter((name) => name.startsWith(prefix) && name.endsWith('.json'))
    .map((name) => readJson(name))
    .filter(
      (item): item is Json =>
        item !== null && (!requireField || item[requireField] !== undefined),
    )
    .sort(
      (a, b) =>
        MODEL_ORDER.indexOf(String(a.model_id)) -
        MODEL_ORDER.indexOf(String(b.model_id)),
    );
}

const written: string[] = [];

function write(name: string, svg: string): void {
  fs.mkdirSync(CHARTS, { recursive: true });
  fs.writeFileSync(path.join(CHARTS, name), `${svg}\n`);
  written.push(name);
}

const mib = (bytes: number) => bytes / 1024 / 1024;
const pct = (value: number) => `${(value * 100).toFixed(0)}%`;

/* ------------------------------ TTS 性能 ------------------------------ */

function ttsCharts(): void {
  const models = readAll('tts-', 'overall').filter(
    (item) => item.by_language !== undefined,
  );
  if (models.length === 0) return;
  const names = models.map((model) => String(model.model_name));
  const env = `${models[0].platform.cpu} · ${models[0].repeat_count} 次重复 · CPU 4 线程`;

  write(
    'tts-rtf-by-language.svg',
    groupedBarChart({
      title: 'TTS 合成速度：分语言 P50 实时因子（RTF）',
      subtitle: env,
      categories: ['中文', '英文', '中英混合'],
      series: models.map((model) => ({
        name: String(model.model_name),
        values: ['zh', 'en', 'zh-en'].map(
          (language) => model.by_language[language].p50_rtf as number,
        ),
      })),
      yLabel: 'RTF（越低越快）',
      referenceLine: { value: 1, label: 'RTF = 1，合成速度等于播放速度' },
      caption:
        'RTF = 合成耗时 ÷ 音频时长。三个模型在全部三类语言上都快于实时，速度不构成区分点。',
    }),
  );

  const categories = Object.keys(models[0].by_category as Json);
  write(
    'tts-rtf-p95-by-category.svg',
    groupedBarChart({
      title: 'TTS 合成速度：分内容类别 P95 RTF',
      subtitle: env,
      categories,
      series: models.map((model) => ({
        name: String(model.model_name),
        values: categories.map(
          (category) => model.by_category[category]?.p95_rtf ?? null,
        ),
      })),
      yLabel: 'P95 RTF',
      referenceLine: { value: 1, label: 'RTF = 1' },
      showValues: false,
      caption:
        '取 P95 而不是中位数，是为了看最坏情况：Kokoro 在中英混合类文本上会越过实时线。',
    }),
  );

  write(
    'tts-rtf-vs-length.svg',
    lineChart({
      title: 'TTS 合成速度随文本长度的变化',
      subtitle: env,
      series: models.map((model) => ({
        name: String(model.model_name),
        points: (model.cases as Json[])
          .filter((item) => item.median_rtf !== null)
          .map((item) => ({
            x: Number(item.text_length),
            y: Number(item.median_rtf),
          })),
      })),
      xLabel: '文本长度（字符）',
      yLabel: '中位 RTF',
      formatY: (value) => value.toFixed(2),
      referenceLine: { value: 1, label: 'RTF = 1' },
      caption:
        'RTF 基本与长度无关，说明合成耗时随文本近似线性增长 —— 长文本不会额外变慢。',
    }),
  );

  write(
    'tts-synthesis-vs-audio.svg',
    scatterChart({
      title: '合成耗时 vs 生成音频时长（每个点是一条测试文本）',
      subtitle: env,
      series: models.map((model) => ({
        name: String(model.model_name),
        points: (model.cases as Json[])
          .filter((item) => item.median_rtf !== null)
          .map((item) => ({
            x: Number(item.median_audio_seconds),
            y: Number(item.median_synthesis_ms) / 1000,
          })),
      })),
      xLabel: '音频时长（秒）',
      yLabel: '合成耗时（秒）',
      formatX: (value) => `${value.toFixed(0)}s`,
      formatY: (value) => `${value.toFixed(0)}s`,
      diagonal: true,
      caption:
        '所有点都落在红色实时线下方，即三个模型在全部 36 条文本上都快于实时播放。',
    }),
  );

  write(
    'tts-peak-memory.svg',
    horizontalBarChart({
      title: 'TTS 跑完全部 36 条语料的峰值内存',
      subtitle: env,
      categories: names,
      series: [
        {
          name: '峰值 RSS',
          values: models.map((model) => mib(Number(model.peak_rss_bytes))),
        },
      ],
      format: (value) =>
        value >= 1024
          ? `${(value / 1024).toFixed(1)} GiB`
          : `${value.toFixed(0)} MiB`,
      caption:
        'MOSS 的峰值比另外两个高一个数量级。它是单次请求的瞬时开销，不是泄漏 —— 见下一张图。',
    }),
  );
}

/* ------------------------------ 内存行为 ------------------------------ */

function memoryCharts(): void {
  const probes = readAll('tts-memory-', 'phases');
  if (probes.length > 0) {
    write(
      'tts-memory-iterations.svg',
      lineChart({
        title: '连续合成时的常驻内存：会不会一直涨？',
        subtitle: `每次合成后强制 GC 再采样 · 前 8 次为短句（24 字），后 8 次为长文本（315 字）`,
        series: probes.map((probe) => ({
          name: String(probe.model_name),
          points: (probe.phases as Json[]).flatMap((phase, phaseIndex) =>
            (phase.samples as Json[]).map((sample) => ({
              x: phaseIndex * 8 + Number(sample.iteration),
              y: mib(Number(sample.rss_bytes)),
            })),
          ),
        })),
        xLabel: '第几次合成（1–8 短句，9–16 长文本）',
        yLabel: 'RSS（MiB，强制 GC 后）',
        logY: true,
        formatY: (value) =>
          value >= 1024
            ? `${(value / 1024).toFixed(1)}G`
            : `${value.toFixed(0)}M`,
        caption:
          '三条线都走平，说明重复调用不会无限累积。第 9 次的台阶是换长文本造成的一次性跳变，不是泄漏。',
      }),
    );
  }

  const lengths = readAll('tts-length-', 'samples');
  if (lengths.length > 0) {
    const machineMemory = mib(Number(lengths[0].machine_memory_bytes));
    write(
      'tts-memory-vs-length.svg',
      lineChart({
        title: '峰值内存随文本长度的变化（决定最低内存门槛）',
        subtitle: `合成期间每 50 ms 采样 RSS 取最大值 · 本机内存 ${(machineMemory / 1024).toFixed(1)} GiB`,
        series: lengths.map((probe) => ({
          name: String(probe.model_name),
          points: (probe.samples as Json[])
            .filter((sample) => sample.error === null)
            .map((sample) => ({
              x: Number(sample.text_length),
              y: mib(Number(sample.peak_rss_bytes)),
            })),
        })),
        xLabel: '文本长度（字符）',
        yLabel: '峰值 RSS（对数轴）',
        logY: true,
        formatY: (value) =>
          value >= 1024
            ? `${(value / 1024).toFixed(0)} GiB`
            : `${value.toFixed(0)} MiB`,
        referenceLine: { value: 16 * 1024, label: '16 GiB 机器的物理内存上限' },
        caption:
          '这是本轮最重要的一张图：两个 sherpa 模型几乎是平的，MOSS 合成 1196 字需要约 10 GiB。',
      }),
    );
  }
}

/* -------------------------------- ASR -------------------------------- */

function asrCharts(): void {
  const asr = readJson('tts-asr.json');
  const models = readAll('tts-', 'overall').filter(
    (item) => item.by_language !== undefined,
  );
  if (!asr || models.length === 0) return;
  const entries = models
    .map((model) => ({
      name: String(model.model_name),
      data: (asr.models as Json)[String(model.model_id)],
    }))
    .filter((item) => item.data);
  if (entries.length === 0) return;

  write(
    'tts-cer-by-language.svg',
    groupedBarChart({
      title: 'Whisper 回转录字符错误率（CER）：分语言',
      subtitle: `回转录模型 ${path.basename(String(asr.whisper_model))} · 越低表示合成语音越容易被听懂`,
      categories: ['中文', '英文', '中英混合'],
      series: entries.map((item) => ({
        name: item.name,
        values: ['zh', 'en', 'zh-en'].map(
          (language) => item.data.mean_cer_by_language[language] as number,
        ),
      })),
      yLabel: 'CER（越低越好）',
      format: (value) => pct(value),
      caption:
        '这是低置信度代理：ASR 自身的错误也会算进来。它不能替代人工听测，但可以横向比较。',
    }),
  );

  const categories = Object.keys(entries[0].data.mean_cer_by_category as Json);
  write(
    'tts-cer-by-category.svg',
    groupedBarChart({
      title: 'Whisper 回转录 CER：分内容类别',
      subtitle: '人名与缩写这两类最能暴露词典覆盖差异',
      categories,
      series: entries.map((item) => ({
        name: item.name,
        values: categories.map(
          (category) => item.data.mean_cer_by_category[category] ?? null,
        ),
      })),
      yLabel: 'CER',
      format: (value) => pct(value),
      showValues: false,
      caption:
        'MeloTTS 在人名（35%）和缩写（29%）上明显更差，与它运行时报出的词典 OOV 警告一致。',
    }),
  );

  const lengths = readAll('tts-length-', 'samples');
  if (lengths.length > 0) {
    write(
      'tts-tradeoff.svg',
      scatterChart({
        title: '三项指标的权衡：速度、内存、可懂度',
        subtitle: '横轴越左越快，纵轴越低越省内存，圆点旁标注平均 CER',
        series: entries.map((item, index) => {
          const model = models[index];
          const length = lengths.find(
            (probe) => probe.model_id === model.model_id,
          );
          return {
            // 这里要一位小数：Kokoro 10.3% 与 MOSS 9.7% 取整后都是 10%，区分就没了
            name: `${item.name}（CER ${(item.data.mean_cer * 100).toFixed(1)}%）`,
            points: [
              {
                x: Number(model.overall.p50_rtf),
                y: mib(
                  Number(length?.max_peak_rss_bytes ?? model.peak_rss_bytes),
                ),
              },
            ],
          };
        }),
        xLabel: 'P50 RTF（越低越快）',
        yLabel: '最长文本峰值 RSS（MiB）',
        formatX: (value) => value.toFixed(2),
        formatY: (value) =>
          value >= 1024
            ? `${(value / 1024).toFixed(0)}G`
            : `${value.toFixed(0)}M`,
        caption:
          '三个指标的第一名不是同一个模型：MOSS 最快但最费内存，MeloTTS 最省但可懂度最差。',
      }),
    );
  }
}

/* ------------------------------ 真人 STT 评测 ------------------------------ */

const STT_MODEL_ORDER = ['tiny', 'base', 'small', 'large-v1'];

function sttCharts(): void {
  const data = readJson('stt-human.json');
  if (!data) return;
  const modelIds = Object.keys(data.models as Json).sort(
    (a, b) => STT_MODEL_ORDER.indexOf(a) - STT_MODEL_ORDER.indexOf(b),
  );
  if (modelIds.length === 0) return;
  const models = data.models as Json;
  const subtitle = `真人朗读 · 中文母语者 · whisper.cpp ${modelIds.length} 个模型对比 · docs/testing/stt-recording-protocol.md`;

  write(
    'stt-cer-by-segment.svg',
    groupedBarChart({
      title: '真人 STT 字符错误率（CER）：安静朗读 vs 背景噪音',
      subtitle,
      categories: ['A 段 · 安静朗读', 'C 段 · 有背景噪音'],
      series: modelIds.map((id) => ({
        name: id,
        values: ['A', 'C'].map(
          (segment) =>
            (models[id].by_segment as Json)[segment].mean_cer as number,
        ),
      })),
      yLabel: 'CER（越低越好）',
      format: (value) => pct(value),
      caption:
        'C 段的 9 条文本是 A 段 36 条里的一个子集，同一人读，条件差异是背景噪音。' +
        '但每条只录了一次，差值里混着噪音影响和单次朗读的自然波动，不能拆开看。',
    }),
  );

  write(
    'stt-cer-by-language.svg',
    groupedBarChart({
      title: '真人 STT CER：分语言（仅统计 A+C 逐字朗读段）',
      subtitle,
      categories: ['中文', '英文', '中英混合'],
      series: modelIds.map((id) => ({
        name: id,
        values: ['zh', 'en', 'zh-en'].map(
          (language) =>
            (models[id].mean_cer_by_language_AC as Json)[language] as number,
        ),
      })),
      yLabel: 'CER（越低越好）',
      format: (value) => pct(value),
      caption:
        '朗读者是中文母语者，英文朗读存在自然的发音与用词偏差 —— 这里测的是真实使用场景，不是朗读标准度。',
    }),
  );

  write(
    'stt-content-recall-by-segment.svg',
    groupedBarChart({
      title: '内容覆盖率：三段录音条件对比',
      subtitle: `${subtitle} · 覆盖率 = 原文的字/词有多少比例出现在转写里，不看顺序`,
      categories: [
        'A 安静朗读（逐字）',
        'B 自然复述（不逐字）',
        'C 背景噪音（逐字）',
      ],
      series: modelIds.map((id) => ({
        name: id,
        values: ['A', 'B', 'C'].map(
          (segment) =>
            (models[id].by_segment as Json)[segment]
              .mean_content_recall as number,
        ),
      })),
      yLabel: '内容覆盖率',
      format: (value) => pct(value),
      caption:
        'B 段是看一眼原文合上后用自己的话复述，不要求逐字一致，所以只看覆盖率不看 CER。' +
        '覆盖率没有做虚词过滤，绝对值会偏高，看 A/B/C 三者的相对差异比看单一数值更有意义。',
    }),
  );

  write(
    'stt-speed-vs-accuracy.svg',
    scatterChart({
      title: 'STT 模型选择：速度 vs 准确率',
      subtitle: `${subtitle} · 横轴 RTF 越低越快，纵轴 CER 越低越准`,
      series: modelIds.map((id) => ({
        name: `${id}（CER ${pct(models[id].mean_cer_strict_AC as number)}）`,
        points: [
          {
            x: Number(models[id].mean_rtf),
            y: Number(models[id].mean_cer_strict_AC) * 100,
          },
        ],
      })),
      xLabel: 'RTF（越低越快，CPU 推理）',
      yLabel: 'CER %（越低越准）',
      formatX: (value) => value.toFixed(2),
      formatY: (value) => `${value.toFixed(0)}%`,
      caption:
        '越靠左下越好。模型越大不一定线性地换来更低的 CER —— 具体差多少看图，不要只看参数量猜。',
    }),
  );
}

/* ---------------------------- 待办提取评测 ---------------------------- */

function todoCharts(): void {
  const data = readJson('todo-extraction-eval.json');
  if (!data) return;
  const mean = data.mean_across_rounds as Json;
  const rounds = data.rounds as Json[];

  write(
    'todo-dev-vs-holdout.svg',
    groupedBarChart({
      title: '待办提取：开发集 vs 保留集',
      subtitle: `${data.model} · 温度 ${data.temperature} · ${data.rounds_run} 轮平均 · ${data.case_count} 条用例`,
      categories: ['用例通过率', 'Precision', 'Recall', 'F1', '日期准确率'],
      series: [
        {
          name: '开发集 dev（调提示词时用过，22 条）',
          values: [
            mean.dev.case_pass_rate,
            mean.dev.precision,
            mean.dev.recall,
            mean.dev.f1,
            mean.dev.date_accuracy,
          ],
        },
        {
          name: '保留集 holdout（提示词冻结后才写，32 条）',
          values: [
            mean.holdout.case_pass_rate,
            mean.holdout.precision,
            mean.holdout.recall,
            mean.holdout.f1,
            mean.holdout.date_accuracy,
          ],
        },
      ],
      yLabel: '比例',
      format: (value) => pct(value),
      caption:
        '两者之差就是泛化差距。开发集上的 90.9% 恰好等于旧报告里的 20/22 —— 那个数字没错，只是测在调过的用例上。',
    }),
  );

  const scenarios = Object.keys(rounds[0].by_scenario as Json);
  const ordered = scenarios
    .map((scenario) => ({
      scenario,
      item: (rounds[0].by_scenario as Json)[scenario],
    }))
    .sort((a, b) => a.item.case_pass_rate - b.item.case_pass_rate);
  write(
    'todo-by-scenario.svg',
    horizontalBarChart({
      title: '待办提取：分场景用例通过率（第 1 轮）',
      subtitle: '用例通过 = 无漏检、无多抽、日期与重复类型全对',
      categories: ordered.map((entry) => entry.scenario),
      series: [
        {
          name: '通过率',
          values: ordered.map((entry) => entry.item.case_pass_rate as number),
        },
      ],
      annotations: ordered.map(
        (entry) => `${entry.item.passed_cases}/${entry.item.case_count}`,
      ),
      max: 1,
      caption:
        '假阳性、任务归属、隐晦任务这几类全对；同日多任务与长文本是当前最弱的环节。',
    }),
  );

  // 失败原因构成：问题描述里带前缀，直接按前缀归类。
  const buckets: { label: string; test: (problem: string) => boolean }[] = [
    { label: '彻底漏检', test: (p) => p.startsWith('漏检') },
    { label: '合并进其他任务', test: (p) => p.startsWith('合并进其他任务') },
    { label: '日期错误', test: (p) => p.startsWith('日期错误') },
    { label: '多抽（假阳性）', test: (p) => p.startsWith('多抽') },
    { label: '重复类型错误', test: (p) => p.startsWith('重复类型错误') },
  ];
  const counts = buckets.map(
    (bucket) =>
      (rounds[0].scores as Json[])
        .flatMap((score) => score.problems as string[])
        .filter((problem) => bucket.test(problem)).length,
  );
  if (counts.some((value) => value > 0)) {
    write(
      'todo-failure-types.svg',
      horizontalBarChart({
        title: '待办提取：失败原因构成（第 1 轮，全部 54 条用例）',
        subtitle: '按问题类型统计出现次数，同一条用例可能命中多个类型',
        categories: buckets.map((bucket) => bucket.label),
        series: [{ name: '出现次数', values: counts }],
        format: (value) => `${value.toFixed(0)} 次`,
        caption:
          '「合并」指模型把并列分句压成一条任务：用户仍能看到这件事，但没有独立条目和独立日期，产品影响与彻底漏掉不同。',
      }),
    );
  }

  write(
    'todo-round-stability.svg',
    lineChart({
      title: '待办提取：多轮稳定性',
      subtitle: `温度 ${data.temperature} 下重复跑 ${data.rounds_run} 轮`,
      series: [
        {
          name: 'Precision',
          points: rounds.map((round) => ({
            x: Number(round.round),
            y: Number(round.overall.precision),
          })),
        },
        {
          name: 'Recall',
          points: rounds.map((round) => ({
            x: Number(round.round),
            y: Number(round.overall.recall),
          })),
        },
        {
          name: 'F1',
          points: rounds.map((round) => ({
            x: Number(round.round),
            y: Number(round.overall.f1),
          })),
        },
        {
          name: '日期准确率',
          points: rounds.map((round) => ({
            x: Number(round.round),
            y: Number(round.overall.date_accuracy),
          })),
        },
      ],
      xLabel: '第几轮',
      yLabel: '比例',
      formatX: (value) => `第 ${value.toFixed(0)} 轮`,
      formatY: (value) => pct(value),
      showPointLabels: true,
      caption:
        '几乎重合，说明该温度下输出接近确定性，报告里的数字不是单次抽样的运气。',
    }),
  );
}

/* ------------------------------ Agent 评测 ------------------------------ */

function agentCharts(): void {
  const data = readJson('agent-eval.json');
  if (!data) return;
  const rounds = data.rounds as Json[];
  const mean = data.mean_across_rounds as Json;
  const subtitle = `${data.model} · ${data.embedding_model} · ${data.rounds_run} 轮 · ${data.dataset.task_count} 个任务`;

  write(
    'agent-dev-vs-holdout.svg',
    groupedBarChart({
      title: 'Agent 端到端：开发集 vs 保留集',
      subtitle,
      categories: [
        '严格完成率',
        '事实覆盖率',
        '答案模式',
        'Judge 通过',
        'Groundedness',
      ],
      series: [
        {
          name: `开发集 dev（${mean.dev.case_count} 个）`,
          values: [
            mean.dev.case_pass_rate,
            mean.dev.fact_coverage,
            mean.dev.answer_mode_accuracy,
            mean.dev.judge_pass_rate,
            mean.dev.groundedness,
          ],
        },
        {
          name: `保留集 holdout（${mean.holdout.case_count} 个）`,
          values: [
            mean.holdout.case_pass_rate,
            mean.holdout.fact_coverage,
            mean.holdout.answer_mode_accuracy,
            mean.holdout.judge_pass_rate,
            mean.holdout.groundedness,
          ],
        },
      ],
      yLabel: '比例',
      format: pct,
      caption:
        '严格完成率来自可复核规则；Judge 与 Groundedness 尚待人工盲审校准，不能单独作为最终结论。',
    }),
  );

  // 分母必须写进图里：图会被单独复制进幻灯片，脱离报告正文后
  // 一行三位小数的 IR 指标很容易被当成大样本结果。
  const retrievalRuns = rounds.reduce(
    (sum, round) =>
      sum +
      (round.cases as Json[]).filter(
        (item) => item.score?.retrieval?.recall_at_8 !== null,
      ).length,
    0,
  );
  const retrievalTaskCount = new Set(
    rounds.flatMap((round) =>
      (round.cases as Json[])
        .filter((item) => item.score?.retrieval?.recall_at_8 !== null)
        .map((item) => String(item.score.id)),
    ),
  ).size;

  write(
    'agent-retrieval.svg',
    groupedBarChart({
      title: `Agent 首次真实检索的排名质量（n=${retrievalRuns}，样本量很小）`,
      subtitle: `${subtitle} · 其中 ${retrievalTaskCount} 个任务需要全库检索`,
      categories: [
        'Recall@1',
        'Recall@3',
        'Recall@5',
        'Recall@8',
        'MRR',
        'nDCG@8',
      ],
      series: [
        {
          name: '首次 search_notes 返回结果',
          values: [
            mean.overall.recall_at_1,
            mean.overall.recall_at_3,
            mean.overall.recall_at_5,
            mean.overall.recall_at_8,
            mean.overall.mrr,
            mean.overall.ndcg_at_8,
          ],
        },
      ],
      yLabel: '比例',
      format: pct,
      caption:
        `只统计要求全库检索的任务，关联笔记直接预载不计入。单个任务翻面即可改变约 ` +
        `${(100 / Math.max(retrievalTaskCount, 1)).toFixed(1)} 个百分点，仅作方向性观察。`,
    }),
  );

  const scenarios = Object.keys(rounds[0].by_scenario as Json);
  const scenarioMean = (scenario: string, field: string): number =>
    rounds.reduce(
      (sum, round) => sum + Number(round.by_scenario[scenario][field] ?? 0),
      0,
    ) / rounds.length;
  const ordered = scenarios.sort(
    (left, right) =>
      scenarioMean(left, 'case_pass_rate') -
      scenarioMean(right, 'case_pass_rate'),
  );
  write(
    'agent-by-scenario.svg',
    horizontalBarChart({
      title: 'Agent 端到端：分任务类型严格完成率',
      subtitle,
      categories: ordered,
      series: [
        {
          name: '严格完成率',
          values: ordered.map((scenario) =>
            scenarioMean(scenario, 'case_pass_rate'),
          ),
        },
      ],
      max: 1,
      format: pct,
      caption:
        '严格通过要求关键事实、答案模式、范围与必要副作用同时正确；一条任务任一关键条件失败即不通过。',
    }),
  );

  write(
    'agent-efficiency.svg',
    groupedBarChart({
      title: 'Agent 工具调用与模型循环步数',
      subtitle,
      categories: ordered,
      series: [
        {
          name: '平均工具调用',
          values: ordered.map((scenario) =>
            scenarioMean(scenario, 'mean_tool_calls'),
          ),
        },
        {
          name: '平均模型轮数',
          values: ordered.map((scenario) =>
            scenarioMean(scenario, 'mean_model_turns'),
          ),
        },
      ],
      yLabel: '次数 / 任务',
      format: (value) => value.toFixed(2),
      caption:
        '模型轮数 = 工具调用轮次 + 最终回答轮次；它对应编排器的 6 步预算口径。',
    }),
  );

  const meanAgentSeconds = (scenario: string): number => {
    const values = rounds.flatMap((round) =>
      (round.cases as Json[])
        .filter((item) => item.task.scenario === scenario)
        .map((item) => Number(item.agent_elapsed_ms) / 1000),
    );
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  };
  write(
    'agent-latency-by-scenario.svg',
    groupedBarChart({
      title: 'Agent 端到端延迟（不含 Judge）',
      subtitle,
      categories: ordered,
      series: [
        {
          name: '平均 Agent 延迟',
          values: ordered.map(meanAgentSeconds),
        },
      ],
      yLabel: '秒 / 任务',
      format: (value) => `${value.toFixed(1)}s`,
      caption:
        '计时从 Agent 编排器开始到最终答案结束；Judge 使用独立计时列，不会污染产品链路延迟。',
    }),
  );

  write(
    'agent-round-stability.svg',
    lineChart({
      title: 'Agent 端到端多轮稳定性',
      subtitle,
      series: [
        {
          name: '严格完成率',
          points: rounds.map((round) => ({
            x: Number(round.round),
            y: Number(round.overall.case_pass_rate),
          })),
        },
        {
          name: 'Judge 通过率',
          points: rounds.map((round) => ({
            x: Number(round.round),
            y: Number(round.overall.judge_pass_rate),
          })),
        },
        {
          name: '事实覆盖率',
          points: rounds.map((round) => ({
            x: Number(round.round),
            y: Number(round.overall.fact_coverage),
          })),
        },
      ],
      xLabel: '轮次',
      yLabel: '比例',
      formatX: (value) => `第 ${value.toFixed(0)} 轮`,
      formatY: pct,
      showPointLabels: true,
      caption:
        '同一模型、温度和数据集重复运行；轮间差异反映 Agent 工具选择与回答的随机性。',
    }),
  );
}

/* ------------------------------ 检索质量（跳过 LLM） ------------------------------ */

function retrievalCharts(): void {
  const data = readJson('embedding-retrieval.json');
  if (!data) return;
  const overall = data.overall as Json;
  const bySplit = data.by_split as Json;
  const byScenario = data.by_scenario as Json;
  const subtitle = `${data.embedding_model} · ${data.dataset.gold_task_count} 个有金标的任务（直接用 instruction 当查询词，跳过 LLM）`;

  const metricCategories = [
    'Recall@1',
    'Recall@3',
    'Recall@5',
    'Recall@8',
    'MRR',
    'nDCG@8',
  ];
  const metricValues = (bucket: Json) => [
    bucket.recall_at_1,
    bucket.recall_at_3,
    bucket.recall_at_5,
    bucket.recall_at_8,
    bucket.mrr,
    bucket.ndcg_at_8,
  ];

  write(
    'retrieval-dev-vs-holdout.svg',
    groupedBarChart({
      title: '检索质量：开发集 vs 保留集（跳过 LLM，直接查询）',
      subtitle,
      categories: metricCategories,
      series: [
        {
          name: `开发集 dev（${bySplit.dev.case_count} 个）`,
          values: metricValues(bySplit.dev),
        },
        {
          name: `保留集 holdout（${bySplit.holdout.case_count} 个）`,
          values: metricValues(bySplit.holdout),
        },
      ],
      yLabel: '比例',
      format: pct,
      caption:
        '语料设计时 dev/holdout 就是配对的（各 12 条），这里的差距反映检索算法本身在未见过的' +
        '笔记和查询上是否稳定，不掺杂 LLM 会不会调用检索这一层。',
    }),
  );

  write(
    'retrieval-by-scenario.svg',
    groupedBarChart({
      title: '检索质量：分场景',
      subtitle,
      categories: metricCategories,
      series: [
        {
          name: `retrieval（${byScenario.retrieval.case_count} 个，单一正确笔记）`,
          values: metricValues(byScenario.retrieval),
        },
        {
          name: `ambiguous（${byScenario.ambiguous.case_count} 个，多个相关笔记）`,
          values: metricValues(byScenario.ambiguous),
        },
      ],
      yLabel: '比例',
      format: pct,
      caption:
        'ambiguous 场景的金标是多条相关笔记（比如 Atlas 和 Phoenix 两个相似项目），' +
        'Recall@K 在这里天然更难打满分，不能直接跟 retrieval 场景比高低。',
    }),
  );

  const agentData = readJson('agent-eval.json');
  if (agentData) {
    const agentMean = (agentData.mean_across_rounds as Json).overall as Json;
    write(
      'retrieval-vs-llm-mediated.svg',
      groupedBarChart({
        title: '检索质量：直接查询 vs 经 LLM 调用',
        subtitle: `同一套混合检索算法（关键词 + bge-m3 + RRF），唯一变量是查询词谁写的`,
        categories: metricCategories,
        series: [
          {
            name: '直接用任务 instruction 查询（本表）',
            values: metricValues(overall),
          },
          {
            name: `经 Agent/LLM 决定是否搜索、怎么搜（${agentData.model}）`,
            values: metricValues(agentMean),
          },
        ],
        yLabel: '比例',
        format: pct,
        caption:
          '两者分母不同（本表只统计有金标的任务，Agent 那组只统计它真正调用了 search_notes 的任务），' +
          '差距提示的是「LLM 会不会用好检索」而不是「检索算法本身弱」。',
      }),
    );
  }
}

/* ------------------------------ Jest 清单 ------------------------------ */

function jestCharts(): void {
  const inventory = path.join(
    PROJECT_ROOT,
    'docs',
    'testing',
    'jest-test-inventory.md',
  );
  if (!fs.existsSync(inventory)) return;
  const lines = fs.readFileSync(inventory, 'utf8').split('\n');
  const start = lines.findIndex((line) => line.startsWith('## 按功能域'));
  if (start === -1) return;
  const rows: { area: string; passed: number; skipped: number }[] = [];
  for (let index = start; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.startsWith('## ') && index > start) break;
    const cells = line.split('|').map((cell) => cell.trim());
    if (cells.length < 7) continue;
    if (!/^\d+$/.test(cells[2])) continue;
    rows.push({
      area: cells[1],
      passed: Number(cells[4]),
      skipped: Number(cells[5]),
    });
  }
  if (rows.length === 0) return;
  write(
    'jest-by-area.svg',
    stackedBarChart({
      title: 'Jest 回归测试：按功能域的用例数',
      subtitle: '由 jest --json 的机器可读报告直接渲染',
      categories: rows.map((row) => row.area),
      series: [
        { name: '通过', values: rows.map((row) => row.passed) },
        {
          name: '跳过（需要 Ollama / Electron 等外部依赖）',
          values: rows.map((row) => row.skipped),
        },
      ],
      annotations: rows.map((row) => `共 ${row.passed + row.skipped}`),
      caption:
        '这些是回归测试，证明的是「改动之后既有功能没被破坏」，不证明模型准确率。',
    }),
  );
}

/* --------------------------- LLM 横向扫描 --------------------------- */

function llmCharts(): void {
  const sweep = readJson('llm-sweep.json');
  const runtime = readJson('llm-runtime.json');
  const source = sweep ?? runtime;
  if (!source) return;

  // 扫描文件和单独的 runtime 文件结构不同，统一成一份数组再画
  const entries: Json[] = sweep
    ? (sweep.models as Json[])
    : (runtime!.models as Json[]).map((item) => ({
        model: item.model,
        parameter_size: item.details?.parameter_size ?? null,
        disk_size_bytes: item.disk_size_bytes ?? null,
        accuracy: null,
        runtime: {
          median_tokens_per_second: item.median_tokens_per_second,
          median_first_token_latency_ms: item.median_first_token_latency_ms,
          gpu_offload_ratio: item.gpu_offload_ratio,
          resident_vram_bytes: item.resident_vram_bytes,
          peak_gpu_memory_mib: item.peak_gpu_memory_mib,
        },
      }));
  const usable = entries.filter((item) => item.runtime);
  if (usable.length === 0) return;

  const names = usable.map((item) =>
    item.parameter_size
      ? `${item.model}（${item.parameter_size}）`
      : String(item.model),
  );
  const gpuLine = String(source.gpu ?? '未检测到 GPU');
  const env = `${gpuLine} · Ollama`;

  write(
    'llm-throughput.svg',
    horizontalBarChart({
      title: '本地 LLM 生成吞吐（tokens/s，越高越快）',
      subtitle: env,
      categories: names,
      series: [
        {
          name: '中位 tokens/s',
          values: usable.map((item) =>
            Number(item.runtime.median_tokens_per_second ?? 0),
          ),
        },
      ],
      format: (value) => `${value.toFixed(1)} tok/s`,
      caption:
        '取三种提示词长度、各 3 次的中位数。数字来自 Ollama 自报的 eval_count / eval_duration，不受采样间隔影响。',
    }),
  );

  write(
    'llm-first-token.svg',
    horizontalBarChart({
      title: '首 token 延迟（模型加载 + 读完提示词，越低越跟手）',
      subtitle: env,
      categories: names,
      series: [
        {
          name: '中位首 token 延迟',
          values: usable.map((item) =>
            Number(item.runtime.median_first_token_latency_ms ?? 0),
          ),
        },
      ],
      format: (value) => `${value.toFixed(0)} ms`,
      caption:
        '这是用户按下按钮到看见第一个字的等待时间，比总吞吐更直接影响体感。',
    }),
  );

  write(
    'llm-gpu-offload.svg',
    groupedBarChart({
      title: 'GPU 卸载比例与显存占用：模型到底跑在哪里',
      subtitle: env,
      categories: names,
      series: [
        {
          name: 'GPU 卸载比例（1 = 整个模型都在显存里）',
          values: usable.map((item) =>
            Number(item.runtime.gpu_offload_ratio ?? 0),
          ),
        },
        {
          name: '占用显存 ÷ 总显存',
          values: usable.map((item) => {
            const peak = Number(item.runtime.peak_gpu_memory_mib ?? 0);
            const total = 6144;
            return peak > 0 ? Math.min(1, peak / total) : 0;
          }),
        },
      ],
      yLabel: '比例',
      format: pct,
      referenceLine: { value: 1, label: '显存上限 / 完全卸载' },
      caption:
        '卸载比例来自 Ollama /api/ps 的 size_vram ÷ size。小于 1 表示显存放不下、部分层回落到 CPU，吞吐会明显下降。',
    }),
  );

  // 假阳性率单独出一张：它会把 F1 的排名整个翻过来。
  // 对待办应用来说，凭空造任务比漏掉更糟 —— 用户的清单会被垃圾污染。
  const withFp = usable.filter(
    (item) =>
      item.accuracy &&
      item.accuracy.zero_task_false_positive_rate !== null &&
      item.accuracy.zero_task_false_positive_rate !== undefined,
  );
  if (withFp.length > 0) {
    write(
      'llm-false-positive.svg',
      groupedBarChart({
        title: '零任务用例假阳性率：模型会不会凭空造出待办',
        subtitle:
          '在「这段话里没有任何待办」的用例上，产生了至少一条待办的比例 · 越低越好',
        categories: withFp.map((item) => String(item.model)),
        series: [
          {
            name: '零任务用例假阳性率',
            values: withFp.map((item) =>
              Number(item.accuracy.zero_task_false_positive_rate),
            ),
          },
          {
            name: '保留集 F1（对照）',
            values: withFp.map((item) => Number(item.accuracy.holdout_f1 ?? 0)),
          },
        ],
        yLabel: '比例',
        format: pct,
        caption:
          '这张图会把 F1 的排名翻过来：F1 高的模型可能同时在大量无任务文本上凭空造词，而 F1 掩盖了这一点。',
      }),
    );
  }

  const withAgent = usable.filter((item) => item.agent);
  if (withAgent.length > 0) {
    const agentTaskCount = withAgent[0].agent.task_count;
    const agentRounds = withAgent[0].agent.rounds_run;
    write(
      'llm-agent-tool-use.svg',
      groupedBarChart({
        title: 'Agent 任务：工具调用意愿与完成率',
        subtitle: `${agentTaskCount ?? 'n/a'} 个任务 × ${agentRounds ?? 'n/a'} 轮 · 平均每个任务的工具调用次数与模型推理轮数`,
        categories: withAgent.map((item) => String(item.model)),
        series: [
          {
            name: '平均工具调用次数',
            values: withAgent.map((item) =>
              Number(item.agent.mean_tool_calls ?? 0),
            ),
          },
          {
            name: '平均模型轮数',
            values: withAgent.map((item) =>
              Number(item.agent.mean_model_turns ?? 0),
            ),
          },
        ],
        yLabel: '次数',
        format: (value) => value.toFixed(2),
        caption:
          '几乎不调用工具的模型（每任务 0.02 次）只能凭上下文作答，Agent 完成率随之最低。这项能力与参数量无关。',
      }),
    );

    write(
      'llm-agent-vs-todo.svg',
      groupedBarChart({
        title: '同一批模型在两类任务上的表现',
        subtitle: '待办提取是单步抽取；Agent 需要多步推理与工具调用',
        categories: withAgent.map((item) => String(item.model)),
        series: [
          {
            name: '待办提取 保留集 F1',
            values: withAgent.map((item) =>
              Number(item.accuracy?.holdout_f1 ?? 0),
            ),
          },
          {
            name: 'Agent 严格完成率',
            values: withAgent.map((item) =>
              Number(item.agent.case_pass_rate ?? 0),
            ),
          },
        ],
        yLabel: '比例',
        format: pct,
        caption:
          '两栏排名不一致：单步抽取好的模型未必会用工具。选型必须按实际任务类型分别验证。',
      }),
    );
  }

  const scored = usable.filter((item) => item.accuracy);
  if (scored.length > 0) {
    write(
      'llm-accuracy-vs-speed.svg',
      scatterChart({
        title: '速度-精度帕累托：多小的模型还够用',
        subtitle: `${env} · 准确率来自同一套 54 条待办提取用例的保留集`,
        series: scored.map((item) => ({
          name: `${item.model}（${item.parameter_size ?? '?'}）`,
          points: [
            {
              x: Number(item.runtime.median_tokens_per_second ?? 0),
              y: Number(item.accuracy.holdout_f1 ?? 0) * 100,
            },
          ],
        })),
        xLabel: '生成吞吐（tokens/s，越右越快）',
        yLabel: '保留集 F1（%，越高越准）',
        formatX: (value) => value.toFixed(0),
        formatY: (value) => `${value.toFixed(0)}%`,
        caption:
          '右上角是理想区。落在其他点左下方的模型没有存在价值；拐点就是「够用的最小模型」。',
      }),
    );

    write(
      'llm-accuracy-by-size.svg',
      groupedBarChart({
        title: '准确率随模型尺寸的变化（同一套保留集）',
        subtitle: `${scored.length} 个模型 · 54 条用例（holdout 32）· 语料与判定未改动`,
        categories: scored.map((item) =>
          String(item.parameter_size ?? item.model),
        ),
        series: [
          {
            name: '保留集 F1',
            values: scored.map((item) => Number(item.accuracy.holdout_f1 ?? 0)),
          },
          {
            name: '保留集用例通过率',
            values: scored.map((item) =>
              Number(item.accuracy.holdout_case_pass_rate ?? 0),
            ),
          },
          {
            name: '日期准确率',
            values: scored.map((item) =>
              Number(item.accuracy.date_accuracy ?? 0),
            ),
          },
        ],
        yLabel: '比例',
        format: pct,
        caption:
          '换模型时提示词完全没动，因此 holdout 依然有效，可以横向比较。',
      }),
    );
  }
}

/* --------------------------- 逐模型提示词调优 --------------------------- */

function tuningCharts(): void {
  const data = readJson('llm-tuning-comparison.json');
  if (!data) return;
  const models = (data.models as Json[]).filter((item) => item.delta);
  if (models.length === 0) return;
  const names = models.map((item) => `${item.model}（${item.chosen_variant}）`);

  write(
    'llm-tuning-effect.svg',
    groupedBarChart({
      title: '逐模型提示词调优的效果（均在冻结的保留集上评估）',
      subtitle:
        '变体只在开发集 22 条上选择，保留集 32 条全程冻结，两条臂用同一套判定',
      categories: names,
      series: [
        {
          name: '调优前 保留集 F1',
          values: models.map((item) => Number(item.before.holdout_f1)),
        },
        {
          name: '调优后 保留集 F1',
          values: models.map((item) => Number(item.after.holdout_f1)),
        },
      ],
      yLabel: '保留集 F1',
      format: pct,
      caption:
        '五个模型里只有一个明确改善。开发集上的提升不保证迁移到保留集 —— 这正是设保留集要看的东西。',
    }),
  );

  write(
    'llm-tuning-false-positive.svg',
    groupedBarChart({
      title: '调优对「凭空造任务」的影响',
      subtitle: '零任务假阳性率：在没有待办的文本上仍产生待办的比例，越低越好',
      categories: names,
      series: [
        {
          name: '调优前',
          values: models.map((item) =>
            Number(item.before.zero_task_false_positive_rate),
          ),
        },
        {
          name: '调优后',
          values: models.map((item) =>
            Number(item.after.zero_task_false_positive_rate),
          ),
        },
      ],
      yLabel: '假阳性率',
      format: pct,
      caption:
        '这是调优收益最大的一项：granite4 从 54.5% 降到 9.1%。但 qwen2.5:1.5b 在全部六个变体下都降不下来，那是能力边界。',
    }),
  );

  write(
    'llm-dev-vs-holdout-gain.svg',
    groupedBarChart({
      title: '开发集涨幅 vs 保留集涨幅：提升迁移过去了吗',
      subtitle: '同一个变体在两个子集上的 F1 变化量（百分点）',
      categories: names,
      series: [
        {
          name: '开发集 F1 变化',
          values: models.map((item) => Number(item.delta.dev_f1)),
        },
        {
          name: '保留集 F1 变化',
          values: models.map((item) => Number(item.delta.holdout_f1)),
        },
      ],
      yLabel: 'F1 变化量',
      format: (value) => `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}`,
      caption:
        '两根柱子方向不一致就是过拟合信号：在那 22 条上学到的规则没有推广到没见过的用例。',
    }),
  );
}

/* --------------------------- 跨机器硬件对比 --------------------------- */

/**
 * 多台机器的横向对比。只画对硬件敏感的量 ——
 * 准确率取决于模型与提示词，跨机器比较没有意义，画进来只会误导。
 */
function crossMachineCharts(): void {
  const root = path.join(RESULTS, 'machines');
  if (!fs.existsSync(root)) return;
  const machines = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const dir = path.join(root, entry.name);
      const profileFile = path.join(dir, 'machine.json');
      if (!fs.existsSync(profileFile)) return null;
      const profile = JSON.parse(fs.readFileSync(profileFile, 'utf8')) as Json;
      const files = fs.readdirSync(dir).filter((n) => n.endsWith('.json'));
      const load = (predicate: (name: string) => boolean): Json[] =>
        files
          .filter(predicate)
          .map(
            (name) =>
              JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')) as Json,
          );
      return {
        id: entry.name,
        profile,
        tts: load(
          (n) =>
            n.startsWith('tts-') &&
            !n.startsWith('tts-memory-') &&
            !n.startsWith('tts-length-') &&
            n !== 'tts-asr.json',
        ).filter((x) => x.overall !== undefined),
        llm: load((n) => n === 'llm-runtime.json')[0] ?? null,
        stt: load((n) => n === 'stt-human-speed.json')[0] ?? null,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => a.id.localeCompare(b.id));
  // 只有一台机器时画出来没有对比意义
  if (machines.length < 2) return;

  const names = machines.map((m) => m.id);
  const ttsModels = [
    ...new Set(machines.flatMap((m) => m.tts.map((x) => String(x.model_id)))),
  ].sort();
  if (ttsModels.length > 0) {
    write(
      'cross-tts-rtf.svg',
      groupedBarChart({
        title: '跨机器 TTS 合成速度（P50 RTF，越低越快）',
        subtitle: `${machines.length} 台机器 · 同一套 36 条语料`,
        categories: names,
        series: ttsModels.map((modelId) => ({
          name: modelId,
          values: machines.map((m) => {
            const hit = m.tts.find((x) => x.model_id === modelId);
            return hit ? Number(hit.overall.p50_rtf) : null;
          }),
        })),
        yLabel: 'P50 RTF',
        referenceLine: { value: 1, label: 'RTF = 1，可用下限' },
        caption:
          '越过红线表示合成慢于播放，该机器上这个模型不可用。差异主要来自 CPU 单核性能。',
      }),
    );

    write(
      'cross-tts-memory.svg',
      groupedBarChart({
        title: '跨机器 TTS 峰值内存',
        subtitle: '峰值取决于模型而非硬件；这张图看的是「哪台机器扛得住」',
        categories: names,
        series: ttsModels.map((modelId) => ({
          name: modelId,
          values: machines.map((m) => {
            const hit = m.tts.find((x) => x.model_id === modelId);
            return hit ? Number(hit.peak_rss_bytes) / 1024 / 1024 / 1024 : null;
          }),
        })),
        yLabel: '峰值 RSS（GiB）',
        format: (value) => `${value.toFixed(1)}G`,
        caption:
          '把这里的数字和各机器的物理内存对照，就能看出哪台机器会被哪个模型顶爆。',
      }),
    );
  }

  const llmModels = [
    ...new Set(
      machines.flatMap((m) =>
        ((m.llm?.models as Json[]) ?? []).map((x) => String(x.model)),
      ),
    ),
  ].sort();
  if (llmModels.length > 0) {
    write(
      'cross-llm-throughput.svg',
      groupedBarChart({
        title: '跨机器 LLM 生成吞吐（tokens/s，越高越快）',
        subtitle: `${machines.length} 台机器 · 同一组探针文本`,
        categories: names,
        series: llmModels.map((model) => ({
          name: model,
          values: machines.map((m) => {
            const hit = ((m.llm?.models as Json[]) ?? []).find(
              (x) => x.model === model,
            );
            return hit ? Number(hit.median_tokens_per_second) : null;
          }),
        })),
        yLabel: 'tokens/s',
        format: (value) => value.toFixed(0),
        showValues: false,
        caption:
          '数字来自 Ollama 自报的 eval_count / eval_duration，不受采样间隔影响。',
      }),
    );

    write(
      'cross-llm-gpu.svg',
      groupedBarChart({
        title: '跨机器 GPU 卸载比例（1 = 整个模型都在显存里）',
        subtitle: '小于 1 表示显存放不下、部分层回落到 CPU',
        categories: names,
        series: llmModels.map((model) => ({
          name: model,
          values: machines.map((m) => {
            const hit = ((m.llm?.models as Json[]) ?? []).find(
              (x) => x.model === model,
            );
            return hit ? Number(hit.gpu_offload_ratio ?? 0) : null;
          }),
        })),
        yLabel: '卸载比例',
        format: pct,
        referenceLine: { value: 1, label: '完全卸载' },
        caption:
          '这是判断「这台机器能带动多大模型」最直接的依据：掉到 100% 以下时，吞吐往往是数倍下降。',
      }),
    );
  }

  const sttModels = [
    ...new Set(
      machines.flatMap((m) => Object.keys((m.stt?.models as Json) ?? {})),
    ),
  ].sort();
  if (sttModels.length > 0) {
    write(
      'cross-stt-rtf.svg',
      groupedBarChart({
        title: '跨机器 STT 转写速度（RTF，越低越快）',
        subtitle: `${machines.length} 台机器 · 同一批真人录音，不含准确率`,
        categories: names,
        series: sttModels.map((model) => ({
          name: model,
          values: machines.map((m) => {
            const hit = ((m.stt?.models as Json) ?? {})[model] as
              | Json
              | undefined;
            return hit?.mean_rtf !== undefined && hit?.mean_rtf !== null
              ? Number(hit.mean_rtf)
              : null;
          }),
        })),
        yLabel: 'RTF',
        referenceLine: { value: 1, label: 'RTF = 1，转写耗时等于音频时长' },
        caption:
          '只测转写耗时，同一批录音在任何机器上转写内容都不会变；准确率结论看 STT 真人评测报告，不在这张图里。',
      }),
    );
  }
}

/* ------------------------------ 合并面板 ------------------------------ */

/**
 * 把已生成的单图按主题拼成几张总览面板。
 *
 * 单图适合放在报告正文里紧跟对应的表格；但报告总览和幻灯片需要
 * 「一页看完一个主题」，二十多张零散的图在那种场合没法用。
 * 两者都保留：明细报告引用单图，总览和幻灯片引用面板。
 */
function panels(): void {
  const read = (name: string): string | null => {
    const full = path.join(CHARTS, name);
    return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : null;
  };
  const compose = (
    output: string,
    title: string,
    subtitle: string,
    caption: string,
    sources: string[],
    columns = 2,
  ): void => {
    const charts = sources
      .map(read)
      .filter((item): item is string => item !== null);
    if (charts.length === 0) return;
    write(
      output,
      gridPanel({ title, subtitle, caption, charts, columns, scale: 0.92 }),
    );
  };

  compose(
    'panel-tts-speed.svg',
    'TTS 合成速度总览',
    '三个模型 · 36 条语料 · 每条 3 次重复 · Windows x64 / i9-12900H / CPU 4 线程',
    'RTF < 1 即快于实时播放。三个模型在所有语言和内容类别上都达标，速度不构成选型区分点。',
    [
      'tts-rtf-by-language.svg',
      'tts-rtf-p95-by-category.svg',
      'tts-rtf-vs-length.svg',
      'tts-synthesis-vs-audio.svg',
    ],
  );

  compose(
    'panel-tts-memory.svg',
    'TTS 内存行为总览',
    '峰值 RSS、随长度的变化、以及连续调用是否累积',
    'MOSS 的峰值随文本长度暴涨到约 10 GiB，但重复调用会走平 —— 是单次请求的瞬时开销，不是泄漏。',
    [
      'tts-peak-memory.svg',
      'tts-memory-vs-length.svg',
      'tts-memory-iterations.svg',
    ],
  );

  compose(
    'panel-tts-quality.svg',
    'TTS 可懂度与三项权衡',
    'Whisper 回转录 CER（低置信度代理，不能替代人工听测）',
    '三项指标的第一名不是同一个模型：MOSS 最快且 CER 最低但最费内存，MeloTTS 最省却在人名与缩写上最差。',
    ['tts-cer-by-language.svg', 'tts-cer-by-category.svg', 'tts-tradeoff.svg'],
  );

  compose(
    'panel-stt.svg',
    '真人 STT 评测总览',
    '56 段真人朗读 · whisper.cpp tiny/base/small/large-v1 四档模型',
    '朗读者是中文母语者，英文存在自然偏差；B 段是复述不算 CER。速度与准确率的权衡点看第 4 张图。',
    [
      'stt-cer-by-segment.svg',
      'stt-cer-by-language.svg',
      'stt-content-recall-by-segment.svg',
      'stt-speed-vs-accuracy.svg',
    ],
  );

  compose(
    'panel-todo.svg',
    '待办提取评测总览',
    'qwen2.5:3b-instruct · 温度 0.1 · 54 条用例（dev 22 / holdout 32）· 3 轮',
    '开发集与保留集之间的差距就是泛化差距；三轮几乎重合，说明该温度下输出接近确定性。',
    [
      'todo-dev-vs-holdout.svg',
      'todo-round-stability.svg',
      'todo-failure-types.svg',
    ],
  );

  const agentData = readJson('agent-eval.json');
  const agentSubtitle = agentData
    ? `${agentData.dataset.note_count} 条固定笔记 · ${agentData.dataset.task_count} 个任务` +
      `（dev ${agentData.mean_across_rounds.dev.case_count} / holdout ${agentData.mean_across_rounds.holdout.case_count}）` +
      `· ${agentData.rounds_run} 轮 · ${(agentData.rounds as Json[]).reduce((sum, round) => sum + (round.cases as Json[]).length, 0)} 条完整轨迹`
    : '80 条固定笔记 · Agent 端到端评测';
  compose(
    'panel-agent.svg',
    'Agent 端到端评测总览',
    agentSubtitle,
    '检索一栏是按需要检索的任务数计算的样本量，只作方向性观察；Judge 未经人类校准，主指标是严格规则判分。',
    [
      'agent-dev-vs-holdout.svg',
      'agent-by-scenario.svg',
      'agent-retrieval.svg',
      'agent-efficiency.svg',
      'agent-latency-by-scenario.svg',
      'agent-round-stability.svg',
    ],
  );

  const retrievalData = readJson('embedding-retrieval.json');
  compose(
    'panel-retrieval.svg',
    '检索质量总览（跳过 LLM，直接查询）',
    retrievalData
      ? `bge-m3 · ${retrievalData.dataset.gold_task_count} 个有金标的任务 · 直接用任务原文查询，不经过 Agent/LLM`
      : '检索质量：跳过 LLM 直接测混合检索算法',
    '测的是检索算法本身（关键词 + 向量 + RRF），不测 LLM 会不会调用检索、会不会拼查询词；后者看 panel-agent 里的检索一栏。',
    [
      'retrieval-dev-vs-holdout.svg',
      'retrieval-by-scenario.svg',
      'retrieval-vs-llm-mediated.svg',
    ],
  );
}

function main(): void {
  ttsCharts();
  memoryCharts();
  asrCharts();
  sttCharts();
  todoCharts();
  agentCharts();
  retrievalCharts();
  jestCharts();
  llmCharts();
  tuningCharts();
  crossMachineCharts();
  // 面板要在单图之后生成：它读的就是刚写出来的那些文件
  panels();
  if (written.length === 0) {
    process.stdout.write('没有可用的结果 JSON，未生成任何图。\n');
    process.exitCode = 1;
    return;
  }
  process.stdout.write(
    `已生成 ${written.length} 张图到 ${CHARTS}\n${written.map((name) => `  ${name}`).join('\n')}\n`,
  );
}

main();

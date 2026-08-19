# SpeakSpace Local TTS 本地模型对比测试

测试日期：2026-08-13

## 结论

三个单一多语言模型均在本机成功完成中文、英文和中英混合文本合成，没有返回空音频、NaN 或无穷值。

- **优先新增 MeloTTS `vits-melo-tts-zh_en`**：模型目录约 182.4 MiB，三类文本的中位 RTF 均约为 0.64～0.67，峰值 RSS 约 663.5 MiB；它可以直接复用项目现有 `sherpa-onnx-node`，是体积、速度和接入成本最均衡的候选。
- **MOSS-TTS-Nano 作为实验性候选保留**：它在本机速度最快，三类文本的中位 RTF 为 0.44～0.59，并支持 20 种语言；代价是峰值 RSS 约 1,248.2 MiB。应用集成版只下载推理必需资产，约 684 MiB，并在返回播放前将超幅波形峰值归一化到 `0.98`。
- **现有 Kokoro 继续作为基线**：中文、英文分别达到实时速度，但中英混合文本的中位 RTF 为 1.311，即生成速度慢于音频播放速度。它仍然具有 53 个音色以及现成应用集成的优势。

本报告的 macOS 数据是实际运行结果。Windows 只完成了运行时兼容性核对，**没有在 Windows 机器上执行本轮基准**，不能标记为 Windows 实测通过。

## 测试范围

本次比较以下三个“单一模型”方案。这里的单一模型指所有目标语言共享同一套 TTS 权重，不是 Piper 那样按语言分别下载权重。

| 模型                            |                                                                          本轮语言范围 |                    本地模型大小 | 后端                      | 本轮音色                     |
| ------------------------------- | ------------------------------------------------------------------------------------: | ------------------------------: | ------------------------- | ---------------------------- |
| Kokoro `kokoro-multi-lang-v1_0` |                                                          项目当前列出的 9 类语言/口音 |                       382.2 MiB | `sherpa-onnx-node 1.13.4` | 中文/混合：ID 45；英文：ID 0 |
| MeloTTS `vits-melo-tts-zh_en`   |                                                                  中文、英文、中英混合 |                       182.4 MiB | `sherpa-onnx-node 1.13.4` | ID 0，单音色                 |
| MOSS-TTS-Nano-100M-ONNX         | [官方列出的 20 种语言](https://github.com/OpenMOSS/MOSS-TTS-Nano#supported-languages) | 727.8 MiB，含共享音频 tokenizer | `onnxruntime 1.28.0`      | `Junhao`                     |

模型大小为解压后、运行所需文件的递归总大小，不是压缩下载包大小。

## 测试环境

| 项目     | 值                                      |
| -------- | --------------------------------------- |
| 机器     | Mac16,10，Apple M4                      |
| CPU      | 10 核                                   |
| 内存     | 16 GiB                                  |
| 系统     | macOS 26.6.1，arm64                     |
| 推理设备 | CPU                                     |
| 推理线程 | 4                                       |
| Node.js  | 22.22.3                                 |
| Python   | 3.11.15，仅用于 MOSS 基准               |
| 重复次数 | 每个模型、每条文本 3 次；表中使用中位数 |

测试期间每个模型在一个独立进程内加载一次，随后依次运行三条文本。`/usr/bin/time -l` 用于记录整个进程的最大常驻内存。

## 测试文本

| ID            | 类型     | 文本                                                                   |
| ------------- | -------- | ---------------------------------------------------------------------- |
| `zh_short`    | 中文     | 人工智能正在改变我们记录、整理和检索知识的方式。                       |
| `en_short`    | 英文     | Local speech synthesis keeps private notes on the user's own computer. |
| `zh_en_mixed` | 中英混合 | SpeakSpace 可以在本地运行 text to speech，并保护用户的 private notes。 |

## 性能结果

RTF 的计算方法为 `合成耗时 ÷ 音频时长`。RTF 小于 1 表示合成速度快于实时播放。

### 汇总

| 模型          | 加载时间 |    峰值 RSS | 三类文本平均中位 RTF | 输出格式                | 结果                               |
| ------------- | -------: | ----------: | -------------------: | ----------------------- | ---------------------------------- |
| Kokoro        |  1.260 s |   779.8 MiB |                0.978 | 24 kHz、单声道、PCM16   | 中文/英文实时；混合文本未达到实时  |
| MeloTTS       |  1.344 s |   663.5 MiB |                0.652 | 44.1 kHz、单声道、PCM16 | 三类文本均达到实时                 |
| MOSS-TTS-Nano |  4.024 s | 1,248.2 MiB |                0.529 | 48 kHz、双声道、PCM16   | 三类文本均达到实时；加载和内存最高 |

### 分文本结果

| 模型          | 测试文本 | 中位合成耗时 | 中位音频时长 |  中位 RTF |
| ------------- | -------- | -----------: | -----------: | --------: |
| Kokoro        | 中文     |      4.559 s |      5.269 s |     0.865 |
| Kokoro        | 英文     |      3.225 s |      4.259 s |     0.757 |
| Kokoro        | 中英混合 |      9.440 s |      7.202 s | **1.311** |
| MeloTTS       | 中文     |      2.681 s |      4.133 s |     0.649 |
| MeloTTS       | 英文     |      2.729 s |      4.098 s |     0.666 |
| MeloTTS       | 中英混合 |      3.688 s |      5.747 s |     0.642 |
| MOSS-TTS-Nano | 中文     |      2.757 s |      4.640 s |     0.594 |
| MOSS-TTS-Nano | 英文     |      2.290 s |      4.160 s |     0.550 |
| MOSS-TTS-Nano | 中英混合 |      2.945 s |      6.640 s |     0.444 |

MOSS 的速度数据使用官方默认的 `fixed` 采样模式、流式解码和固定种子 `1234`。为保持 ONNX 测试环境轻量，本轮关闭了可选的 WeTextProcessing，保留项目自带的基础文本清理。

## 音频有效性与信号检查

九个首轮样本均可由 `ffprobe` 识别，音频时长大于零，且原始浮点样本均没有 NaN 或无穷值。

| 模型          | 中文峰值 / RMS | 英文峰值 / RMS | 混合峰值 / RMS | 削波情况                     |
| ------------- | -------------: | -------------: | -------------: | ---------------------------- |
| Kokoro        | 0.420 / 0.0745 | 0.647 / 0.0686 | 0.418 / 0.0774 | 三条均为 0%                  |
| MeloTTS       | 0.307 / 0.0667 | 0.332 / 0.0682 | 0.350 / 0.0597 | 三条均为 0%                  |
| MOSS-TTS-Nano | 1.120 / 0.1293 | 1.097 / 0.0912 | 1.424 / 0.1140 | 约 0.0036%、0.0045%、0.0245% |

MOSS 的百分比是在写文件前，原始浮点波形中绝对值不小于 `0.999` 的样本比例。上游 WAV 写入函数会先把波形限制到 `[-1, 1]`，因此输出文件有效，但这仍表示混合文本样本存在轻微饱和风险。后续集成时应增加峰值归一化或限幅，并通过听测检查是否产生可闻失真。

## Whisper 回转录可懂度代理

使用项目已安装的 Whisper Tiny 多语言模型对九个首轮样本回转录。统一字符错误率（CER）在 Unicode NFKC、大小写折叠并移除标点/空白后计算。

| 模型          | 中文 CER | 英文 CER | 中英混合 CER | 三条合并 CER |
| ------------- | -------: | -------: | -----------: | -----------: |
| Kokoro        |    18.2% |     0.0% |        48.9% |        21.3% |
| MeloTTS       |     4.5% |    46.6% |        42.6% |        37.8% |
| MOSS-TTS-Nano |    45.5% |     0.0% |        89.4% |        40.9% |

回转录文本如下：

| 模型          | 类型     | Whisper Tiny 回转录                                                    |
| ------------- | -------- | ---------------------------------------------------------------------- |
| Kokoro        | 中文     | 人工是能正在改变我们记录整理和检所支持的方式                           |
| Kokoro        | 英文     | Local speech synthesis keeps private notes on the user's own computer. |
| Kokoro        | 中英混合 | Spyx被人可以在本地運行 當Spyx兵保護用戶的 private nodes                |
| MeloTTS       | 中文     | 人工智能正在改变我们记录整理和剑索知识的方式                           |
| MeloTTS       | 英文     | Because we see this steps prior to no standard user zone computer.     |
| MeloTTS       | 中英混合 | SPEARTASBASC可以在本地形TACS2 speech,以保護員貨的 prior to notes       |
| MOSS-TTS-Nano | 中文     | 政府只能正在改變我們記錄整理和檢所知識的方式                           |
| MOSS-TTS-Nano | 英文     | Local speech synthesis keeps private notes on the user's own computer. |
| MOSS-TTS-Nano | 中英混合 | 這次可以在辦理運行的討論                                               |

这部分只能作为低置信度的自动化代理，不能直接等同于人类主观音质。Whisper Tiny 本身会受音色、口音和中英自动语言检测影响，尤其容易低估混合文本。正式选型前仍需让至少 3 名组员对相同样本进行盲听，并分别评分自然度、发音准确性、中英切换和可接受度。

> Evidence:
>
> - Source: 本地 9 个 WAV、`ggml-tiny.bin`、`results/asr.json`
> - Method: Whisper Tiny 回转录后计算归一化 CER；每个模型使用相同文本
> - Confidence: Low；这是 ASR 代理，不是 MOS 或人工听测

## 项目接入影响

### MeloTTS

MeloTTS 与现有 Kokoro 现在都由 `sherpa-onnx-node` 的 `OfflineTts` 加载。集成为 VITS 填入 `model.onnx`、`lexicon.txt`、`tokens.txt`、词典目录和规则 FST，不需要长驻 Python 服务。

### MOSS-TTS-Nano

MOSS 现已通过 `onnxruntime-node 1.27.0` 在 Electron 主进程内运行，按官方 Apache-2.0 ONNX CPU 路径移植 fixed-sampling 推理，并使用 `@sctg/sentencepiece-js 1.3.3` 加载官方 tokenizer。它仅暴露官方内置音色，不接受参考音频或声音克隆输入。

统一音频合约现在返回 1～2 个独立的 `Float32Array` 声道。[TTSAudioPlayer.ts](../src/renderer/tts/TTSAudioPlayer.ts) 按返回声道数创建 `AudioBuffer`，因此 MOSS 保留 48 kHz 双声道，Kokoro/MeloTTS 保持单声道。

## 集成后端到端验证

以下数据不是上文三次重复性能基准，而是对新应用代码路径的单次功能烟雾测试。文本均为“你好，Welcome to SpeakSpace.”，耗时包含首次引擎加载与一次完整合成。

| 激活模型      | 运行时就绪 | 可选音色 | 首轮端到端耗时 | 输出             |       样本数/声道 | 结果 |
| ------------- | ---------- | -------: | -------------: | ---------------- | ----------------: | ---- |
| Kokoro        | 是         |       53 |        3.868 s | 24 kHz，单声道   |            66,467 | 通过 |
| MeloTTS       | 是         |        1 |        2.840 s | 44.1 kHz，单声道 |           115,286 | 通过 |
| MOSS-TTS-Nano | 是         |       18 |        3.949 s | 48 kHz，双声道   | 157,440 / 157,440 | 通过 |

这一轮使用临时 `userData` 根目录和模型目录链接，依次执行模型发现、显式激活、运行时检查、音色列表和 `TTSService.synthesize`。三次返回均无空声道或非有限数值。切换模型时会释放旧引擎，不同引擎不会常驻叠加。

其他验证结果：

- TTS 定向 ESLint：通过。
- 生产环境 main/renderer Webpack 构建：通过。
- TTS Jest：3 个套件、5 个测试全部通过，覆盖显式激活持久化、激活模型删除保护、音色校验和切换时引擎释放。
- macOS arm64 应用包：成功生成；打包后的 Electron 可加载 `sherpa-onnx-node`、`onnxruntime-node` 和 `@sctg/sentencepiece-js`，两个原生绑定均确认为 arm64 Mach-O。
- `release/app` 生产依赖安全审计：0 个已知漏洞。`onnxruntime-node` 间接依赖的 `adm-zip` 已通过 override 锁定到 `0.6.0`。
- 仓库根依赖审计仍有 6 个既有 high 项（`electron-updater`、`js-yaml`、`react-router` 等路径），它们不是本次 TTS 依赖引入的问题，也未在本次功能范围内修改。

> Evidence:
>
> - Source: `scripts/smoke/tts-model-smoke.ts`、`src/main/tts/__tests__/`、本轮命令输出和 macOS arm64 打包产物
> - Method: 三模型逐个激活，通过应用内部 TypeScript 引擎合成一次混合文本；检查运行时、音色、采样率、声道数、样本长度和非有限值
> - Confidence: macOS arm64 High；Windows x64 和 macOS x64 仍需在目标机器验收

## macOS 与 Windows 状态

| 模型          | macOS 本轮状态                                   | Windows 状态                                                                                                                        |
| ------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Kokoro        | **实测通过**，Apple Silicon                      | 未实测；项目使用的 [`sherpa-onnx-node` 官方支持 Windows x64](https://k2-fsa.github.io/sherpa/onnx/javascript-api/install.html)      |
| MeloTTS       | **实测通过**，Apple Silicon                      | 未实测；复用同一 sherpa Node 运行时，具备 Windows x64 官方包                                                                        |
| MOSS-TTS-Nano | **实测通过**，应用内 `onnxruntime-node` CPU 路径 | 未实测；[ONNX Runtime Node 支持 Windows x64](https://onnxruntime.ai/docs/get-started/with-javascript/node.html)，但仍需目标机器验收 |

当前证据足以证明三个模型可以在这台 macOS 机器离线运行，也能证明底层运行时存在 Windows 支持；它不足以证明最终 Electron 安装包已经在 Windows 可用。Windows 验收应至少覆盖 Windows 11 x64、无 Python 的干净账户、首次模型安装、三条相同文本、音频播放和卸载清理。

## 建议

1. MeloTTS 已作为“推荐”项接入模型管理页，下载后仍需用户显式选择。它的模型目录比 Kokoro 小约 52%，峰值 RSS 低约 116 MiB，并且三类文本都稳定快于实时。
2. MOSS 已以“20 语言 / 实验性”标签接入，不设为默认且不自动下载。双声道和峰值归一化已完成，剩余发布门槛是 Windows x64/macOS x64 目标机器验收和组内盲听。
3. 保留 Kokoro 作为当前稳定基线。它的英文回转录结果最好，但应调查中英混合 RTF 超过 1 的原因，并增加更长文本测试。
4. 第二轮测试增加至少 30 条文本：中英文各 10 条、混合 10 条，并覆盖数字、日期、缩写、人名、专业术语和 500 字长文本。报告 P50/P95 RTF，而不是只看短句中位数。
5. 最终选择前补齐同一套 Windows 实测和人工 MOS；本报告不把运行时兼容性当作 Windows 验收结果。

## 可复现方法与数据位置

基准脚本：

- [`tts-benchmark-sherpa.js`](../scripts/benchmark/tts-benchmark-sherpa.js)
- [`tts-benchmark-moss.py`](../scripts/benchmark/tts-benchmark-moss.py)
- [`tts-benchmark-asr.py`](../scripts/benchmark/tts-benchmark-asr.py)
- [`tts-benchmark-inputs.json`](../scripts/benchmark/tts-benchmark-inputs.json)

集成烟雾脚本与平台验收说明：

- [`scripts/smoke/tts-model-smoke.ts`](../scripts/smoke/tts-model-smoke.ts)
- [`docs/testing/tts-platform-builds.md`](testing/tts-platform-builds.md)
- [`docs/testing/tts-windows-manual.md`](testing/tts-windows-manual.md)

本轮原始 JSON、回转录文本和 WAV 位于：

```text
/Users/yanqing/Library/Caches/SpeakSpace-TTS-Benchmark/results/
```

macOS 复现命令：

```bash
/usr/bin/time -l node scripts/benchmark/tts-benchmark-sherpa.js kokoro
/usr/bin/time -l node scripts/benchmark/tts-benchmark-sherpa.js melo
/usr/bin/time -l "$HOME/Library/Caches/SpeakSpace-TTS-Benchmark/venv/bin/python" \
  scripts/benchmark/tts-benchmark-moss.py
"$HOME/Library/Caches/SpeakSpace-TTS-Benchmark/venv/bin/python" \
  scripts/benchmark/tts-benchmark-asr.py
```

模型/源码指纹：

| 资产                           | SHA-256 / commit                                                   |
| ------------------------------ | ------------------------------------------------------------------ |
| Kokoro `model.onnx`            | `c436dc6a842b62aba06af67e40bafcfb9c60ac3af895358f1974ad9a7f7c026b` |
| MeloTTS `model.onnx`           | `bf30582eb1b012250a35b1a4a80e7dfbcf8485e7bb9de0d95efbbeef0e4ad86d` |
| MOSS TTS global data           | `bce8312c3df6a44545302cae229b61054fe0672e0b252ba59cba47adeed831dc` |
| MOSS audio decoder shared data | `e69d52e0f4e84ca27850557ee54face46632d3a5a16c89bd246c7c408466dcad` |
| MOSS-TTS-Nano source           | commit `cc7bdf19c7639c0870dab22045a33b442760f6be`                  |

## 限制

- 只在一台 Apple M4、16 GiB 内存的 macOS 设备测试。
- 只有三条短文本，每条重复三次，不能代表长文本或 P95 延迟。
- 三个模型的音色不同；本轮比较的是实际默认/推荐音色，而不是严格控制音色的声学实验。
- 没有进行人工 MOS、偏好盲测或真实用户测试。
- Whisper Tiny CER 只用于发现明显漏读/错读风险，不应单独决定模型排名。
- MOSS 本轮关闭了可选 WeTextProcessing，正式集成后的数字和日期读法可能不同。
- Windows 运行时兼容性来自官方运行时资料，本轮没有 Windows 性能或播放数据。

## 原始逐次性能数据

| 模型          | 文本     | 次数 | 合成耗时 | 音频时长 |   RTF |
| ------------- | -------- | ---: | -------: | -------: | ----: |
| Kokoro        | 中文     |    1 |  4.559 s |  5.269 s | 0.865 |
| Kokoro        | 中文     |    2 |  4.474 s |  5.269 s | 0.849 |
| Kokoro        | 中文     |    3 |  5.004 s |  5.269 s | 0.950 |
| Kokoro        | 英文     |    1 |  3.225 s |  4.259 s | 0.757 |
| Kokoro        | 英文     |    2 |  3.317 s |  4.259 s | 0.779 |
| Kokoro        | 英文     |    3 |  3.123 s |  4.259 s | 0.733 |
| Kokoro        | 中英混合 |    1 |  7.607 s |  7.200 s | 1.057 |
| Kokoro        | 中英混合 |    2 | 10.566 s |  7.206 s | 1.466 |
| Kokoro        | 中英混合 |    3 |  9.440 s |  7.202 s | 1.311 |
| MeloTTS       | 中文     |    1 |  2.696 s |  4.133 s | 0.652 |
| MeloTTS       | 中文     |    2 |  2.681 s |  4.133 s | 0.649 |
| MeloTTS       | 中文     |    3 |  2.681 s |  4.133 s | 0.649 |
| MeloTTS       | 英文     |    1 |  2.741 s |  4.098 s | 0.669 |
| MeloTTS       | 英文     |    2 |  2.651 s |  4.098 s | 0.647 |
| MeloTTS       | 英文     |    3 |  2.729 s |  4.098 s | 0.666 |
| MeloTTS       | 中英混合 |    1 |  3.688 s |  5.747 s | 0.642 |
| MeloTTS       | 中英混合 |    2 |  3.664 s |  5.747 s | 0.637 |
| MeloTTS       | 中英混合 |    3 |  3.708 s |  5.747 s | 0.645 |
| MOSS-TTS-Nano | 中文     |    1 |  3.111 s |  4.640 s | 0.670 |
| MOSS-TTS-Nano | 中文     |    2 |  2.757 s |  4.640 s | 0.594 |
| MOSS-TTS-Nano | 中文     |    3 |  2.567 s |  4.640 s | 0.553 |
| MOSS-TTS-Nano | 英文     |    1 |  2.525 s |  4.160 s | 0.607 |
| MOSS-TTS-Nano | 英文     |    2 |  2.290 s |  4.160 s | 0.550 |
| MOSS-TTS-Nano | 英文     |    3 |  2.092 s |  4.160 s | 0.503 |
| MOSS-TTS-Nano | 中英混合 |    1 |  3.543 s |  6.640 s | 0.534 |
| MOSS-TTS-Nano | 中英混合 |    2 |  2.945 s |  6.640 s | 0.444 |
| MOSS-TTS-Nano | 中英混合 |    3 |  2.931 s |  6.640 s | 0.441 |

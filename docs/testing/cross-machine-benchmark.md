# 跨机器硬件基准汇总

生成时间：2026-09-01 · 生成方式：`npm run bench:aggregate`

已收集 **1** 台机器。本表只汇总**对硬件敏感**的指标；准确率取决于模型与提示词、与机器无关，因此不在这里比较。

## 机器清单

| 机器 | 系统 | CPU | 核心 | 内存 | GPU | 类别 |
| --- | --- | --- | --- | --- | --- | --- |
| `3060-laptop` | Windows_NT 10.0.26200 x64 | 12th Gen Intel(R) Core(TM) i9-12900H | 14C/20T | 40752.5 MiB | NVIDIA GeForce RTX 3060 Laptop GPU 6144 MiB | nvidia-gpu |

## LLM 生成吞吐（tokens/s，越高越快）


| 机器 | granite4:micro-h | ministral-3:3b-instruct-2512-q4_K_M | phi4-mini:latest | qwen2.5:1.5b-instruct | qwen2.5:3b-instruct |
| --- | --- | --- | --- | --- | --- |
| `3060-laptop` | 88.7 | 96.1 | 87.4 | 155.5 | 98.6 |

## GPU 卸载比例（1 = 整个模型都在显存里）


| 机器 | granite4:micro-h | ministral-3:3b-instruct-2512-q4_K_M | phi4-mini:latest | qwen2.5:1.5b-instruct | qwen2.5:3b-instruct |
| --- | --- | --- | --- | --- | --- |
| `3060-laptop` | 100% | 100% | 100% | 100% | 100% |

小于 100% 表示显存放不下、部分层回落到 CPU，吞吐会显著下降。**这一列是判断「这台机器能带动多大模型」最直接的依据。**

## 怎么读这份表

- **速度差异**主要来自 CPU 单核性能（TTS、STT 都走 CPU）与 GPU 显存带宽（LLM）。
- **内存/显存**跨机器几乎不变，变的是「这台机器够不够」。把峰值和总量对照着看。
- **GPU 卸载比例掉到 100% 以下**是最重要的信号：说明这台机器带不动这个模型，
  此时吞吐的下降往往是数倍，而不是几个百分点。
- 准确率不在这份表里。它取决于模型与提示词，换机器不会变；
  相关结论见 [待办提取评测](./task-extraction-eval.md) 与 [LLM 横向扫描](./llm-model-sweep.md)。

## 各机器原始结果

- `3060-laptop`：`E:\programs\pycharm_programs\speakspace\docs\testing\results\machines\3060-laptop`

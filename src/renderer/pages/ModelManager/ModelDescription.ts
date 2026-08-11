import { Model } from '../../../main/AI-module/Model';

/** 为目录中的每个模型生成简短用途说明，避免把文案写进下载配置。 */
// eslint-disable-next-line import/prefer-default-export
export function getModelDescription(model: Model, modelType: string): string {
  const identity = `${model.id} ${model.name}`.toLowerCase();

  if (modelType === 'stt') {
    if (identity.includes('tdrz')) {
      return '侧重英文说话人区分，适合多人会议记录。';
    }
    if (identity.includes('tiny')) {
      return '速度最快、资源占用最低，适合快速草稿和配置较低的电脑。';
    }
    if (identity.includes('base')) {
      return '轻量且比 Tiny 更准确，适合日常短录音和课堂速记。';
    }
    if (identity.includes('small')) {
      return '速度与准确率平衡，适合大多数会议、访谈和学习场景。';
    }
    if (identity.includes('medium')) {
      return '更重视复杂语音的准确率，适合长录音和多语言内容。';
    }
    if (identity.includes('large')) {
      return 'Whisper 高精度版本，适合性能较强的电脑和重要转录。';
    }
    return '本地语音识别模型，录音无需离开当前设备。';
  }

  if (identity.includes('qwen')) {
    return '中文和多语言表现均衡，适合总结、问答和内容整理。';
  }
  if (identity.includes('phi')) {
    return '轻量推理模型，英文任务响应快，适合资源有限的设备。';
  }
  if (identity.includes('ministral')) {
    return '紧凑型多语言模型，适合日常助手和结构化内容生成。';
  }
  if (identity.includes('granite')) {
    return '面向企业文本处理的轻量模型，适合英文摘要和分类。';
  }
  return '通过 Ollama 在本机运行的语言模型，适合私密内容处理。';
}

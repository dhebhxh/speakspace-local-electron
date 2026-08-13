import { Model } from '../../../main/AI-module/Model';

/** 目录里的尺寸写法不统一（MiB / GiB / GB / ~631 MiB），统一换算成 MB 便于比较。 */
function parseSizeMb(size: string): number | null {
  const matched = /([\d.]+)\s*(MiB|GiB|MB|GB)/i.exec(size);
  if (!matched) return null;
  const value = Number(matched[1]);
  if (Number.isNaN(value)) return null;
  const unit = matched[2].toLowerCase();
  if (unit === 'gib') return value * 1073.741824;
  if (unit === 'gb') return value * 1000;
  if (unit === 'mib') return value * 1.048576;
  return value;
}

function getCapabilityTag(identity: string, modelType: 'stt' | 'llm'): string {
  if (modelType === 'stt') {
    if (identity.includes('parakeet')) return '标点好';
    if (identity.includes('tdrz')) return '分角色';
    if (identity.includes('tiny')) return '最快';
    if (identity.includes('turbo')) return '快且准';
    if (identity.includes('base')) return '较快';
    if (identity.includes('small')) return '均衡';
    if (identity.includes('medium')) return '较准';
    if (identity.includes('large')) return '最准';
    return '通用';
  }

  if (identity.includes('qwen')) return '中文强';
  if (identity.includes('phi')) return '英文强';
  if (identity.includes('granite')) return '英文强';
  if (identity.includes('ministral')) return '均衡';
  return '通用';
}

/**
 * STT 的速度取舍已经写在能力标签里（最快 / 均衡 / 最准），只在特别小或特别大时补一个尺寸标签；
 * LLM 的能力标签讲的是语言侧重，尺寸才是主要取舍，所以每个都给。
 */
function getSizeTag(
  sizeMb: number | null,
  modelType: 'stt' | 'llm',
): string | null {
  if (sizeMb === null) return null;
  if (modelType === 'llm') {
    if (sizeMb < 1200) return '小巧';
    if (sizeMb < 2400) return '中等';
    return '偏大';
  }
  if (sizeMb < 200) return '极小';
  if (sizeMb >= 2500) return '偏大';
  return null;
}

/**
 * 为下拉里的每个模型生成不超过三个短标签，用来快速判断取舍。
 * 标签一律控制在三个字以内，长说明仍走悬停提示。
 */
// 保留命名导出，与同目录的 ModelDescription 保持一致。
// eslint-disable-next-line import/prefer-default-export
export function getModelTags(model: Model, modelType: 'stt' | 'llm'): string[] {
  const identity = `${model.id} ${model.name}`.toLowerCase();
  const capability = getCapabilityTag(identity, modelType);
  const tags = [capability];

  const sizeTag = getSizeTag(parseSizeMb(model.size), modelType);
  if (sizeTag) tags.push(sizeTag);

  const quantized =
    identity.includes('q5') ||
    identity.includes('int8') ||
    Boolean((model as { quantization?: string | null }).quantization);
  if (quantized) tags.push('省内存');

  // 能力标签已经点明语种时不再重复一个语言标签。
  if (model.language === 'en' && capability !== '英文强') tags.push('英文');
  else if (model.language && model.language !== 'en') tags.push('多语言');

  return tags.slice(0, 3);
}

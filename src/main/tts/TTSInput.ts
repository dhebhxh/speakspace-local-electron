import { getTTSSpeakers } from './TTSVoices';

const MAX_TTS_CHARACTERS = 4_000;

export type NormalizedTTSInput = {
  text: string;
  speakerId: number;
  speed: number;
};

/** Renderer 输入先限长、限音色和限速，再进入原生合成模块。 */
export function normalizeTTSInput(
  rawText: unknown,
  rawOptions: unknown,
): NormalizedTTSInput {
  const text = typeof rawText === 'string' ? rawText.trim() : '';
  if (!text) throw new Error('待播报文字不能为空 / TTS text is required');
  if (text.length > MAX_TTS_CHARACTERS) {
    throw new Error(`待播报文字不能超过 ${MAX_TTS_CHARACTERS} 个字符`);
  }

  const options =
    typeof rawOptions === 'object' && rawOptions !== null ? rawOptions : {};
  const candidateId =
    'speakerId' in options ? Number(options.speakerId) : undefined;
  const defaultSpeaker = getTTSSpeakers().find((speaker) => speaker.isDefault);
  const speakerId = Number.isInteger(candidateId)
    ? (candidateId as number)
    : (defaultSpeaker?.id ?? 0);
  if (!getTTSSpeakers().some((speaker) => speaker.id === speakerId)) {
    throw new Error('无效的 TTS 音色 / Invalid TTS speaker');
  }

  const candidateSpeed = 'speed' in options ? Number(options.speed) : 1;
  const speed = Number.isFinite(candidateSpeed)
    ? Math.min(2, Math.max(0.5, candidateSpeed))
    : 1;
  return { text, speakerId, speed };
}

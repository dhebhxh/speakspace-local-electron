import { TTSSpeaker } from '../../main/tts/TTSRuntimeTypes';

const SPEAKER_KEY = 'speakspace:tts:speaker-id';

/** 音色偏好只保存 speaker id，不保存播报文字或音频。 */
export function getPreferredSpeakerId(speakers: TTSSpeaker[]): number {
  const storedValue = localStorage.getItem(SPEAKER_KEY);
  const storedId = storedValue === null ? Number.NaN : Number(storedValue);
  const selected = speakers.find((speaker) => speaker.id === storedId);
  return selected?.id ?? speakers.find((speaker) => speaker.isDefault)?.id ?? 0;
}

export function setPreferredSpeakerId(speakerId: number): void {
  localStorage.setItem(SPEAKER_KEY, String(speakerId));
}

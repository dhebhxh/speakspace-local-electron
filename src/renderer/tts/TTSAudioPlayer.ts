import { TTSAudioResult } from '../../main/tts/TTSService';

/** 把主进程返回的单声道 PCM 样本交给 Web Audio 播放。 */
export default class TTSAudioPlayer {
  private context: AudioContext | null = null;

  private source: AudioBufferSourceNode | null = null;

  public async play(audio: TTSAudioResult, onEnded: () => void): Promise<void> {
    this.stop();
    const context = new AudioContext();
    const samples = Float32Array.from(audio.samples);
    const buffer = context.createBuffer(1, samples.length, audio.sampleRate);
    buffer.copyToChannel(samples, 0);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.onended = () => {
      this.source = null;
      this.context = null;
      context.close().catch(() => undefined);
      onEnded();
    };
    this.context = context;
    this.source = source;
    await context.resume();
    source.start();
  }

  public stop(): void {
    if (this.source) {
      this.source.onended = null;
      try {
        this.source.stop();
      } catch {
        // 已自然结束的 AudioBufferSourceNode 无需再次停止。
      }
    }
    this.context?.close().catch(() => undefined);
    this.source = null;
    this.context = null;
  }
}

import { useCallback, useEffect, useRef, useState } from 'react';
import type { TTSAudioResult } from '@shared/types/TTSRuntimeTypes';
import TTSAudioPlayer from './TTSAudioPlayer';
import { getPreferredSpeakerId } from './TTSPreferences';

export default function useTTSPlayback() {
  const player = useRef<TTSAudioPlayer | null>(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    player.current = new TTSAudioPlayer();
    return () => player.current?.stop();
  }, []);

  const speak = useCallback(
    async (text: string, speakerId?: string, speed = 1) => {
      try {
        setLoading(true);
        setError('');
        player.current?.stop();
        setPlaying(false);
        const status = await window.electron.tts.getStatus();
        const selectedSpeakerId =
          speakerId ??
          (status.activeModelId
            ? getPreferredSpeakerId(status.activeModelId, status.speakers)
            : undefined);
        const audio = (await window.electron.tts.synthesize(text, {
          speakerId: selectedSpeakerId,
          speed,
        })) as TTSAudioResult;
        setPlaying(true);
        await player.current?.play(audio, () => setPlaying(false));
      } catch (reason) {
        setPlaying(false);
        setError(reason instanceof Error ? reason.message : '语音播放失败');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const stop = useCallback(() => {
    player.current?.stop();
    setPlaying(false);
  }, []);

  return { speak, stop, loading, playing, error };
}

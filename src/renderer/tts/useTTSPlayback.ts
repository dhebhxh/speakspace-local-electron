import { useCallback, useEffect, useRef, useState } from 'react';
import { TTSAudioResult } from '../../main/tts/TTSService';
import TTSAudioPlayer from './TTSAudioPlayer';

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
    async (text: string, speakerId: number, speed = 1) => {
      try {
        setLoading(true);
        setError('');
        player.current?.stop();
        setPlaying(false);
        const audio = (await window.electron.tts.synthesize(text, {
          speakerId,
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

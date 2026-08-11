import { getTTSSpeakers } from '../../main/tts/TTSVoices';
import { getPreferredSpeakerId } from './TTSPreferences';
import toSpeechText from './TTSContent';
import useTTSPlayback from './useTTSPlayback';
import './TTSPlayButton.css';

/** 可复用朗读按钮：使用模型管理页保存的默认音色。 */
export default function TTSPlayButton({ text }: { text: string }) {
  const playback = useTTSPlayback();
  const play = () => {
    const speakers = getTTSSpeakers();
    playback.speak(toSpeechText(text), getPreferredSpeakerId(speakers));
  };

  return (
    <span className="tts-play-control">
      {playback.playing ? (
        <button
          className="tts-play-button"
          onClick={playback.stop}
          type="button"
        >
          停止
        </button>
      ) : (
        <button
          className="tts-play-button"
          disabled={playback.loading || !text.trim()}
          onClick={play}
          type="button"
        >
          {playback.loading ? '生成语音…' : '朗读'}
        </button>
      )}
      {playback.error && <small role="alert">{playback.error}</small>}
    </span>
  );
}

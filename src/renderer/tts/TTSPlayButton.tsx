import toSpeechText from './TTSContent';
import useTTSPlayback from './useTTSPlayback';
import './TTSPlayButton.css';

function SpeakerIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="16"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="16"
    >
      <path d="M11 5 6 9H2v6h4l5 4V5Z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="16"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="16"
    >
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

/** 可复用朗读按钮：使用模型管理页保存的默认音色。 */
export default function TTSPlayButton({ text }: { text: string }) {
  const playback = useTTSPlayback();
  const play = () => {
    playback.speak(toSpeechText(text));
  };

  return (
    <span className="tts-play-control">
      {playback.playing ? (
        <button
          className="tts-play-button"
          onClick={playback.stop}
          type="button"
          aria-label="停止朗读"
          title="停止朗读"
        >
          <StopIcon />
        </button>
      ) : (
        <button
          className="tts-play-button"
          disabled={playback.loading || !text.trim()}
          onClick={play}
          type="button"
          aria-label={playback.loading ? '正在生成语音' : '朗读'}
          title={playback.loading ? '正在生成语音…' : '朗读'}
        >
          {playback.loading ? (
            <span className="tts-play-spinner" aria-hidden="true" />
          ) : (
            <SpeakerIcon />
          )}
        </button>
      )}
      {playback.error && <small role="alert">{playback.error}</small>}
    </span>
  );
}

import { useEffect, useState } from 'react';
import { TTSRuntimeStatus } from '../../../../main/tts/TTSRuntimeTypes';
import {
  getPreferredSpeakerId,
  setPreferredSpeakerId,
} from '../../../tts/TTSPreferences';
import useTTSPlayback from '../../../tts/useTTSPlayback';

export default function TTSVoicePreview({
  runtime,
}: {
  runtime: TTSRuntimeStatus;
}) {
  const [speakerId, setSpeakerId] = useState(runtime.defaultSpeakerId);
  const playback = useTTSPlayback();

  useEffect(() => {
    setSpeakerId(getPreferredSpeakerId(runtime.speakers));
  }, [runtime.speakers]);

  const selectSpeaker = (nextId: number) => {
    setSpeakerId(nextId);
    setPreferredSpeakerId(nextId);
  };
  const preview = () => {
    playback.speak('你好，这是 SpeakSpace 的本地语音。', speakerId);
  };

  return (
    <div className="tts-voice-preview">
      <label htmlFor="tts-speaker">
        <span>默认音色</span>
        <select
          disabled={!runtime.runtimeReady || playback.loading}
          id="tts-speaker"
          onChange={(event) => selectSpeaker(Number(event.target.value))}
          value={speakerId}
        >
          {runtime.speakers.map((speaker) => (
            <option key={speaker.id} value={speaker.id}>
              {speaker.label}
            </option>
          ))}
        </select>
      </label>
      {playback.playing ? (
        <button onClick={playback.stop} type="button">
          停止试听
        </button>
      ) : (
        <button
          disabled={!runtime.runtimeReady || playback.loading}
          onClick={preview}
          type="button"
        >
          {playback.loading ? '正在生成…' : '试听音色'}
        </button>
      )}
      {playback.error && <p role="alert">{playback.error}</p>}
    </div>
  );
}

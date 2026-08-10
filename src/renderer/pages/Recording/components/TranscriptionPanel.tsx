import { RecordingSession } from '../RecordingSession';
import { RecordingState } from '../RecordingTypes';
import useRecordingSession from '../useRecordingSession';

export default function TranscriptionPanel(props: {
  session: RecordingSession;
}) {
  const { session } = props;
  const snapshot = useRecordingSession(session);

  return (
    <section className="recording-panel">
      <div className="recording-panel__header">
        <div>
          <p className="recording-panel__eyebrow">LOCAL AUDIO</p>
          <h1>录音与转写 / Recording</h1>
        </div>
        <span className={`recording-state recording-state--${snapshot.state}`}>
          {snapshot.state}
        </span>
      </div>

      <p className="recording-panel__status">{snapshot.statusMessage}</p>

      {snapshot.errorMessage && (
        <p className="recording-panel__error" role="alert">
          {snapshot.errorMessage}
        </p>
      )}

      <div className="recording-panel__content">
        {snapshot.state === RecordingState.Idle && (
          <p>点击开始后，浏览器会请求麦克风权限。录音只保存在本机。</p>
        )}
        {(snapshot.state === RecordingState.Recording ||
          snapshot.state === RecordingState.Paused ||
          snapshot.state === RecordingState.Completed) && (
          <p>
            已接收 {(snapshot.bufferedBytes / 1024).toFixed(1)} KB
            本地音频数据。
          </p>
        )}
        {snapshot.savedRecording && (
          <div className="recording-panel__saved">
            <strong>本地录音已保存</strong>
            <span>{snapshot.savedRecording.relativePath}</span>
            <span>
              {(snapshot.savedRecording.byteLength / 1024).toFixed(1)} KB ·{' '}
              {snapshot.savedRecording.mimeType}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

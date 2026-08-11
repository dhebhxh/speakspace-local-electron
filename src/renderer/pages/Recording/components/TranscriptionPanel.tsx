import { RecordingSession } from '../RecordingSession';
import { RecordingState } from '../RecordingTypes';
import TranscriptionController from '../TranscriptionController';
import useRecordingSession from '../useRecordingSession';
import useTranscriptionController from '../useTranscriptionController';

export default function TranscriptionPanel(props: {
  session: RecordingSession;
  transcription: TranscriptionController;
}) {
  const { session, transcription } = props;
  const snapshot = useRecordingSession(session);
  const transcriptionSnapshot = useTranscriptionController(transcription);
  const { job } = transcriptionSnapshot;

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

      {transcriptionSnapshot.requestError && (
        <p className="recording-panel__error" role="alert">
          {transcriptionSnapshot.requestError}
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
        {job && (
          <section className="transcription-result">
            <header>
              <strong>{job.statusMessage}</strong>
              <span>{job.status}</span>
            </header>
            {job.errorMessage && (
              <p className="recording-panel__error">{job.errorMessage}</p>
            )}
            {job.result && (
              <>
                <p className="transcription-result__text">{job.result.text}</p>
                {job.result.segments.length > 0 && (
                  <ol className="transcription-segments">
                    {job.result.segments.map((segment) => (
                      <li key={segment.id}>
                        <time>{(segment.startMs / 1000).toFixed(1)}s</time>
                        <span>{segment.text}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </>
            )}
          </section>
        )}
      </div>
    </section>
  );
}

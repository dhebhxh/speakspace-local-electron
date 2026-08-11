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
  const {
    job,
    liveSegments,
    livePendingCount,
    liveError,
    liveSummaries,
    summaryPendingCount,
    summaryError,
    summaryMode,
  } = transcriptionSnapshot;
  const liveText = liveSegments
    .map((segment) => segment.text.trim())
    .filter(Boolean)
    .join(' ');
  const showLive =
    snapshot.state !== RecordingState.Idle &&
    (snapshot.state === RecordingState.Recording ||
      snapshot.state === RecordingState.Paused ||
      liveSegments.length > 0 ||
      livePendingCount > 0 ||
      Boolean(liveError));
  let liveStatus = '已完成';
  if (snapshot.state === RecordingState.Paused) liveStatus = '已暂停';
  if (snapshot.state === RecordingState.Recording) liveStatus = '正在监听';
  if (livePendingCount > 0) liveStatus = `识别中 ${livePendingCount}`;

  let summaryStatus = '等待内容';
  if (liveSummaries.length > 0) summaryStatus = '已更新';
  if (summaryPendingCount > 0) summaryStatus = '分析语义中';
  const summaryModeLabel = summaryMode === 'llm' ? 'AI 总结' : '轻量摘要';

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

        {showLive && (
          <div className="live-workspace" aria-live="polite">
            <section className="live-transcription">
              <header>
                <div>
                  <strong>实时转录 / Live transcription</strong>
                  <span>约每 5 秒更新一次 · 保留原始转录内容</span>
                </div>
                <span className="live-transcription__status">{liveStatus}</span>
              </header>

              {liveError && (
                <p className="recording-panel__error">{liveError}</p>
              )}

              <p className="live-transcription__text">
                {liveText ||
                  (livePendingCount > 0
                    ? '正在识别第一段语音… / Recognising first segment…'
                    : '开始说话后，文字会显示在这里。')}
              </p>
            </section>

            <section className="live-summary">
              <header>
                <div>
                  <strong>实时总结 / Live summary</strong>
                  <span>
                    {summaryMode
                      ? `${summaryModeLabel} · 按语义断点分段`
                      : '识别语义断点后生成'}
                  </span>
                </div>
                <span className="live-summary__status">{summaryStatus}</span>
              </header>

              {summaryError && (
                <p className="live-summary__notice">{summaryError}</p>
              )}

              {liveSummaries.length > 0 ? (
                <ol className="live-summary__segments">
                  {liveSummaries.map((summary) => (
                    <li key={summary.id}>
                      <span>片段 {summary.id + 1}</span>
                      <span>{summary.text}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="live-summary__empty">
                  {summaryPendingCount > 0
                    ? '正在判断是否形成完整语义片段…'
                    : '识别到一个完整观点或话题断点后，这里会生成总结。'}
                </p>
              )}
            </section>
          </div>
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

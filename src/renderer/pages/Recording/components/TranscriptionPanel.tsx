import { RecordingSession } from '../RecordingSession';
import { RecordingState } from '../RecordingTypes';
import TranscriptionController from '../TranscriptionController';
import useRecordingSession from '../useRecordingSession';
import { getLanguageLabel } from '../TranscriptionLanguageOptions';
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
    inputMode,
    uploadedFileName,
    uploadLanguage,
    detectedLanguage,
    languageDetectionPending,
    languageDetectionError,
    languageConfirmationRequired,
    liveSegments,
    livePendingCount,
    liveError,
    liveSummaries,
    summaryPendingCount,
    summaryError,
    summaryMode,
  } = transcriptionSnapshot;
  const fileMode = inputMode === 'file';
  const streamedText = liveSegments
    .map((segment) => segment.text.trim())
    .filter(Boolean)
    .join(' ');
  const liveText =
    fileMode && job?.status === 'completed' && job.result
      ? job.result.text
      : streamedText;
  const showLive = fileMode
    ? Boolean(job) ||
      liveSegments.length > 0 ||
      summaryPendingCount > 0 ||
      Boolean(liveError)
    : snapshot.state !== RecordingState.Idle &&
      (snapshot.state === RecordingState.Recording ||
        snapshot.state === RecordingState.Paused ||
        liveSegments.length > 0 ||
        livePendingCount > 0 ||
        Boolean(liveError));

  let liveStatus = '已完成';
  if (fileMode && job?.status === 'processing') {
    liveStatus = job.phase === 'preparing' ? '准备文件' : '正在转录';
  } else if (fileMode && job?.status === 'failed') {
    liveStatus = '转录失败';
  } else if (fileMode && job?.status === 'cancelled') {
    liveStatus = '已取消';
  } else if (snapshot.state === RecordingState.Paused) {
    liveStatus = '已暂停';
  } else if (snapshot.state === RecordingState.Recording) {
    liveStatus = '正在监听';
  } else if (livePendingCount > 0) {
    liveStatus = `识别中 ${livePendingCount}`;
  }

  let summaryStatus = '等待内容';
  if (liveSummaries.length > 0) summaryStatus = '已更新';
  if (summaryPendingCount > 0) summaryStatus = '分析语义中';
  const summaryModeLabel = summaryMode === 'llm' ? 'AI 总结' : '轻量摘要';
  let displayState: string = snapshot.state;
  let displayStatus = snapshot.statusMessage;
  if (fileMode && job) {
    displayState = job.status;
    displayStatus = job.statusMessage;
  }
  if (fileMode && languageDetectionPending) {
    displayState = 'processing';
    displayStatus = '正在检测音频语言 / Detecting audio language';
  }
  const transcriptTitle = fileMode
    ? '文件转录 / File transcription'
    : '实时转录 / Live transcription';
  const transcriptHint = fileMode
    ? '上传音频在本地处理 · 识别出的片段会持续追加'
    : '约每 5 秒更新一次 · 保留原始转录内容';
  let emptyTranscriptText = '开始说话后，文字会显示在这里。';
  if (fileMode) {
    emptyTranscriptText =
      job?.status === 'processing'
        ? '正在读取并转录上传的音频… / Transcribing uploaded audio…'
        : '转录文字会显示在这里。';
  } else if (livePendingCount > 0) {
    emptyTranscriptText = '正在识别第一段语音… / Recognising first segment…';
  }

  return (
    <section className="recording-panel">
      <div className="recording-panel__header">
        <div>
          <p className="recording-panel__eyebrow">LOCAL AUDIO</p>
          <h1>录音与转写 / Recording</h1>
        </div>
        <span className={`recording-state recording-state--${displayState}`}>
          {displayState}
        </span>
      </div>

      <p className="recording-panel__status">{displayStatus}</p>

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

      {languageDetectionError && (
        <p className="recording-panel__error" role="alert">
          {languageDetectionError}
        </p>
      )}

      {fileMode && job?.errorMessage && (
        <p className="recording-panel__error" role="alert">
          {job.errorMessage}
        </p>
      )}

      <div className="recording-panel__content">
        {snapshot.state === RecordingState.Idle && !fileMode && (
          <div className="recording-input-guide">
            <strong>选择输入方式 / Choose an input</strong>
            <p>
              可以直接使用麦克风实时转录，也可以上传已有音频文件。所有音频和 AI
              处理都保留在本机。
            </p>
            <div className="recording-input-guide__formats">
              上传支持 WAV · MP3 · M4A · FLAC · AAC · OGG · WEBM · MP4
            </div>
          </div>
        )}
        {(snapshot.state === RecordingState.Recording ||
          snapshot.state === RecordingState.Paused ||
          snapshot.state === RecordingState.Completed) && (
          <p>
            已接收 {(snapshot.bufferedBytes / 1024).toFixed(1)} KB
            本地音频数据。
          </p>
        )}

        {fileMode && uploadedFileName && (
          <div className="recording-uploaded-file">
            <div>
              <span>已上传音频 / Uploaded audio</span>
              <strong>{uploadedFileName}</strong>
              <span className="recording-uploaded-file__language">
                {languageDetectionPending &&
                  '正在检测语言… / Detecting language…'}
                {!languageDetectionPending && detectedLanguage && (
                  <>
                    检测到 / Detected:{' '}
                    <strong>
                      {getLanguageLabel(detectedLanguage.language)}
                    </strong>
                    {detectedLanguage.confidence !== null &&
                      detectedLanguage.source === 'whisper' &&
                      ` · ${Math.round(detectedLanguage.confidence * 100)}%`}
                    {detectedLanguage.source === 'model-fixed' &&
                      ' · 当前模型固定语言 / fixed by model'}
                  </>
                )}
                {!languageDetectionPending &&
                  !detectedLanguage &&
                  uploadLanguage !== 'auto' && (
                    <>
                      手动语言 / Manual:{' '}
                      <strong>{getLanguageLabel(uploadLanguage)}</strong>
                    </>
                  )}
              </span>
            </div>
            <span>
              {languageDetectionPending
                ? '语言检测中 / Detecting'
                : (job?.statusMessage ?? '等待转录 / Waiting')}
            </span>
          </div>
        )}

        {fileMode && languageConfirmationRequired && (
          <p className="recording-language-warning" role="status">
            自动检测结果需要确认。请检查下方音频语言；正确时点击“确认语言并转录”，
            如果不正确请选择其他语言。
            <span>
              Auto-detection needs confirmation. Check the language below, then
              confirm or choose another language.
            </span>
          </p>
        )}

        {showLive && (
          <div className="live-workspace" aria-live="polite">
            <section className="live-transcription">
              <header>
                <div>
                  <strong>{transcriptTitle}</strong>
                  <span>{transcriptHint}</span>
                </div>
                <span className="live-transcription__status">{liveStatus}</span>
              </header>

              {liveError && (
                <p className="recording-panel__error">{liveError}</p>
              )}

              <p className="live-transcription__text">
                {liveText || emptyTranscriptText}
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
        {job && !fileMode && (
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

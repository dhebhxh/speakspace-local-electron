import React from 'react';
import { RecordingSession } from '../RecordingSession';
import { RecordingState } from '../RecordingTypes';
import TranscriptionController from '../TranscriptionController';
import useRecordingSession from '../useRecordingSession';
import useTranscriptionController from '../useTranscriptionController';

export default function RecordControlBar(props: {
  session: RecordingSession;
  transcription: TranscriptionController;
}) {
  const { session, transcription } = props;
  const snapshot = useRecordingSession(session);
  const transcriptionSnapshot = useTranscriptionController(transcription);
  const transcriptionRunning =
    transcriptionSnapshot.job?.status === 'processing';
  const run = (operation: () => Promise<void>) => {
    operation().catch(() => undefined);
  };

  return (
    <div className="recording-controls" aria-label="Recording controls">
      {snapshot.state === RecordingState.Idle && (
        <>
          <button
            type="button"
            disabled={snapshot.busy || transcriptionRunning}
            onClick={() => run(() => session.start())}
          >
            开始录音 / Start
          </button>
          <button
            className="recording-button--secondary"
            type="button"
            disabled={
              transcriptionSnapshot.requestPending || transcriptionRunning
            }
            onClick={() => run(() => transcription.pickFileAndStart())}
          >
            选择文件转写 / Transcribe file
          </button>
        </>
      )}

      {snapshot.state === RecordingState.Recording && (
        <>
          <button type="button" onClick={() => session.pause()}>
            暂停 / Pause
          </button>
          <button
            type="button"
            disabled={snapshot.busy}
            onClick={() => run(() => session.stop())}
          >
            停止 / Stop
          </button>
        </>
      )}

      {snapshot.state === RecordingState.Paused && (
        <>
          <button type="button" onClick={() => session.resume()}>
            继续 / Resume
          </button>
          <button
            type="button"
            disabled={snapshot.busy}
            onClick={() => run(() => session.stop())}
          >
            停止 / Stop
          </button>
        </>
      )}

      {snapshot.state === RecordingState.Completed && (
        <>
          <button
            type="button"
            disabled={snapshot.busy}
            onClick={() => run(() => session.save())}
          >
            保存 / Save
          </button>
          <button
            className="recording-button--secondary"
            type="button"
            disabled={snapshot.busy}
            onClick={() => run(() => session.discard())}
          >
            放弃 / Discard
          </button>
        </>
      )}

      {snapshot.state === RecordingState.Saved && (
        <>
          <button
            type="button"
            disabled={
              transcriptionSnapshot.requestPending || transcriptionRunning
            }
            onClick={() =>
              run(() =>
                transcription.startRecording(
                  snapshot.savedRecording?.relativePath as string,
                ),
              )
            }
          >
            开始本地转写 / Transcribe
          </button>
          <button
            className="recording-button--secondary"
            type="button"
            disabled={snapshot.busy || transcriptionRunning}
            onClick={() => run(() => session.discard())}
          >
            删除已保存录音 / Delete saved recording
          </button>
        </>
      )}

      {transcriptionRunning && (
        <button
          className="recording-button--secondary"
          type="button"
          disabled={transcriptionSnapshot.requestPending}
          onClick={() => run(() => transcription.cancel())}
        >
          取消转写 / Cancel transcription
        </button>
      )}

      {transcriptionSnapshot.job &&
        (transcriptionSnapshot.job.status === 'failed' ||
          transcriptionSnapshot.job.status === 'cancelled') && (
          <button
            type="button"
            disabled={transcriptionSnapshot.requestPending}
            onClick={() => run(() => transcription.retry())}
          >
            重试转写 / Retry
          </button>
        )}
    </div>
  );
}

import React from 'react';
import { RecordingSession } from '../RecordingSession';
import { RecordingState } from '../RecordingTypes';
import useRecordingSession from '../useRecordingSession';

export default function RecordControlBar(props: { session: RecordingSession }) {
  const { session } = props;
  const snapshot = useRecordingSession(session);
  const run = (operation: () => Promise<void>) => {
    operation().catch(() => undefined);
  };

  return (
    <div className="recording-controls" aria-label="Recording controls">
      {snapshot.state === RecordingState.Idle && (
        <button
          type="button"
          disabled={snapshot.busy}
          onClick={() => run(() => session.start())}
        >
          开始录音 / Start
        </button>
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
        <button
          className="recording-button--secondary"
          type="button"
          disabled={snapshot.busy}
          onClick={() => run(() => session.discard())}
        >
          删除已保存录音 / Delete saved recording
        </button>
      )}
    </div>
  );
}

import React from 'react';
import { RecordingSession, RecordingState } from '../RecordingSession';

export function RecordControlBar(props: { session: RecordingSession }) {
  const { session } = props;

  const state = session.getState();

  return (
    <div>
      {state === RecordingState.Idle && (
        <button onClick={() => session.start()}>Start</button>
      )}

      {state === RecordingState.Recording && (
        <>
          <button onClick={() => session.pause()}>Pause</button>

          <button onClick={() => session.stop()}>Stop</button>
        </>
      )}

      {state === RecordingState.Paused && (
        <>
          <button onClick={() => session.resume()}>Resume</button>

          <button onClick={() => session.stop()}>Stop</button>
        </>
      )}

      {state === RecordingState.Completed && (
        <>
          <button onClick={() => session.save()}>Save</button>

          <button onClick={() => session.discard()}>Discard</button>
        </>
      )}
    </div>
  );
}

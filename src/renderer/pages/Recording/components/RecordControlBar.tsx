import { useEffect, useState } from 'react';
import { RecordingSession, RecordingState } from '../RecordingSession';

export default function RecordControlBar({
  session,
}: {
  session: RecordingSession;
}) {
  const [state, setState] = useState(session.getState());
  const [error, setError] = useState('');

  useEffect(() => {
    return session.subscribe(() => {
      setState(session.getState());
    });
  }, [session]);

  async function handleStart() {
    setError('');

    try {
      await session.start();
    } catch (startError) {
      setError(
        startError instanceof Error
          ? startError.message
          : 'Microphone permission failed.',
      );
    }
  }

  return (
    <div className="record-control-bar">
      <span className={`record-state record-state-${state}`}>{state}</span>

      {state === RecordingState.Idle && (
        <button type="button" onClick={handleStart}>
          Start
        </button>
      )}

      {state === RecordingState.Recording && (
        <>
          <button type="button" onClick={() => session.pause()}>
            Pause
          </button>

          <button type="button" onClick={() => session.stop()}>
            Stop
          </button>
        </>
      )}

      {state === RecordingState.Paused && (
        <>
          <button type="button" onClick={() => session.resume()}>
            Resume
          </button>

          <button type="button" onClick={() => session.stop()}>
            Stop
          </button>
        </>
      )}

      {state === RecordingState.Completed && (
        <>
          <button type="button" onClick={() => session.save()}>
            Save
          </button>

          <button
            type="button"
            className="secondary-button"
            onClick={() => session.discard()}
          >
            Discard
          </button>
        </>
      )}

      {error && <span className="record-error">{error}</span>}
    </div>
  );
}

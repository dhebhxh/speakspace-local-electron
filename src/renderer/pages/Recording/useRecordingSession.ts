import { useEffect, useState } from 'react';
import { RecordingSession } from './RecordingSession';
import { RecordingSnapshot } from './RecordingTypes';

/** 订阅普通 RecordingSession 类，使 React 在录音状态变化时重新渲染。 */
export default function useRecordingSession(
  session: RecordingSession,
): RecordingSnapshot {
  const [snapshot, setSnapshot] = useState(() => session.getSnapshot());

  useEffect(
    () => session.subscribe(() => setSnapshot(session.getSnapshot())),
    [session],
  );

  return snapshot;
}

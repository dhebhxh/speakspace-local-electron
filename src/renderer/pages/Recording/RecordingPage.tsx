import { useRef } from 'react';
import { RecordingSession } from './RecordingSession';
import { RecordControlBar } from './components/RecordControlBar';
import TranscriptionPanel from './components/TranscriptionPanel';

export default function RecordingPage() {
  const sessionRef = useRef(new RecordingSession());

  const session = sessionRef.current;

  return (
    <>
      <TranscriptionPanel session={session} />

      <RecordControlBar session={session} />
    </>
  );
}

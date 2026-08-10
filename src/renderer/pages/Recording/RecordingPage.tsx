import { useRef } from 'react';
import { RecordingSession } from './RecordingSession';
import RecordControlBar from './components/RecordControlBar';
import TranscriptionPanel from './components/TranscriptionPanel';
import './RecordingPage.css';

export default function RecordingPage() {
  const sessionRef = useRef(new RecordingSession());

  const session = sessionRef.current;

  return (
    <section className="recording-page">
      <TranscriptionPanel session={session} />
      <RecordControlBar session={session} />
    </section>
  );
}

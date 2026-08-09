import { useRef } from 'react';
import { RecordingSession } from './RecordingSession';
import RecordControlBar from './components/RecordControlBar';
import TranscriptionPanel from './components/TranscriptionPanel';

export default function RecordingPage() {
  const sessionRef = useRef(new RecordingSession());

  const session = sessionRef.current;

  return (
    <section className="transcription-page">
      <header className="transcription-header">
        <div>
          <h1>Transcription</h1>
          <p>Record audio and prepare notes for Ask AI.</p>
        </div>
      </header>

      <TranscriptionPanel session={session} />

      <RecordControlBar session={session} />
    </section>
  );
}

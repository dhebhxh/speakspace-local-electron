import { useEffect, useRef } from 'react';
import { RecordingSession } from './RecordingSession';
import TranscriptionController from './TranscriptionController';
import RecordControlBar from './components/RecordControlBar';
import TranscriptionPanel from './components/TranscriptionPanel';
import './RecordingPage.css';

export default function RecordingPage() {
  const sessionRef = useRef(new RecordingSession());
  const transcriptionRef = useRef(new TranscriptionController());

  const session = sessionRef.current;
  const transcription = transcriptionRef.current;

  useEffect(() => () => transcription.dispose(), [transcription]);

  return (
    <section className="recording-page">
      <TranscriptionPanel session={session} transcription={transcription} />
      <RecordControlBar session={session} transcription={transcription} />
    </section>
  );
}

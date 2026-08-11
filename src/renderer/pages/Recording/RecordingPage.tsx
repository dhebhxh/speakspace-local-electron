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

  useEffect(() => {
    const detachLiveTranscription = session.setLiveChunkHandler((chunk) =>
      transcription.enqueueLiveChunk(chunk),
    );

    return () => {
      detachLiveTranscription();
      transcription.dispose();
    };
  }, [session, transcription]);

  return (
    <section className="recording-page">
      <TranscriptionPanel session={session} transcription={transcription} />
      <RecordControlBar session={session} transcription={transcription} />
    </section>
  );
}

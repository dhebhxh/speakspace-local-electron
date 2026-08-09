import { useEffect, useState } from 'react';
import { RecordingSession } from '../RecordingSession';

type Props = {
  session: RecordingSession;
};

export default function TranscriptionPanel({ session }: Props) {
  const [text, setText] = useState(session.transcript);

  useEffect(() => {
    const unsubscribe = session.subscribe(() => {
      setText(session.transcript);
    });

    return unsubscribe;
  }, [session]);

  return <div>{text}</div>;
}

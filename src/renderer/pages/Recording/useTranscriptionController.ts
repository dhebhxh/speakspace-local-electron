import { useEffect, useState } from 'react';
import TranscriptionController, {
  TranscriptionControllerSnapshot,
} from './TranscriptionController';

export default function useTranscriptionController(
  controller: TranscriptionController,
): TranscriptionControllerSnapshot {
  const [snapshot, setSnapshot] = useState(() => controller.getSnapshot());

  useEffect(
    () => controller.subscribe(() => setSnapshot(controller.getSnapshot())),
    [controller],
  );

  return snapshot;
}

import { Dispatch, SetStateAction, useRef, useState } from "react";
import { TranscriptionPanel } from "./components/TranscriptionPanel";
import { RecordControlBar } from "./components/RecordControlBar";


export function RecordingInProgress(
    { 
        setState
    }: {
        setState: Dispatch<SetStateAction<"before" | "inProgress" | "after">>;
    }
) {

    const [recordingState, setRecordingState] =
        useState<"idle" | "recording" | "paused" | "completed">("idle");

    const recorderRef = useRef<MediaRecorder | null>(null);

    async function startRecording() {
        await window.electron.transcription.start();

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        const recorder = new MediaRecorder(stream);
        recorderRef.current = recorder;

        recorder.ondataavailable = (event) => {
            window.electron.transcription.sendChunk(event.data);
        }

        recorder.onstop = () => {
            stream.getTracks().forEach(track => track.stop());
        };
        
        recorder.start(1000);
        setRecordingState("recording");
    }

    function pauseRecording() {
        recorderRef.current?.pause();
        setRecordingState("paused");
    }

    function resumeRecording() {
        recorderRef.current?.resume();
        setRecordingState("recording");
    }

    async function stopRecording() {
        recorderRef.current?.stop();

        await window.electron.transcription.stop();
        setRecordingState("completed");
    }

    async function saveRecording() {
        setRecordingState("idle");
        setState("after");
    }

    async function discardRecording() {
        await window.electron.transcription.discard();
        setRecordingState("idle");
        setState("before");
    }

    return (
        <div>
            <TranscriptionPanel/>

            <RecordControlBar
                recordingState={recordingState}
                startRecording={startRecording}
                pauseRecording={pauseRecording}
                resumeRecording={resumeRecording}
                stopRecording={stopRecording}
                saveRecording={saveRecording}
                discardRecording={discardRecording}
            />
        </div>
    )
}

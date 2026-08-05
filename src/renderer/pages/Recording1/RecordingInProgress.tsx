import { useRef, useState } from "react";
import { TranscriptionPanel } from "./components/TranscriptionPanel";
import { RecordControlBar } from "./components/RecordControlBar";


export function RecordingInProgress() {

    const [recordingState, setRecordingState] =
        useState<"idle" | "recording" | "paused" | "completed">("idle");

    const recorderRef = useRef<MediaRecorder | null>(null);

    async function startRecording() {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        const recorder = new MediaRecorder(stream);
        recorderRef.current = recorder;

        recorder.ondataavailable = async(event) => {
            const buffer = await event.data.arrayBuffer();
            window.electron.transcription.sendChunk(buffer);
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

    function stopRecording() {
        recorderRef.current?.stop();
        setRecordingState("completed");
    }

    function saveRecording() {
        setRecordingState("idle");
    }

    function discardRecording() {
        setRecordingState("idle");
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

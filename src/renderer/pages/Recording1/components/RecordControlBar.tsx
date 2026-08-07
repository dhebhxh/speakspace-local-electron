

export function RecordControlBar(
    {
        recordingState,
        startRecording,
        pauseRecording,
        resumeRecording,
        stopRecording,
        saveRecording,
        discardRecording
    }: {
        recordingState: "idle" | "recording" | "paused" | "completed";
        startRecording: () => void;
        pauseRecording: () => void;
        resumeRecording: () => void;
        stopRecording: () => void;
        saveRecording: () => void;
        discardRecording: () => void;
    }
) {
    return (
        <div>
            {
                recordingState === "idle" &&
                <button onClick={startRecording}>
                    Start
                </button>
            }

            {
                recordingState === "recording" &&
                <>
                    <button onClick={pauseRecording}>
                        Pause
                    </button>

                    <button onClick={stopRecording}>
                        Stop
                    </button>
                </>
            }

            {
                recordingState === "paused" &&
                <>
                    <button onClick={resumeRecording}>
                        Resume
                    </button>

                    <button onClick={stopRecording}>
                        Stop
                    </button>
                </>
            }

            {
                recordingState === "completed" &&
                <>
                    <button onClick={saveRecording}>
                        Save
                    </button>

                    <button onClick={discardRecording}>
                        Discard
                    </button>
                </>
            }
        </div>
    );
}
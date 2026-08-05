import { useEffect, useState } from "react";


export function TranscriptionPanel() {

    const [transcript, setTranscript] = useState("");

    useEffect(() => {
        const removeListener = window.electron.transcription.onText(
            (text: string) => {
                setTranscript(previous => previous + text);
            }
        );

        return () => {
            removeListener();
        }
    }, []);

    return (
        <div>
            <h3>
                Transcription
            </h3>

            <div>
                {transcript}
            </div>
        </div>
    );
}
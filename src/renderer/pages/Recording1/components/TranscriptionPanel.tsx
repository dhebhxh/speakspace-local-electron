import { useEffect, useState } from "react";


export function TranscriptionPanel() {

    const [textChunks, setTextChunks] = useState<string[]>([]);

    useEffect(() => {
        const removeListener = window.electron.transcription.onText(
            (id: number, text: string) => {
                setTextChunks(previous => {
                    const newChunks = previous.slice();
                    newChunks[id] = text;
                    return newChunks;
                });
            }
        );

        return () => {
            removeListener();
        }
    }, []);

    const transcript = textChunks.join();
    
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
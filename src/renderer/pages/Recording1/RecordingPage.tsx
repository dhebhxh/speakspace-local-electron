import { useState } from "react";


export function RecordingPage() {

    const [state, setState] = useState<"before" | "inProgress" | "after">("before");

    return (
        <>
            {
                state === "before" &&
                <BeforeRecording>

                </BeforeRecording>

            }

            {
                state === "inProgress" &&
                <RecordingInProgress>

                </RecordingInProgress>
            }

            {
                state === "after" &&
                <AfterRecording>

                </AfterRecording>
            }
        </>
    )
}
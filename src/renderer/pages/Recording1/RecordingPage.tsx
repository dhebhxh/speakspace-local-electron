import { useState } from "react";
import { BeforeRecording } from "./BeforeRecording";
import { RecordingInProgress } from "./RecordingInProgress";
import { AfterRecording } from "./AfterRecording"; 

export function RecordingPage() {

    const [state, setState] = useState<"before" | "inProgress" | "after">("before");

    return (
        <>
            {
                state === "before" &&
                <BeforeRecording  setState={setState}/>
            }

            {
                state === "inProgress" &&
                <RecordingInProgress setState={setState}/>
            }

            {
                state === "after" &&
                <AfterRecording setState={setState}/>
            }
        </>
    )
}
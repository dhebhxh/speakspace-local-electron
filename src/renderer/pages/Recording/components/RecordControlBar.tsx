import React from "react";
import { RecordingSession, RecordingState } from "../RecordingSession";


export function RecordControlBar(
    props: { session: RecordingSession }
) {
    const session = props.session;

    const state = session.getState();

    return (
        <div>

            {
                state === RecordingState.Idle &&
                <button
                    onClick={() => session.start()}
                >
                    Start
                </button>
            }

            {
                state === RecordingState.Recording &&
                <React.Fragment>
                    <button
                        onClick={() => session.pause()}
                    >
                        Pause
                    </button>

                    <button
                        onClick={() => session.stop()}
                    >
                        Stop
                    </button>
                </React.Fragment>
            }

            {
                state === RecordingState.Paused &&
                <React.Fragment>
                    <button
                        onClick={() => session.resume()}
                    >
                        Resume
                    </button>

                    <button
                        onClick={() => session.stop()}
                    >
                        Stop
                    </button>
                </React.Fragment>
            }

            {
                state === RecordingState.Completed &&
                <React.Fragment>
                    <button
                        onClick={() => session.save()}
                    >
                        Save
                    </button>

                    <button
                        onClick={() => session.discard()}
                    >
                        Discard
                    </button>
                </React.Fragment>
            }
            
        </div>
    );
}
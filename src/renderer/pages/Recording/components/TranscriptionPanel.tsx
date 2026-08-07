import { useEffect, useState } from 'react';
import { RecordingSession } from '../RecordingSession';

interface Props {
    session: RecordingSession;
}

export function TranscriptionPanel(
    { session }: Props
){

    const [text,setText] =
        useState(
            session.transcript
        );


    useEffect(()=>{

        return session.subscribe(() => {

            setText(
                session.transcript
            );

        });

    }, [session]);


    return (
        <div>
            {text}
        </div>
    );
}

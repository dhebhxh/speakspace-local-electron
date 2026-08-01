export function TranscriptionPanel(
    { session }: Props
){

    const [text,setText] =
        useState(
            session.transcript
        );


    useEffect(()=>{

        session.subscribe(()=>{

            setText(
                session.transcript
            );

        });

    },[]);


    return (
        <div>
            {text}
        </div>
    );
}
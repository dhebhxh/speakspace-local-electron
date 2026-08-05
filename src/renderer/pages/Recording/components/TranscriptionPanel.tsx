// 现有问题说明：本文件缺少 useState/useEffect 和 Props 的定义；RecordingSession 也未提供 transcript 与 subscribe，当前组件无法通过类型检查。
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

import { Dispatch, SetStateAction } from "react"


export function BeforeRecording(
    {
        setState
    }: {
        setState: Dispatch<SetStateAction<"before" | "inProgress" | "after">>;
    }
) {

    return (
        <div>
            <button>
                上传音频文件
            </button>

            <button onClick={() => setState("inProgress")}>
                start recording
            </button>
        </div>
    )
}
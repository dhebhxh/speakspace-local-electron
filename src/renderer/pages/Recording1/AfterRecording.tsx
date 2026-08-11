import { Dispatch, SetStateAction, useState } from "react"


export function AfterRecording(
    {
        setState
    }: {
        setState: Dispatch<SetStateAction<"before" | "inProgress" | "after">>;
    }
) {
    const [title, setTitle] = useState("");

    async function handleSave() {
        await window.electron.transcription.save(title);
        setState("before");
    }

    return (
        <div>
            <input
                type="text"
                placeholder="请输入录音名称"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
            />

            <button onClick={handleSave}>
                保存
            </button>
        </div>
    )
}
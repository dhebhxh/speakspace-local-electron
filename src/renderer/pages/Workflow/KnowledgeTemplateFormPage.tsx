import { useEffect, useState } from "react";


export function KnowledgeTemplateFormPage(
    {
        isEditMode,
        knowledgeTemplateId,
        oldName,
        oldPrompt
    }: {
        isEditMode: boolean;
        knowledgeTemplateId: number;
        oldName: string;
        oldPrompt: string;
    }
) {
    const [name, setName] = useState("");
    const [prompt, setPrompt] = useState("");

    useEffect(() => {
        if (isEditMode) {
            setName(oldName);
            setPrompt(oldPrompt);
        } else {
            setName("");
            setPrompt("");
        }
    }, [isEditMode, oldName, oldPrompt]);

    return (
        <form>
            <label>
                name:
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                />
            </label>
            <label>
                prompt:
                <input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                />
            </label>
            <button type="submit">
                submit
            </button>
        </form>
    )
}
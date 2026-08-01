import { useState } from "react";


export function KnowledgeTemplateEmptyForm(
    {
        template
    }: {
        template?: {
            name: string;
            prompt: string;
        }
    }
) {

    const [name, setName] = useState("");
    const [prompt, setPrompt] = useState("");

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
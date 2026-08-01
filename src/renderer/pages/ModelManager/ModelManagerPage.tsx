import { useEffect, useState } from "react";
import { ModelSection } from "./components/ModelSection";
import { STTModel } from "../../../main/AI-module/STTModel";
import { LLMModel } from "../../../main/AI-module/LLMModel";


export function ModelManagerPage() {

    const [sttModels,setSttModels] = useState<STTModel[]>([]);

    const [llmModels,setLlmModels] = useState<LLMModel[]>([]);

    useEffect(()=>{
        async function loadModels() {
            const stt = await window.electron.modelManagement.getModelList("stt");
            const llm = await window.electron.modelManagement.getModelList("llm");

            setSttModels(stt);
            setLlmModels(llm);
        }
        loadModels();
    },[]);

    async function refreshSTTModels(){
        const models = await window.electron.modelManagement.getModelList("stt");
        setSttModels(models);
    }

    async function refreshLLMModels(){
        const models = await window.electron.modelManagement.getModelList("llm");
        setSttModels(models);
    }

    return (
        <div className="model-manager-page">
            <header>
                <h1>
                    AI Models
                </h1>
                <p>
                    Manage local AI models
                </p>
            </header>
            <main>
                <ModelSection
                    title="Speech To Text"
                    models={sttModels}
                    onRefresh={refreshSTTModels}
                    modelType="stt"
                />
                <ModelSection
                    title="Large Language Models"
                    models={llmModels}
                    onRefresh={refreshLLMModels}
                    modelType="llm"
                />
            </main>
        </div>
    );
}
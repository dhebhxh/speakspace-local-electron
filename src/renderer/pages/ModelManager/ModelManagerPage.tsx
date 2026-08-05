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
        // 现有问题说明：这里刷新的是 LLM 列表，却写入了 STT state；执行 LLM 操作后会覆盖语音模型列表，LLM 界面也不会刷新。
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

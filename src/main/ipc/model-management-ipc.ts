import { ipcMain } from "electron";

import { STTModelManager } from "../AI-module/STTModelManager";
import { LLMModelManager } from "../AI-module/LLMModelManager";


const sttModelManager = new STTModelManager();
const llmModelManager = new LLMModelManager();

ipcMain.handle(
    "ModelManagement:getModelList",
    (_event, modelType: string) => {
        switch (modelType) {
            case "stt":
                return sttModelManager.getModelList();
            case "llm":
                return llmModelManager.getModelList();
        }
    }
);

ipcMain.handle(
    "ModelManagement:downloadModel",
    (_event, modelType: string, modelId: string) => {
        switch (modelType) {
            case "stt":
                return sttModelManager.downloadModel(modelId);
            case "llm":
                return llmModelManager.downloadModel(modelId);
        }
    }
);

ipcMain.handle(
    "ModelManagement:deleteModel",
    (_event, modelType: string, modelId: string) => {
        switch (modelType) {
            case "stt":
                return sttModelManager.deleteModel(modelId);
            case "llm":
                return llmModelManager.deleteModel(modelId);
        }
    }
)

ipcMain.handle(
    "ModelManagement:activateModel",
    (_event, modelType: string, modelId: string) => {
        switch (modelType) {
            case "stt":
                return sttModelManager.activateModel(modelId);
            case "llm":
                return llmModelManager.activateModel(modelId);
        }
    }
)
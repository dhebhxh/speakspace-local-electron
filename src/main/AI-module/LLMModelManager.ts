import fs from "fs";
import path from "path";
import { app } from "electron";
import ollama, { Message } from "ollama";

import { ModelManager } from "./ModelManager";
import { LLMModel } from "./LLMModel";


type LLMConfig = {
    "llm": {
        "id": string;
        "name": string;
        "language": string;
        "engine": string;
        "format": string;
        "quantization": string | null;
        "size": string;
        "modelName": string;
        "downloaded": boolean;
        "activated": boolean;
    }[];
};

export class LLMModelManager implements ModelManager {


    private configPath: string;


    constructor() {

        const projectRoot =
            app.getAppPath();


        this.configPath =
            path.join(
                projectRoot,
                "config",
                "llm-catalog.json"
            );

    }



    getModelList(): LLMModel[] {

        const config =
            this.loadConfig();

        const modelList = [];

        for (let i = 0; i < config.llm.length; i++) {
            const model = config.llm[i];

            modelList.push(
                new LLMModel(
                    model.id,
                    model.name,
                    model.language,
                    model.engine,
                    model.format,
                    model.quantization,
                    model.size,
                    model.modelName,
                    model.downloaded,
                    model.activated
                )
            );
        }

        return modelList;
    }




    async downloadModel(id: string): Promise<void> {

        const config = this.loadConfig();

        const model =
            config.llm.find(
                (modelItem: LLMModel) =>
                    modelItem.id === id
            );

        if (!model) {
            throw new Error("Model not found.");
        }

        if (model.downloaded) {
            throw new Error("Model has already been downloaded.");
        }

        await ollama.pull({"model": model.modelName});

        model.downloaded = true;
        this.saveConfig(config);
    }


    async deleteModel(id: string): Promise<void> {

        const config = this.loadConfig();

        const model =
            config.llm.find(
                (modelItem: LLMModel) =>
                    modelItem.id === id
            );

        if (!model) {
            throw new Error("Model not found.");
        }

        if (!model.downloaded) {
            throw new Error("Model has not been downloaded.");
        }

        await ollama.delete({"model": model.modelName});

        model.downloaded = false;
        model.activated =false;

        this.saveConfig(config);
    }


    activateModel(id: string): boolean {

        const config = this.loadConfig();

        const model =
            config.llm.find(
                (modelItem: LLMModel) =>
                    modelItem.id === id
            );

        if (!model) {
            return false;
        }

        if (!model.downloaded) {
            return false;
        }

        const lastActivated = this.getActivatedModel();

        // 现有问题说明：getActivatedModel() 会重新读取配置；lastActivated 属于另一份对象，下面修改它不会影响最终传给 saveConfig 的 config。
        if (lastActivated) {
            lastActivated.activated = false;
        }

        model.activated = true;
        this.saveConfig(config);
        return true;
    }

    getActivatedModel(): LLMModel | null {
        const config = this.loadConfig();
        const model = config.llm.find(
            (modelItem) =>
                modelItem.activated
        );

        if (!model) {
            return null;
        }
        return model;
    }


    private loadConfig(): LLMConfig {
        const json =
            fs.readFileSync(
                this.configPath,
                "utf-8"
            );
        return JSON.parse(json);
    }


    private saveConfig(config: LLMConfig): void {
        fs.writeFileSync(
            this.configPath,
            JSON.stringify(
                config,
                null,
                4
            ),
            "utf-8"
        );
    }
}

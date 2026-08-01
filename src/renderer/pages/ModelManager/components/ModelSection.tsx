import { ModelCard } from "./ModelCard";
import { Model } from "../../../../main/AI-module/Model";


export function ModelSection(
    {
        title,
        models,
        onRefresh,
        modelType
    }: {
        title: string;
        models: Model[];
        onRefresh: () => Promise<void>;
        modelType: string;
    }
) {

    return (
        <section>
            <h2>
                {title}
            </h2>
            {
                models.map(
                    (model) => (
                        <ModelCard
                            key={model.id}
                            model={model}
                            onRefresh={onRefresh}
                            modelType={modelType}
                        />
                    )
                )
            }
        </section>
    );
}
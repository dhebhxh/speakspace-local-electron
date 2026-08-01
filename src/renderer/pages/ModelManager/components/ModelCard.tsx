import { Model } from "../../../../main/AI-module/Model";


export function ModelCard(
    {
        model,
        onRefresh,
        modelType
    }: {
        model: Model;
        onRefresh: () => Promise<void>;
        modelType: string;
    }
) {
    async function handleDownload() {
        await window.electron.modelManagement.downloadModel(modelType, model.id);
        await onRefresh();
    }

    async function handleDelete() {
        await window.electron.modelManagement.deleteModel(modelType, model.id);
        await onRefresh();
    }

    async function handleActivate() {
        await window.electron.modelManagement.activateModel(modelType, model.id);
        await onRefresh();
    }

    return (
        <div className="model-card">
            <span>
                {model.name}
            </span>
            <span>
                Size:{" "}
                {model.size}
            </span>
            <span>
                {
                    model.downloaded

                    ?

                    <button
                        onClick={handleDelete}
                    >
                        Delete
                    </button>

                    :

                    <button
                        onClick={handleDownload}
                    >
                        Download
                    </button>
                }
            </span>
            <span>
                <button
                    disabled={!model.downloaded}
                    onClick={handleActivate}
                >
                    {
                        model.activated
                            ? "Activated"
                            : "Activate"
                    }
                </button>
            </span>
        </div>
    );
}

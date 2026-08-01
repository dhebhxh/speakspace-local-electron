import { KnowledgeTemplate } from "../../../../main/entities/KnowledgeTemplate";

export function KnowledgeTemplateCard(
    {
        knowledgeTemplate,
        onUpdate,
        onDelete
    }: {
        knowledgeTemplate: KnowledgeTemplate
        onUpdate: (knowledgeTemplate: KnowledgeTemplate) => void;
        onDelete: (knowledgeTemplate: KnowledgeTemplate) => void;
    }
) {

    return (
        <div>
            <span>
                {knowledgeTemplate.getName()}
            </span>
            <span>
                {knowledgeTemplate.getPrompt()}
            </span>
            <span>
                {knowledgeTemplate.getCreatedAt().toLocaleString()}
            </span>
            <span>
                {knowledgeTemplate.getUpdatedAt().toLocaleString()}
            </span>
            <button onClick={() => onUpdate(knowledgeTemplate)}>update</button>
            <button onClick={() => onDelete(knowledgeTemplate)}>delete</button>
        </div>
    )
}
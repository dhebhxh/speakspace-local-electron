import { KnowledgeTemplate } from "../../../../main/entities/KnowledgeTemplate";

export function KnowledgeTemplateCard(
    {
        knowledgeTemplate,
        onOpenForm,
        onDelete
    }: {
        knowledgeTemplate: KnowledgeTemplate
        onOpenForm: (knowledgeTemplate: KnowledgeTemplate) => void;
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
            <button onClick={() => onOpenForm(knowledgeTemplate)}>update</button>
            <button onClick={() => onDelete(knowledgeTemplate)}>delete</button>
        </div>
    )
}
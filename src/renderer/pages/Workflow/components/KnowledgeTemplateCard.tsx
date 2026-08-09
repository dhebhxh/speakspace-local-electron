import type { KnowledgeTemplateDTO } from '../WorkflowPage';

export default function KnowledgeTemplateCard({
  knowledgeTemplate,
  onOpenForm,
  onDelete,
}: {
  knowledgeTemplate: KnowledgeTemplateDTO;
  onOpenForm: (knowledgeTemplate: KnowledgeTemplateDTO) => void;
  onDelete: (knowledgeTemplate: KnowledgeTemplateDTO) => void;
}) {
  return (
    <div className="knowledge-template-card">
      <span>{knowledgeTemplate.name}</span>
      <span>{knowledgeTemplate.prompt}</span>
      <span>{new Date(knowledgeTemplate.createdAt).toLocaleString()}</span>
      <span>{new Date(knowledgeTemplate.updatedAt).toLocaleString()}</span>
      <button type="button" onClick={() => onOpenForm(knowledgeTemplate)}>
        update
      </button>
      <button type="button" onClick={() => onDelete(knowledgeTemplate)}>
        delete
      </button>
    </div>
  );
}

import { KnowledgeTemplateDTO } from '../../../../main/workflow/WorkflowTypes';

type KnowledgeTemplateCardProps = {
  knowledgeTemplate: KnowledgeTemplateDTO;
  onOpenForm: (template: KnowledgeTemplateDTO) => void;
  onDelete: (template: KnowledgeTemplateDTO) => void;
};

export default function KnowledgeTemplateCard({
  knowledgeTemplate,
  onOpenForm,
  onDelete,
}: KnowledgeTemplateCardProps) {
  return (
    <article className="knowledge-template-card">
      <div>
        <h2>{knowledgeTemplate.name}</h2>
        <time>
          更新于 {new Date(knowledgeTemplate.updatedAt).toLocaleString()}
        </time>
      </div>
      <p>{knowledgeTemplate.prompt}</p>
      <div className="knowledge-template-actions">
        <button type="button" onClick={() => onOpenForm(knowledgeTemplate)}>
          编辑
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={() => onDelete(knowledgeTemplate)}
        >
          删除
        </button>
      </div>
    </article>
  );
}

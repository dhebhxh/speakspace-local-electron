import { useTranslation } from 'react-i18next';
import type { KnowledgeTemplateDTO } from '@shared/types/WorkflowTypes';

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
  const { t } = useTranslation();
  return (
    <article className="knowledge-template-card">
      <div>
        <h2>{knowledgeTemplate.name}</h2>
        <time>
          {t('workflow.card.updatedPrefix')}
          {new Date(knowledgeTemplate.updatedAt).toLocaleString()}
        </time>
      </div>
      <p>{knowledgeTemplate.prompt}</p>
      <div className="knowledge-template-actions">
        <button type="button" onClick={() => onOpenForm(knowledgeTemplate)}>
          {t('workflow.card.editBtn')}
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={() => onDelete(knowledgeTemplate)}
        >
          {t('workflow.card.deleteBtn')}
        </button>
      </div>
    </article>
  );
}

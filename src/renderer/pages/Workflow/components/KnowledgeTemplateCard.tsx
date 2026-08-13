import { useTranslation } from 'react-i18next';
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
  const { t, i18n } = useTranslation();

  return (
    <article className="knowledge-template-card">
      <div>
        <h2>{knowledgeTemplate.name}</h2>
        <time>
          {t('workflow.card.updated')}{' '}
          {new Date(knowledgeTemplate.updatedAt).toLocaleString(
            i18n.resolvedLanguage,
          )}
        </time>
      </div>
      <p>{knowledgeTemplate.prompt}</p>
      <div className="knowledge-template-actions">
        <button type="button" onClick={() => onOpenForm(knowledgeTemplate)}>
          {t('workflow.card.edit')}
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={() => onDelete(knowledgeTemplate)}
        >
          {t('workflow.card.delete')}
        </button>
      </div>
    </article>
  );
}

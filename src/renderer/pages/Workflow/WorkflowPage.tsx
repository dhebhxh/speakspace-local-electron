import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { KnowledgeTemplateDTO } from '@shared/types/WorkflowTypes';
import KnowledgeTemplateCard from './components/KnowledgeTemplateCard';
import KnowledgeTemplateFormPage from './components/KnowledgeTemplateFormPage';
import './WorkflowPage.css';

export default function WorkflowPage() {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<KnowledgeTemplateDTO[]>([]);
  const [editingTemplate, setEditingTemplate] =
    useState<KnowledgeTemplateDTO | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [status, setStatus] = useState('');

  const loadTemplates = useCallback(async () => {
    const list =
      (await window.electron.workflow.getKnowledgeTemplateList()) as KnowledgeTemplateDTO[];
    setTemplates(list);
  }, []);

  useEffect(() => {
    loadTemplates().catch((error) => {
      setStatus(
        error instanceof Error ? error.message : t('workflow.page.loadError'),
      );
    });
  }, [loadTemplates, t]);

  const openForm = useCallback((template: KnowledgeTemplateDTO | null) => {
    setEditingTemplate(template);
    setFormOpen(true);
    setStatus('');
  }, []);

  const closeForm = useCallback(() => setFormOpen(false), []);
  const openCreateForm = useCallback(() => openForm(null), [openForm]);

  const submitTemplate = useCallback(
    async (name: string, prompt: string) => {
      if (editingTemplate) {
        await window.electron.workflow.updateKnowledgeTemplate(
          editingTemplate.id,
          name,
          prompt,
        );
      } else {
        await window.electron.workflow.createKnowledgeTemplate(name, prompt);
      }
      await loadTemplates();
      setEditingTemplate(null);
      setFormOpen(false);
      setStatus(t('workflow.page.saved'));
    },
    [editingTemplate, loadTemplates, t],
  );

  const deleteTemplate = useCallback(
    async (template: KnowledgeTemplateDTO) => {
      await window.electron.workflow.deleteKnowledgeTemplate(template.id);
      await loadTemplates();
      setStatus(t('workflow.page.deleted'));
    },
    [loadTemplates, t],
  );

  return (
    <section className="workflow-page">
      <header className="workflow-header">
        <div>
          <span>LOCAL WORKFLOW</span>
          <h1>{t('workflow.page.title')}</h1>
          <p>{t('workflow.page.desc')}</p>
        </div>
        {!formOpen && (
          <button type="button" onClick={openCreateForm}>
            {t('workflow.page.createBtn')}
          </button>
        )}
      </header>

      {status && <p className="workflow-status">{status}</p>}
      {formOpen ? (
        <KnowledgeTemplateFormPage
          knowledgeTemplate={editingTemplate}
          onCancel={closeForm}
          onSubmit={submitTemplate}
        />
      ) : (
        <div className="workflow-template-list">
          {templates.length === 0 ? (
            <div className="workflow-empty">{t('workflow.page.empty')}</div>
          ) : (
            templates.map((template) => (
              <KnowledgeTemplateCard
                key={template.id}
                knowledgeTemplate={template}
                onOpenForm={openForm}
                onDelete={deleteTemplate}
              />
            ))
          )}
        </div>
      )}
    </section>
  );
}

import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KnowledgeTemplateDTO } from '../../../../main/workflow/WorkflowTypes';

type KnowledgeTemplateFormProps = {
  knowledgeTemplate: KnowledgeTemplateDTO | null;
  onSubmit: (name: string, prompt: string) => Promise<void>;
  onCancel: () => void;
};

export default function KnowledgeTemplateFormPage({
  knowledgeTemplate,
  onSubmit,
  onCancel,
}: KnowledgeTemplateFormProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(knowledgeTemplate?.name ?? '');
  const [prompt, setPrompt] = useState(knowledgeTemplate?.prompt ?? '');
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setErrorMessage('');
    try {
      await onSubmit(name, prompt);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t('workflow.form.saveError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="knowledge-template-form" onSubmit={handleSubmit}>
      <label htmlFor="knowledge-template-name">
        {t('workflow.form.nameLabel')}
        <input
          id="knowledge-template-name"
          value={name}
          maxLength={80}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label htmlFor="knowledge-template-prompt">
        {t('workflow.form.promptLabel')}
        <textarea
          id="knowledge-template-prompt"
          value={prompt}
          maxLength={4000}
          placeholder={t('workflow.form.promptPlaceholder')}
          onChange={(event) => setPrompt(event.target.value)}
        />
      </label>
      {errorMessage && <p className="workflow-error">{errorMessage}</p>}
      <div className="knowledge-template-form-actions">
        <button type="button" className="secondary-button" onClick={onCancel}>
          {t('workflow.form.cancelBtn')}
        </button>
        <button
          type="submit"
          disabled={saving || !name.trim() || !prompt.trim()}
        >
          {saving ? t('workflow.form.saving') : t('workflow.form.saveBtn')}
        </button>
      </div>
    </form>
  );
}

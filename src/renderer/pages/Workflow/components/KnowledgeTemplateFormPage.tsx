import { FormEvent, useState } from 'react';
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
      setErrorMessage(error instanceof Error ? error.message : '模板保存失败');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="knowledge-template-form" onSubmit={handleSubmit}>
      <label htmlFor="knowledge-template-name">
        模板名称
        <input
          id="knowledge-template-name"
          value={name}
          maxLength={80}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label htmlFor="knowledge-template-prompt">
        整理说明
        <textarea
          id="knowledge-template-prompt"
          value={prompt}
          maxLength={4000}
          placeholder="例如：提取会议摘要、关键决定和负责人明确的行动项。"
          onChange={(event) => setPrompt(event.target.value)}
        />
      </label>
      {errorMessage && <p className="workflow-error">{errorMessage}</p>}
      <div className="knowledge-template-form-actions">
        <button type="button" className="secondary-button" onClick={onCancel}>
          取消
        </button>
        <button
          type="submit"
          disabled={saving || !name.trim() || !prompt.trim()}
        >
          {saving ? '保存中…' : '保存模板'}
        </button>
      </div>
    </form>
  );
}

import { useState } from 'react';
import type { KnowledgeTemplateDTO } from '../WorkflowPage';

export default function KnowledgeTemplateFormPage({
  knowledgeTemplate,
  onSubmit,
}: {
  knowledgeTemplate: KnowledgeTemplateDTO | null;
  onSubmit: (name: string, prompt: string) => void;
}) {
  const [name, setName] = useState(knowledgeTemplate?.name ?? '');
  const [prompt, setPrompt] = useState(knowledgeTemplate?.prompt ?? '');

  return (
    <form
      className="knowledge-template-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(name, prompt);
      }}
    >
      <label htmlFor="knowledge-template-name">
        name:
        <input
          id="knowledge-template-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label htmlFor="knowledge-template-prompt">
        prompt:
        <input
          id="knowledge-template-prompt"
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
      </label>
      <button type="submit">submit</button>
    </form>
  );
}

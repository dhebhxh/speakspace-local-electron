import { useEffect, useState } from 'react';
import { KnowledgeTemplate } from '../../../../main/entities/KnowledgeTemplate';

export function KnowledgeTemplateFormPage({
  knowledgeTemplate,
  onSubmit,
}: {
  knowledgeTemplate: KnowledgeTemplate | null;
  onSubmit: (name: string, prompt: string) => void;
}) {
  const [name, setName] = useState(knowledgeTemplate?.getName() ?? '');
  const [prompt, setPrompt] = useState(knowledgeTemplate?.getPrompt() ?? '');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(name, prompt);
      }}
    >
      <label>
        name:
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label>
        prompt:
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
      </label>
      <button type="submit">submit</button>
    </form>
  );
}

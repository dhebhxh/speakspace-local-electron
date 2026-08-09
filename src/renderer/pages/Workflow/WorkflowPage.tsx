/* eslint react/jsx-no-bind: off */
import { useEffect, useState } from 'react';
import KnowledgeTemplateCard from './components/KnowledgeTemplateCard';
import KnowledgeTemplateFormPage from './components/KnowledgeTemplateFormPage';

export type KnowledgeTemplateDTO = {
  id: number;
  name: string;
  prompt: string;
  createdAt: string;
  updatedAt: string;
};

export default function WorkflowPage() {
  const [knowledgeTemplates, setKnowledgeTemplates] = useState<
    KnowledgeTemplateDTO[]
  >([]);

  const [pageMode, setPageMode] = useState<'list' | 'form'>('list');

  const [editingTemplate, setEditingTemplate] =
    useState<KnowledgeTemplateDTO | null>(null);

  useEffect(() => {
    async function loadKnowledgeTemplates() {
      const knowledgeTemplateList =
        await window.electron.workflow.getKnowledgeTemplateList();
      setKnowledgeTemplates(knowledgeTemplateList);
    }
    loadKnowledgeTemplates();
  }, []);

  function handleFormOpen(knowledgeTemplate: KnowledgeTemplateDTO | null) {
    setEditingTemplate(knowledgeTemplate);
    setPageMode('form');
  }

  function handleCreateClick() {
    handleFormOpen(null);
  }

  async function handleSubmit(name: string, prompt: string) {
    if (editingTemplate == null) {
      // create
      await window.electron.workflow.createKnowledgeTemplate(name, prompt);
    } else {
      // update
      await window.electron.workflow.updateKnowledgeTemplate(
        editingTemplate.id,
        name,
        prompt,
      );
    }

    // 保存成功以后重新加载列表
    const list = await window.electron.workflow.getKnowledgeTemplateList();
    setKnowledgeTemplates(list);

    // 返回列表页
    setPageMode('list');
  }

  async function handleDelete(knowledgeTemplate: KnowledgeTemplateDTO) {
    await window.electron.workflow.deleteKnowledgeTemplate(
      knowledgeTemplate.id,
    );

    // 重新加载列表
    const list = await window.electron.workflow.getKnowledgeTemplateList();
    setKnowledgeTemplates(list);
  }

  return (
    <div>
      {pageMode === 'list' && (
        <section className="workflow-page">
          <header>
            <h1>Workspace</h1>
            <p>Knowledge templates for saved notes.</p>
          </header>
          <button type="button" onClick={handleCreateClick}>
            create new knowledge template
          </button>
          {knowledgeTemplates.map((knowledgeTemplate) => (
            <KnowledgeTemplateCard
              key={knowledgeTemplate.id}
              knowledgeTemplate={knowledgeTemplate}
              onOpenForm={handleFormOpen}
              onDelete={handleDelete}
            />
          ))}
        </section>
      )}

      {pageMode === 'form' && (
        <KnowledgeTemplateFormPage
          knowledgeTemplate={editingTemplate}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}

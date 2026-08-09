import { useEffect, useState } from 'react';
import { KnowledgeTemplateCard } from './components/KnowledgeTemplateCard';
import { KnowledgeTemplate } from '../../../main/entities/KnowledgeTemplate';
import { KnowledgeTemplateFormPage } from './components/KnowledgeTemplateFormPage';

export function WorkflowPage() {
  // 现有问题说明：IPC 传回的类实例会被结构化克隆为普通对象，后续调用 getId/getName 等实体方法会失败，应使用纯数据 DTO。

  const [knowledgeTemplates, setKnowledgeTemplates] = useState<
    KnowledgeTemplate[]
  >([]);

  const [pageMode, setPageMode] = useState<'list' | 'form'>('list');

  const [editingTemplate, setEditingTemplate] =
    useState<KnowledgeTemplate | null>(null);

  useEffect(() => {
    async function loadKnowledgeTemplates() {
      const knowledgeTemplateList =
        await window.electron.workflow.getKnowledgeTemplateList();
      setKnowledgeTemplates(knowledgeTemplateList);
    }
    loadKnowledgeTemplates();
  }, []);

  function handleFormOpen(knowledgeTemplate: KnowledgeTemplate | null) {
    setEditingTemplate(knowledgeTemplate);
    setPageMode('form');
  }

  async function handleSubmit(name: string, prompt: string) {
    if (editingTemplate == null) {
      // create
      await window.electron.workflow.createKnowledgeTemplate(name, prompt);
    } else {
      // update
      await window.electron.workflow.updateKnowledgeTemplate(
        editingTemplate.getId(),
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

  async function handleDelete(knowledgeTemplate: KnowledgeTemplate) {
    await window.electron.workflow.deleteKnowledgeTemplate(
      knowledgeTemplate.getId(),
    );

    // 重新加载列表
    const list = await window.electron.workflow.getKnowledgeTemplateList();
    setKnowledgeTemplates(list);
  }

  return (
    <div>
      {pageMode === 'list' && (
        <>
          <button onClick={() => handleFormOpen(null)}>
            create new knowledge template
          </button>
          {knowledgeTemplates.map((knowledgeTemplate) => (
            <KnowledgeTemplateCard
              key={knowledgeTemplate.getId()}
              knowledgeTemplate={knowledgeTemplate}
              onOpenForm={handleFormOpen}
              onDelete={handleDelete}
            />
          ))}
        </>
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

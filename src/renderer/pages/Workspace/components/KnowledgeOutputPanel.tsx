import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';
import { NoteItem } from '../WorkspaceController';
import { WorkspaceTemplate } from '../WorkspaceWorkflowController';
import TTSPlayButton from '../../../tts/TTSPlayButton';
import MarkdownText from '../../../components/Markdown/MarkdownText';
import CopyButton from '../../../components/CopyButton';

type Props = {
  note: NoteItem;
  templates: WorkspaceTemplate[];
  generating: boolean;
  onGenerate(noteId: number, templateId: number): Promise<void>;
};

/** 操作方法：选择知识模板并点击生成，完成后父页面会刷新当前笔记。 */
export default function KnowledgeOutputPanel({
  note,
  templates,
  generating,
  onGenerate,
}: Props) {
  const { t } = useTranslation();
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? 0);

  useEffect(() => {
    if (!templates.some((template) => template.id === templateId)) {
      setTemplateId(templates[0]?.id ?? 0);
    }
  }, [templateId, templates]);

  const generate = async () => {
    if (templateId > 0) await onGenerate(note.id, templateId);
  };

  return (
    <section className="workspace-knowledge-section">
      <div className="workspace-section-heading">
        <h3>
          <Sparkles size={16} style={{ marginRight: 6 }} />
          {t('workspace.knowledge.title')}
        </h3>
        {templates.length > 0 ? (
          <div className="workspace-generate-controls">
            <select
              aria-label={t('workspace.knowledge.run')}
              disabled={generating}
              onChange={(event) => setTemplateId(Number(event.target.value))}
              value={templateId}
            >
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
            <button
              className="ws-btn ws-btn-primary"
              disabled={generating || !note.transcript.trim()}
              onClick={generate}
              title={t('workspace.knowledge.runTitle')}
              type="button"
            >
              {generating
                ? t('workspace.knowledge.generating')
                : t('workspace.knowledge.generate')}
            </button>
          </div>
        ) : (
          <Link className="ws-link" to="/Workflow">
            {t('workspace.knowledge.newTemplate')}
          </Link>
        )}
      </div>

      {note.knowledge_outputs.length === 0 ? (
        <span className="workspace-content-empty">
          {t('workspace.knowledge.empty', '暂无')}
        </span>
      ) : (
        <div className="workspace-content-stack">
          {note.knowledge_outputs.map((output) => (
            <div className="workspace-content-item" key={output.id}>
              <small>
                {output.template_name} · {output.content_type}
              </small>
              {/* 模板产出本身就是按 Markdown 提示生成的
                  （见 main/workflow/StructuredNoteSupport.ts）。 */}
              <MarkdownText content={output.content} />
              <div className="message-actions">
                <TTSPlayButton text={output.content} />
                <CopyButton text={output.content} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

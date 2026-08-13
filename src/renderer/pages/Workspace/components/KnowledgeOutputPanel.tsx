import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { NoteItem } from '../WorkspaceController';
import { WorkspaceTemplate } from '../WorkspaceWorkflowController';
import TTSPlayButton from '../../../tts/TTSPlayButton';
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
        <h3>AI 知识输出</h3>
        {templates.length > 0 ? (
          <div className="workspace-generate-controls">
            <select
              aria-label="知识模板"
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
              disabled={generating || !note.transcript.trim()}
              onClick={generate}
              type="button"
            >
              {generating ? '生成中…' : '生成内容'}
            </button>
          </div>
        ) : (
          <Link to="/Workflow">先创建模板</Link>
        )}
      </div>

      {note.knowledge_outputs.length === 0 ? (
        <span className="workspace-content-empty">暂无 AI 输出</span>
      ) : (
        <div className="workspace-content-stack">
          {note.knowledge_outputs.map((output) => (
            <div className="workspace-content-item" key={output.id}>
              <small>
                {output.template_name} · {output.content_type}
              </small>
              <p>{output.content}</p>
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

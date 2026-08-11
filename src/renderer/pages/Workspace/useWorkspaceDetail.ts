import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  NoteItem,
  WorkspaceController,
  WorkspaceItem,
} from './WorkspaceController';
import {
  WorkspaceTemplate,
  WorkspaceWorkflowController,
} from './WorkspaceWorkflowController';

const workspaceController = new WorkspaceController();
const workflowController = new WorkspaceWorkflowController();

/** 工作空间详情的数据读取与修改集中在 Hook，页面组件只负责排版。 */
export default function useWorkspaceDetail() {
  const navigate = useNavigate();
  const { workspaceId: rawWorkspaceId } = useParams();
  const workspaceId = Number(rawWorkspaceId);
  const [workspace, setWorkspace] = useState<WorkspaceItem | null>(null);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [templates, setTemplates] = useState<WorkspaceTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [generatingNoteId, setGeneratingNoteId] = useState<number | null>(null);

  const loadWorkspace = useCallback(async () => {
    if (!Number.isInteger(workspaceId) || workspaceId <= 0) {
      setWorkspace(null);
      setError('无效的工作空间 ID');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError('');
      // 进入详情时先记录访问时间，再并行加载笔记与知识模板。
      const openedWorkspace =
        await workspaceController.openWorkspace(workspaceId);
      const [workspaceNotes, knowledgeTemplates] = await Promise.all([
        workspaceController.getWorkspaceNotes(workspaceId),
        workflowController.listTemplates(),
      ]);
      setWorkspace(openedWorkspace);
      setNotes(workspaceNotes);
      setTemplates(knowledgeTemplates);
    } catch (reason) {
      setWorkspace(null);
      setError(WorkspaceController.getErrorMessage(reason, '读取工作空间失败'));
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  const generateOutput = useCallback(
    async (noteId: number, templateId: number) => {
      try {
        setGeneratingNoteId(noteId);
        setError('');
        setStatus('');
        await workflowController.generate(noteId, templateId);
        setNotes(await workspaceController.getWorkspaceNotes(workspaceId));
        setStatus('AI 知识输出已生成并保存在当前笔记中。');
      } catch (reason) {
        setError(WorkspaceController.getErrorMessage(reason, '生成失败'));
      } finally {
        setGeneratingNoteId(null);
      }
    },
    [workspaceId],
  );

  const renameWorkspace = useCallback(async () => {
    if (!workspace) return;
    // eslint-disable-next-line no-alert
    const nextName = window.prompt('输入新的工作空间名称', workspace.name);
    if (!nextName?.trim() || nextName.trim() === workspace.name) return;
    try {
      setError('');
      await workspaceController.renameWorkspace(workspace.id, nextName);
      setWorkspace(await workspaceController.openWorkspace(workspace.id));
    } catch (reason) {
      setError(WorkspaceController.getErrorMessage(reason, '重命名失败'));
    }
  }, [workspace]);

  const deleteWorkspace = useCallback(async () => {
    if (!workspace) return;
    // eslint-disable-next-line no-alert
    if (!window.confirm(`确定删除“${workspace.name}”及其中的全部笔记吗？`)) {
      return;
    }
    try {
      await workspaceController.deleteWorkspace(workspace.id);
      navigate('/');
    } catch (reason) {
      setError(WorkspaceController.getErrorMessage(reason, '删除失败'));
    }
  }, [navigate, workspace]);

  const revealNote = useCallback((noteId: number) => {
    setQuery('');
    requestAnimationFrame(() => {
      document.getElementById(`workspace-note-${noteId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    });
  }, []);

  return {
    workspaceId,
    workspace,
    templates,
    loading,
    error,
    status,
    query,
    setQuery,
    generatingNoteId,
    generateOutput,
    renameWorkspace,
    deleteWorkspace,
    revealNote,
    visibleNotes: WorkspaceController.filterNotes(notes, query),
  };
}

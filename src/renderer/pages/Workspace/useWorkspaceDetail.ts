import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
  const [selectedNoteIds, setSelectedNoteIds] = useState<number[]>([]);

  const toggleNoteSelection = useCallback((noteId: number) => {
    setSelectedNoteIds((prev) =>
      prev.includes(noteId)
        ? prev.filter((id) => id !== noteId)
        : [...prev, noteId],
    );
  }, []);

  const loadWorkspace = useCallback(async () => {
    if (!Number.isInteger(workspaceId) || workspaceId <= 0) {
      setWorkspace(null);
      setError(t('workspace.detail.error.invalidId'));
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
      setError(
        WorkspaceController.getErrorMessage(reason, t('workspace.error.load')),
      );
    } finally {
      setLoading(false);
    }
  }, [t, workspaceId]);

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
        setStatus(t('workspace.detail.status.generated'));
      } catch (reason) {
        setError(
          WorkspaceController.getErrorMessage(
            reason,
            t('workspace.detail.error.generate'),
          ),
        );
      } finally {
        setGeneratingNoteId(null);
      }
    },
    [t, workspaceId],
  );

  const renameWorkspace = useCallback(async () => {
    if (!workspace) return;
    // eslint-disable-next-line no-alert
    const nextName = window.prompt(
      t('workspace.detail.renamePrompt'),
      workspace.name,
    );
    if (!nextName?.trim() || nextName.trim() === workspace.name) return;
    try {
      setError('');
      await workspaceController.renameWorkspace(workspace.id, nextName);
      setWorkspace(await workspaceController.openWorkspace(workspace.id));
    } catch (reason) {
      setError(
        WorkspaceController.getErrorMessage(
          reason,
          t('workspace.detail.error.rename'),
        ),
      );
    }
  }, [t, workspace]);

  const deleteWorkspace = useCallback(async () => {
    if (!workspace) return;
    // eslint-disable-next-line no-alert
    if (
      !window.confirm(
        t('workspace.detail.deleteConfirm', { name: workspace.name }),
      )
    ) {
      return;
    }
    try {
      await workspaceController.deleteWorkspace(workspace.id);
      navigate('/');
    } catch (reason) {
      setError(
        WorkspaceController.getErrorMessage(
          reason,
          t('workspace.detail.error.delete'),
        ),
      );
    }
  }, [navigate, t, workspace]);

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
    selectedNoteIds,
    toggleNoteSelection,
    setSelectedNoteIds,
    generateOutput,
    renameWorkspace,
    deleteWorkspace,
    revealNote,
    visibleNotes: WorkspaceController.filterNotes(notes, query),
  };
}

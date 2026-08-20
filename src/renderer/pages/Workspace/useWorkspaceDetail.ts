import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import type { TrashActionResult } from '@shared/types/TrashTypes';
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

  const reloadNotes = useCallback(async () => {
    const workspaceNotes =
      await workspaceController.getWorkspaceNotes(workspaceId);
    setNotes(workspaceNotes);
    setSelectedNoteIds((current) =>
      current.filter((id) => workspaceNotes.some((note) => note.id === id)),
    );
    return workspaceNotes;
  }, [workspaceId]);

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

  const renameWorkspace = useCallback(
    async (nextName: string) => {
      if (!workspace) return;
      if (!nextName?.trim() || nextName.trim() === workspace.name) return;
      try {
        setError('');
        await workspaceController.renameWorkspace(workspace.id, nextName);
        setWorkspace(await workspaceController.openWorkspace(workspace.id));
      } catch (reason) {
        setError(WorkspaceController.getErrorMessage(reason, '重命名失败'));
      }
    },
    [workspace],
  );

  const moveWorkspaceToTrash = useCallback(async (): Promise<
    TrashActionResult | undefined
  > => {
    if (!workspace) return undefined;
    try {
      setError('');
      return (await window.electron.trash.moveWorkspace(
        workspace.id,
      )) as TrashActionResult;
    } catch (reason) {
      setError(
        WorkspaceController.getErrorMessage(reason, t('trash.error.move')),
      );
      return undefined;
    }
  }, [t, workspace]);

  const moveNoteToTrash = useCallback(
    async (noteId: number) => {
      try {
        setError('');
        const result = (await window.electron.trash.moveNote(
          noteId,
        )) as TrashActionResult;
        setNotes((prev) => prev.filter((n) => n.id !== noteId));
        setSelectedNoteIds((current) => current.filter((id) => id !== noteId));
        return result;
      } catch (reason) {
        setError(
          WorkspaceController.getErrorMessage(reason, t('trash.error.move')),
        );
        return undefined;
      }
    },
    [t],
  );

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
    moveWorkspaceToTrash,
    moveNoteToTrash,
    reloadNotes,
    revealNote,
    visibleNotes: WorkspaceController.filterNotes(notes, query),
  };
}

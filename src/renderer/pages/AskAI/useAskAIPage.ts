import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AskAIConversation,
  AskAIConversationDetail,
  AskAIMessage,
  AskAINote,
  AskAIResult,
  AskAIScope,
} from './AskAITypes';

export default function useAskAIPage() {
  const [notes, setNotes] = useState<AskAINote[]>([]);
  const [conversations, setConversations] = useState<AskAIConversation[]>([]);
  const [activeConversation, setActiveConversation] =
    useState<AskAIConversation | null>(null);
  const [messages, setMessages] = useState<AskAIMessage[]>([]);
  const [sources, setSources] = useState<AskAINote[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);
  const [scope, setScope] = useState<AskAIScope>('note');
  const [status, setStatus] = useState('');
  const [isSending, setIsSending] = useState(false);

  const selectedNote = useMemo(
    () => notes.find((note) => note.id === selectedNoteId) ?? null,
    [notes, selectedNoteId],
  );

  const loadNotes = useCallback(async (preferredId?: number) => {
    const list = (await window.electron.askAI.listNotes()) as AskAINote[];
    setNotes(list);
    setSelectedNoteId(
      (currentId) => preferredId ?? currentId ?? list[0]?.id ?? null,
    );
  }, []);

  const loadConversations = useCallback(async () => {
    const list =
      (await window.electron.askAI.listConversations()) as AskAIConversation[];
    setConversations(list);
  }, []);

  useEffect(() => {
    Promise.all([loadNotes(), loadConversations()]).catch((error: unknown) => {
      setStatus(error instanceof Error ? error.message : '页面加载失败');
    });
  }, [loadConversations, loadNotes]);

  const resetChat = useCallback(() => {
    setActiveConversation(null);
    setMessages([]);
    setSources([]);
    setStatus('');
  }, []);

  const selectNote = useCallback(
    (noteId: number) => {
      setSelectedNoteId(noteId);
      setScope('note');
      resetChat();
    },
    [resetChat],
  );

  const openConversation = useCallback(async (conversationId: number) => {
    setStatus('正在加载会话…');
    try {
      const detail = (await window.electron.askAI.getConversation(
        conversationId,
      )) as AskAIConversationDetail;
      setActiveConversation(detail.conversation);
      setMessages(detail.messages);
      setSources(detail.sources ?? []);
      if (detail.sources[0]) setSelectedNoteId(detail.sources[0].id);
      setScope(detail.sources.length > 1 ? 'workspace' : 'note');
      setStatus('');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '会话加载失败');
    }
  }, []);

  const createNote = useCallback(
    async (name: string, transcript: string): Promise<boolean> => {
      setStatus('正在保存笔记…');
      try {
        const created = (await window.electron.askAI.createNote({
          workspaceId: selectedNote?.workspaceId ?? null,
          name,
          transcript,
        })) as AskAINote;
        await loadNotes(created.id);
        setScope('note');
        resetChat();
        setStatus('笔记已保存');
        return true;
      } catch (error) {
        setStatus(error instanceof Error ? error.message : '笔记保存失败');
        return false;
      }
    },
    [loadNotes, resetChat, selectedNote?.workspaceId],
  );

  const ask = useCallback(
    async (question: string): Promise<boolean> => {
      if (!selectedNote || isSending) return false;
      setIsSending(true);
      setStatus('本地模型正在思考…');
      try {
        const result = (await window.electron.askAI.ask({
          conversationId: activeConversation?.id ?? null,
          workspaceId: selectedNote.workspaceId,
          noteId: selectedNote.id,
          question,
          scope,
        })) as AskAIResult;
        setActiveConversation(result.conversation);
        setMessages(result.messages);
        setSources(result.sources ?? []);
        setStatus(result.modelName ? `本地模型：${result.modelName}` : '');
        await loadConversations();
        return true;
      } catch (error) {
        setStatus(error instanceof Error ? error.message : '提问失败');
        return false;
      } finally {
        setIsSending(false);
      }
    },
    [activeConversation?.id, isSending, loadConversations, scope, selectedNote],
  );

  return {
    notes,
    conversations,
    activeConversation,
    messages,
    sources,
    selectedNote,
    scope,
    status,
    isSending,
    setScope,
    selectNote,
    openConversation,
    createNote,
    ask,
    resetChat,
    // 录音保存新笔记后，用它刷新列表并选中该笔记，让对话立即挂到新内容上。
    reloadNotes: loadNotes,
  };
}

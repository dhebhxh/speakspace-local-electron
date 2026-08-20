import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import useAskAIPage from '../AskAI/useAskAIPage';
import { AskAINote } from '../AskAI/AskAITypes';
import AskAINotesPanel from '../AskAI/components/AskAINotesPanel';
import AskAINotePreview from '../AskAI/components/AskAINotePreview';
import AskAICreateNoteDialog from '../AskAI/components/AskAICreateNoteDialog';
import { RecordingSession } from '../Recording/RecordingSession';
import { RecordingState, SavedRecording } from '../Recording/RecordingTypes';
import TranscriptionController, {
  isTranscriptionFileBusy,
} from '../Recording/TranscriptionController';
import useRecordingSession from '../Recording/useRecordingSession';
import useTranscriptionController from '../Recording/useTranscriptionController';
import { WorkspaceSaveSelection } from '../Recording/components/SaveToWorkspaceDialog';
import StudioChatPanel from './components/StudioChatPanel';
import useStudioAgent from './useStudioAgent';
import RecordingReviewDialog from './components/RecordingReviewDialog';
import StudioReadinessGate from './components/StudioReadinessGate';
import { StudioWorkspace } from './StudioTypes';
import useStudioReadiness from './useStudioReadiness';
import useOnboardingActive from '../../onboarding/useOnboardingActive';
import TrashUndoToast from '../../components/TrashUndoToast';
import '../AskAI/AskAIPage.css';
import '../AskAI/AskAIChat.css';
import '../AskAI/AskAIDialog.css';
import './StudioPage.css';

type Engine = {
  session: RecordingSession;
  transcription: TranscriptionController;
};

type NoteTrashUndo = {
  note: AskAINote;
  linkedNotes: AskAINote[];
  sourceIndex: number;
  wasPreviewed: boolean;
  wasSelected: boolean;
};

/** 单次提问最多带多少条笔记，与后端整工作区检索的上限保持一致。 */
const MAX_CONTEXT_NOTES = 24;

function createEngine(): Engine {
  return {
    session: new RecordingSession(),
    transcription: new TranscriptionController(),
  };
}

function buildTranscriptText(
  snapshot: ReturnType<TranscriptionController['getSnapshot']>,
): string {
  const finalText = snapshot.job?.result?.text?.trim();
  if (finalText) return finalText;
  return snapshot.liveSegments
    .map((segment) => segment.text.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const TITLE_SYSTEM_PROMPT = 'studio.prompt.title';

/** 清洗模型返回的标题：取首行、去掉包裹引号与结尾标点。 */
function sanitizeTitle(raw: string): string {
  const firstLine = raw.trim().split(/\r?\n/u)[0] ?? '';
  return firstLine
    .replace(/^["'“”「」『』\s]+|["'“”「」『』\s]+$/gu, '')
    .replace(/[。.!！?？,，;；:：]+$/u, '')
    .trim()
    .slice(0, 80);
}

/**
 * 对话工作台：以 AI 对话为主，把录音 / 上传 / 转录 / 保存深度整合进输入框。
 * 录音结束弹出复核窗口，保存为笔记后自动把该笔记挂到当前对话上。
 */
export default function StudioPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const page = useAskAIPage();
  const [engine, setEngine] = useState<Engine>(createEngine);
  const snapshot = useRecordingSession(engine.session);
  const transcriptionSnapshot = useTranscriptionController(
    engine.transcription,
  );

  const defaultNoteNameMemo = useCallback(
    (uploadedFileName: string | null) => {
      if (uploadedFileName) {
        return uploadedFileName.replace(/\.[^.]+$/u, '').slice(0, 80);
      }
      return `${t('studio.recording.defaultPrefix')}${new Intl.DateTimeFormat(
        'zh-CN',
        {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        },
      ).format(new Date())}`;
    },
    [t],
  );

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  // 新增笔记的目标工作区（从左栏某个工作区那一行点 + 时带过来）。
  const [createWorkspaceId, setCreateWorkspaceId] = useState<number | null>(
    null,
  );
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewFileMode, setReviewFileMode] = useState(false);
  // 右侧笔记原文默认收起，双击左侧笔记才打开。
  const [previewNoteId, setPreviewNoteId] = useState<number | null>(null);
  // 输入框里挂着的关联笔记，可用 # 追加多条。
  const [linkedNotes, setLinkedNotes] = useState<AskAINote[]>([]);
  // 也可以挂「整个工作区」，支持多个，并且能和单条笔记混着挂。
  const [linkedWorkspaceIds, setLinkedWorkspaceIds] = useState<number[]>([]);
  const [workspaces, setWorkspaces] = useState<StudioWorkspace[]>([]);

  const { selectNote } = page;
  useEffect(() => {
    const routedNoteId = (location.state as { noteId?: number } | null)?.noteId;
    if (routedNoteId) selectNote(routedNoteId);
  }, [location.state, selectNote]);

  // 开工前检查：STT / TTS / LLM / Embedding / 运行时缺一不可
  const readiness = useStudioReadiness();
  // 新手引导要在工作台里挨个指输入框、录音按钮、笔记库，
  // 这些控件只有工作台渲染出来才存在。
  const onboardingActive = useOnboardingActive();

  // 智能体模式：开启后由本地 Agent 调用工具自行查找，而不是直接问挂上的笔记。
  const [agentMode, setAgentMode] = useState(false);
  // 智能体这一串问答落在哪个会话里，以及已经落过库的轮次。
  const agentConversationId = useRef<number | null>(null);
  const recordedAgentTurns = useRef(new Set<string>());
  const { agent, runAgent, cancelAgent, resetAgent } = useStudioAgent();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [aiTitle, setAiTitle] = useState<string | null>(null);
  const [titlePending, setTitlePending] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [trashUndo, setTrashUndo] = useState<NoteTrashUndo | null>(null);
  const [trashError, setTrashError] = useState('');
  const preserveLinksOnSelectionChange = useRef(false);
  const startedAtRef = useRef<number | null>(null);

  const handleDeleteNote = async (noteId: number) => {
    const note = page.notes.find((item) => item.id === noteId);
    if (!note) return;
    const undo: NoteTrashUndo = {
      note,
      linkedNotes,
      sourceIndex: page.sources.findIndex((item) => item.id === noteId),
      wasPreviewed: previewNoteId === noteId,
      wasSelected: page.selectedNote?.id === noteId,
    };

    try {
      setTrashError('');
      await window.electron.trash.moveNote(noteId);
      setLinkedNotes((current) => current.filter((item) => item.id !== noteId));
      page.removeSourceNote(noteId);
      if (undo.wasPreviewed) setPreviewNoteId(null);
      if (undo.wasSelected) preserveLinksOnSelectionChange.current = true;
      await page.reloadNotes();
      setTrashUndo(undo);
    } catch (reason) {
      setTrashError(
        reason instanceof Error ? reason.message : t('trash.error.move'),
      );
    }
  };

  const undoDeleteNote = async () => {
    if (!trashUndo) return;
    const undo = trashUndo;
    await window.electron.trash.restore({
      itemType: 'note',
      id: undo.note.id,
    });
    if (undo.wasSelected) preserveLinksOnSelectionChange.current = true;
    await page.reloadNotes(undo.wasSelected ? undo.note.id : undefined);
    setLinkedNotes(undo.linkedNotes);
    if (undo.wasPreviewed) setPreviewNoteId(undo.note.id);
    if (undo.sourceIndex >= 0)
      page.restoreSourceNote(undo.note, undo.sourceIndex);
  };

  const recordingActive =
    snapshot.state === RecordingState.Recording ||
    snapshot.state === RecordingState.Paused;

  // 把实时音频块喂给转录控制器；引擎切换时重新挂接并清理。
  useEffect(() => {
    const detach = engine.session.setLiveChunkHandler((chunk) =>
      engine.transcription.enqueueLiveChunk(chunk),
    );
    return () => {
      detach();
      engine.transcription.dispose();
    };
  }, [engine, t]);

  // 录音计时器。
  useEffect(() => {
    if (!recordingActive) return undefined;
    startedAtRef.current = Date.now() - elapsedMs;
    const timer = window.setInterval(() => {
      if (startedAtRef.current !== null) {
        setElapsedMs(Date.now() - startedAtRef.current);
      }
    }, 250);
    return () => window.clearInterval(timer);
    // elapsedMs 故意不作为依赖，避免每次 tick 重建定时器。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordingActive]);

  const resetEngine = useCallback(() => {
    setEngine(createEngine());
    setElapsedMs(0);
    startedAtRef.current = null;
  }, []);

  // 只负责「开窗」，不等待任何转录/整理任务；内容由下面的实时快照持续填充。
  const openReview = useCallback((fileMode: boolean) => {
    setReviewFileMode(fileMode);
    setSaveError(null);
    setAiTitle(null);
    setReviewOpen(true);
  }, []);

  // 切换当前笔记时，关联笔记重置为这一条（此时对话也会重置）。
  // 只依赖笔记 id：笔记列表刷新导致对象身份变化时，不应清掉用户手动挂上的关联。
  const selectedNoteId = page.selectedNote?.id ?? null;
  useEffect(() => {
    if (preserveLinksOnSelectionChange.current) {
      preserveLinksOnSelectionChange.current = false;
      return;
    }
    const note = page.notes.find((item) => item.id === selectedNoteId) ?? null;
    setLinkedNotes(note ? [note] : []);
    setLinkedWorkspaceIds([]);
    resetAgent(); // 切换笔记等于开新对话，助理的历史一并清空
    agentConversationId.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNoteId]);

  // 笔记库左栏按工作区分组需要工作区名称。
  useEffect(() => {
    window.electron.workspace
      .getList(100)
      .then((items) => {
        setWorkspaces(
          (items as StudioWorkspace[]).filter(
            (item) => Number.isInteger(item.id) && item.name,
          ),
        );
        return null;
      })
      .catch(() => undefined);
  }, [page.notes]);

  const addLinkedNote = useCallback((note: AskAINote) => {
    setLinkedNotes((prev) =>
      prev.some((item) => item.id === note.id) ? prev : [...prev, note],
    );
  }, []);

  const removeLinkedNote = useCallback((noteId: number) => {
    setLinkedNotes((prev) => prev.filter((item) => item.id !== noteId));
  }, []);

  const linkWorkspace = useCallback((workspaceId: number) => {
    setLinkedWorkspaceIds((prev) =>
      prev.includes(workspaceId) ? prev : [...prev, workspaceId],
    );
  }, []);

  const unlinkWorkspace = useCallback((workspaceId: number) => {
    setLinkedWorkspaceIds((prev) => prev.filter((id) => id !== workspaceId));
  }, []);

  // 把挂上的工作区展开成它们的全部笔记，与单独挂的笔记合并去重后一起提问。
  // 这样多个工作区、以及「工作区 + 单条笔记」的混搭都能直接支持。
  const linkedNoteIds = useMemo(() => {
    const ids = new Set<number>();
    page.notes.forEach((note) => {
      if (
        note.workspaceId !== null &&
        linkedWorkspaceIds.includes(note.workspaceId)
      ) {
        ids.add(note.id);
      }
    });
    linkedNotes.forEach((note) => ids.add(note.id));
    return [...ids].slice(0, MAX_CONTEXT_NOTES);
  }, [page.notes, linkedNotes, linkedWorkspaceIds]);

  const askWithLinkedNotes = useCallback(
    (question: string) => {
      // 智能体自己在全部笔记里检索，挂上的笔记只作为额外线索一起带过去。
      if (agentMode) return runAgent(question, linkedNoteIds);

      return page.ask(question, { noteIds: linkedNoteIds });
    },
    [agentMode, linkedNoteIds, runAgent, page],
  );

  const openPreview = useCallback((noteId: number) => {
    setPreviewNoteId(noteId);
  }, []);

  // 新建会话直接开一个空白对话：不预先弹窗让用户配置，
  // 关联笔记、助理模式都留到输入框里现场决定。
  const startBlankConversation = useCallback(() => {
    page.resetChat();
    resetAgent();
    setAgentMode(false);
    setLinkedNotes([]);
    setLinkedWorkspaceIds([]);
    setPreviewNoteId(null);
    agentConversationId.current = null;
  }, [page, resetAgent]);

  // 智能体模式的回答由主进程 Agent 生成，不走 askAI.ask，
  // 所以要在这里补一次落库，否则「最近会话」里永远看不到它。
  useEffect(() => {
    const turn = agent.turns.at(-1);
    if (!turn || recordedAgentTurns.current.has(turn.id)) return;
    // 先登记再落库：避免重渲染或严格模式下重复执行时写两遍。
    recordedAgentTurns.current.add(turn.id);
    window.electron.askAI
      .recordTurn({
        conversationId: agentConversationId.current,
        question: turn.question,
        answer: turn.answer,
        noteIds: linkedNoteIds,
      })
      .then((result) => {
        // 记住会话 id，后续追问都追加到同一个会话里，而不是每轮新建一个。
        agentConversationId.current = result.conversation.id;
        return page.reloadConversations();
      })
      .catch((reason) => {
        recordedAgentTurns.current.delete(turn.id);
        console.error('记录智能体会话失败', reason);
      });
    // linkedNoteIds / page 变化不该触发补录，只在出现新一轮回答时执行。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent.turns]);

  const previewNote = useMemo(
    () =>
      previewNoteId === null
        ? null
        : (page.notes.find((note) => note.id === previewNoteId) ?? null),
    [page.notes, previewNoteId],
  );

  // 复核弹窗的内容实时取自转录快照，转录与语义整理的结果会陆续流入弹窗。
  const reviewRaw = useMemo(
    () => buildTranscriptText(transcriptionSnapshot),
    [transcriptionSnapshot],
  );
  const reviewSummaries = useMemo(
    () => transcriptionSnapshot.liveSummaries.map((summary) => summary.text),
    [transcriptionSnapshot.liveSummaries],
  );
  const reviewProcessing =
    transcriptionSnapshot.livePendingCount > 0 ||
    transcriptionSnapshot.summaryPendingCount > 0 ||
    transcriptionSnapshot.requestPending;

  // 内容整理完成后，用本地模型根据内容自动生成笔记标题。
  // 失败或未启用 LLM 时保持时间戳默认名；用户手动改过标题则不会被覆盖。
  useEffect(() => {
    if (!reviewOpen || reviewProcessing || aiTitle !== null) return undefined;
    const source = (reviewSummaries.join('\n') || reviewRaw).trim();
    if (!source) return undefined;

    let cancelled = false;
    setTitlePending(true);
    window.electron.llm
      .chat(
        [
          { role: 'system', content: t(TITLE_SYSTEM_PROMPT) },
          { role: 'user', content: source.slice(0, 2000) },
        ],
        { temperature: 0.2 },
      )
      .then((result) => {
        if (cancelled) return undefined;
        const title = sanitizeTitle(
          (result as { content?: string })?.content ?? '',
        );
        if (title) setAiTitle(title);
        return undefined;
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setTitlePending(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reviewOpen, reviewProcessing, aiTitle, reviewRaw, reviewSummaries, t]);

  const startRecording = useCallback(() => {
    setRecordError(null);
    setElapsedMs(0);
    engine.transcription.resetLive('microphone');
    engine.session.start().catch(() => undefined);
  }, [engine]);

  const stopRecording = useCallback(async () => {
    try {
      await engine.session.stop();
      // 先弹窗：停止录音后立刻让用户看到复核界面。
      openReview(false);
      // 语义整理放到后台继续跑，结果通过实时快照回填到弹窗，避免阻塞弹窗打开。
      engine.transcription.finalizeLiveSummary().catch(() => undefined);
    } catch (reason) {
      setRecordError(
        reason instanceof Error
          ? reason.message
          : t('studio.recording.stopError'),
      );
    }
  }, [engine, openReview, t]);

  const uploadAudio = useCallback(() => {
    setRecordError(null);
    engine.transcription
      .pickFileAndStart({ skipConfirmation: true })
      .catch((reason: unknown) => {
        setRecordError(
          reason instanceof Error
            ? reason.message
            : t('studio.recording.uploadError'),
        );
      });
  }, [engine, t]);

  // 上传文件转录完成后自动弹出复核窗口。
  useEffect(() => {
    if (
      !reviewOpen &&
      transcriptionSnapshot.inputMode === 'file' &&
      transcriptionSnapshot.job?.status === 'completed' &&
      transcriptionSnapshot.job.result?.text
    ) {
      openReview(true);
    }
  }, [
    reviewOpen,
    transcriptionSnapshot.inputMode,
    transcriptionSnapshot.job?.status,
    transcriptionSnapshot.job?.result?.text,
    openReview,
  ]);

  const reRecord = useCallback(async () => {
    setReviewOpen(false);
    setSaveError(null);
    await engine.session.discard().catch(() => undefined);
    setElapsedMs(0);
    engine.transcription.resetLive('microphone');
    engine.session.start().catch(() => undefined);
  }, [engine]);

  const closeReview = useCallback(() => {
    setReviewOpen(false);
    setSaveError(null);
    // 重置录音引擎：丢弃本次未保存的录音/上传，避免已完成的任务再次触发复核窗。
    resetEngine();
  }, [resetEngine]);

  const saveAsNote = useCallback(
    async (selection: WorkspaceSaveSelection) => {
      await engine.transcription.finalizeLiveSummary();
      const latest = engine.transcription.getSnapshot();
      const transcript = buildTranscriptText(latest);
      const summaries = latest.liveSummaries.map((summary) => summary.text);
      if (!transcript) {
        setSaveError(t('studio.recording.noTranscript'));
        return;
      }

      setSaving(true);
      setSaveError(null);
      let importedRecording: SavedRecording | null = null;

      try {
        let { workspaceId } = selection;
        if (workspaceId === null) {
          const created = (await window.electron.workspace.create(
            selection.newWorkspaceName,
          )) as { id: number; name: string };
          workspaceId = created.id;
        }

        let audioRelativePath = snapshot.savedRecording?.relativePath ?? null;
        if (reviewFileMode && latest.uploadedFilePath) {
          importedRecording = (await window.electron.audio.importRecordingFile(
            latest.uploadedFilePath,
          )) as SavedRecording;
          audioRelativePath = importedRecording.relativePath;
        } else if (
          !reviewFileMode &&
          snapshot.state === RecordingState.Completed &&
          !audioRelativePath
        ) {
          const savedRecording = await engine.session.save();
          if (savedRecording) audioRelativePath = savedRecording.relativePath;
        }

        const result = (await window.electron.workspace.saveTranscriptionNote({
          workspaceId,
          name: selection.noteName,
          transcript,
          summaries,
          audioRelativePath,
        })) as { noteId: number; workspaceId: number; name: string };

        // 刷新笔记库并把新笔记挂到对话上。
        await page.reloadNotes(result.noteId);
        page.selectNote(result.noteId);

        // Trigger Todo Extraction in the background
        window.electron.dashboard
          .extractTodosForNote(result.noteId)
          .catch(console.error);

        setReviewOpen(false);
        resetEngine();
      } catch (reason) {
        if (importedRecording) {
          await window.electron.audio
            .discardRecording(importedRecording.relativePath)
            .catch(() => undefined);
        }
        setSaveError(
          reason instanceof Error
            ? reason.message
            : t('studio.recording.saveError'),
        );
      } finally {
        setSaving(false);
      }
    },
    [
      engine,
      page,
      reviewFileMode,
      snapshot.savedRecording,
      snapshot.state,
      resetEngine,
      t,
    ],
  );

  // 「能不能再开一次采集」与独立录音页共用 isTranscriptionFileBusy：
  // 只看 requestPending 会漏掉语言检测和文件转写 job，用户能二次点上传，
  // 把当前 controller 状态连同复核弹窗内容一起冲掉。
  //
  // 停止录音走单独的 stopBusy：录音期间实时分段一直在转写，
  // livePendingCount 常驻大于 0，用同一个开关会让用户停不下来。
  const recording = useMemo(
    () => ({
      active: recordingActive,
      busy:
        snapshot.busy ||
        isTranscriptionFileBusy(transcriptionSnapshot, {
          includeSummary: true,
        }),
      stopBusy: snapshot.busy,
      elapsedMs,
      error:
        recordError ||
        snapshot.errorMessage ||
        transcriptionSnapshot.liveError ||
        transcriptionSnapshot.requestError,
    }),
    [
      recordingActive,
      snapshot.busy,
      snapshot.errorMessage,
      transcriptionSnapshot,
      elapsedMs,
      recordError,
    ],
  );

  // 组件没配齐就不进工作台：缺哪一项在门禁页里列清楚，
  // 而不是让用户用到某个功能时才撞见静默失败。
  //
  // 引导进行中是唯一的例外：新用户此时必然一个模型都没装，
  // 挡在门禁页会让引导中段那几步找不到要指的控件，
  // 聚光灯只能降级成居中卡片，讲解也就无从谈起。
  // 放进来只是为了「看得见」，功能本身该失败还是会失败。
  if (!readiness.ready && !onboardingActive) {
    return <StudioReadinessGate readiness={readiness} />;
  }

  return (
    <section
      className={`studio-page${previewNote ? '' : ' studio-page--no-preview'}`}
    >
      <AskAINotesPanel
        notes={page.notes}
        workspaces={workspaces}
        conversations={page.conversations}
        selectedNoteId={page.selectedNote?.id ?? null}
        onAddNote={(workspaceId) => {
          setCreateWorkspaceId(workspaceId ?? null);
          setShowCreateDialog(true);
        }}
        onNewConversation={startBlankConversation}
        onSelectNote={page.selectNote}
        onPreviewNote={openPreview}
        onOpenConversation={page.openConversation}
        onDeleteNote={handleDeleteNote}
      />

      <StudioChatPanel
        messages={page.messages}
        sources={page.sources}
        selectedNote={page.selectedNote}
        allNotes={page.notes}
        status={agentMode ? agent.status || page.status : page.status}
        isSending={page.isSending || agent.running}
        recording={recording}
        agentMode={agentMode}
        agent={agent}
        onToggleAgentMode={() => setAgentMode((prev) => !prev)}
        onCancelAgent={cancelAgent}
        workspaces={workspaces}
        conversationName={page.activeConversation?.name ?? ''}
        linkedNotes={linkedNotes}
        linkedWorkspaceIds={linkedWorkspaceIds}
        onAddLinkedNote={addLinkedNote}
        onRemoveLinkedNote={removeLinkedNote}
        onLinkWorkspace={linkWorkspace}
        onUnlinkWorkspace={unlinkWorkspace}
        onAsk={askWithLinkedNotes}
        onStartRecording={startRecording}
        onStopRecording={stopRecording}
        onUploadAudio={uploadAudio}
      />

      {previewNote && (
        <aside className="studio-source">
          <button
            type="button"
            className="studio-source__close"
            onClick={() => setPreviewNoteId(null)}
            aria-label={t('studio.preview.close')}
            title={t('studio.preview.close')}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
          <AskAINotePreview note={previewNote} />
        </aside>
      )}

      {reviewOpen && (
        <RecordingReviewDialog
          open={reviewOpen}
          defaultNoteName={
            aiTitle ??
            defaultNoteNameMemo(
              reviewFileMode ? transcriptionSnapshot.uploadedFileName : null,
            )
          }
          rawTranscript={reviewRaw}
          summaries={reviewSummaries}
          processing={reviewProcessing || titlePending}
          saving={saving}
          error={saveError}
          onSave={saveAsNote}
          onRerecord={reRecord}
          onClose={closeReview}
        />
      )}

      {showCreateDialog && (
        <AskAICreateNoteDialog
          onClose={() => setShowCreateDialog(false)}
          onCreate={(name, transcript) =>
            page.createNote(name, transcript, createWorkspaceId)
          }
        />
      )}

      {trashError && (
        <p className="studio-trash-error" role="alert">
          {trashError}
        </p>
      )}

      {trashUndo && (
        <TrashUndoToast
          dismissLabel={t('trash.action.dismiss')}
          message={t('trash.notice.noteMoved', {
            name: trashUndo.note.name,
          })}
          onDismiss={() => setTrashUndo(null)}
          onUndo={undoDeleteNote}
          undoLabel={t('trash.action.undo')}
          undoingLabel={t('trash.action.restoring')}
        />
      )}
    </section>
  );
}

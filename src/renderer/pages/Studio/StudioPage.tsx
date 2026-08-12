import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useAskAIPage from '../AskAI/useAskAIPage';
import AskAINotesPanel from '../AskAI/components/AskAINotesPanel';
import AskAINotePreview from '../AskAI/components/AskAINotePreview';
import AskAICreateNoteDialog from '../AskAI/components/AskAICreateNoteDialog';
import { RecordingSession } from '../Recording/RecordingSession';
import { RecordingState, SavedRecording } from '../Recording/RecordingTypes';
import TranscriptionController from '../Recording/TranscriptionController';
import useRecordingSession from '../Recording/useRecordingSession';
import useTranscriptionController from '../Recording/useTranscriptionController';
import { WorkspaceSaveSelection } from '../Recording/components/SaveToWorkspaceDialog';
import StudioChatPanel from './components/StudioChatPanel';
import RecordingReviewDialog from './components/RecordingReviewDialog';
import '../AskAI/AskAIPage.css';
import '../AskAI/AskAIChat.css';
import '../AskAI/AskAIDialog.css';
import './StudioPage.css';

type Engine = {
  session: RecordingSession;
  transcription: TranscriptionController;
};

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

function defaultNoteName(uploadedFileName: string | null): string {
  if (uploadedFileName) {
    return uploadedFileName.replace(/\.[^.]+$/u, '').slice(0, 80);
  }
  return `Recording ${new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date())}`;
}

/**
 * 对话工作台：以 AI 对话为主，把录音 / 上传 / 转录 / 保存深度整合进输入框。
 * 录音结束弹出复核窗口，保存为笔记后自动把该笔记挂到当前对话上。
 */
export default function StudioPage() {
  const page = useAskAIPage();
  const [engine, setEngine] = useState<Engine>(createEngine);
  const snapshot = useRecordingSession(engine.session);
  const transcriptionSnapshot = useTranscriptionController(engine.transcription);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewData, setReviewData] = useState<{
    raw: string;
    summaries: string[];
    fileMode: boolean;
  }>({ raw: '', summaries: [], fileMode: false });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAtRef = useRef<number | null>(null);

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
  }, [engine]);

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

  const openReviewFromSnapshot = useCallback((fileMode: boolean) => {
    const latest = engine.transcription.getSnapshot();
    setReviewData({
      raw: buildTranscriptText(latest),
      summaries: latest.liveSummaries.map((summary) => summary.text),
      fileMode,
    });
    setSaveError(null);
    setReviewOpen(true);
  }, [engine.transcription]);

  const startRecording = useCallback(() => {
    setRecordError(null);
    setElapsedMs(0);
    engine.transcription.resetLive('microphone');
    engine.session.start().catch(() => undefined);
  }, [engine]);

  const stopRecording = useCallback(async () => {
    try {
      await engine.session.stop();
      await engine.transcription.finalizeLiveSummary();
      openReviewFromSnapshot(false);
    } catch (reason) {
      setRecordError(
        reason instanceof Error ? reason.message : '录音结束失败',
      );
    }
  }, [engine, openReviewFromSnapshot]);

  const uploadAudio = useCallback(() => {
    setRecordError(null);
    engine.transcription.pickFileAndStart().catch((reason: unknown) => {
      setRecordError(reason instanceof Error ? reason.message : '上传失败');
    });
  }, [engine]);

  // 上传文件转录完成后自动弹出复核窗口。
  useEffect(() => {
    if (
      !reviewOpen &&
      transcriptionSnapshot.inputMode === 'file' &&
      transcriptionSnapshot.job?.status === 'completed' &&
      transcriptionSnapshot.job.result?.text
    ) {
      openReviewFromSnapshot(true);
    }
  }, [
    reviewOpen,
    transcriptionSnapshot.inputMode,
    transcriptionSnapshot.job?.status,
    transcriptionSnapshot.job?.result?.text,
    openReviewFromSnapshot,
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
        setSaveError('没有可保存的转录内容 / No transcript to save');
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
        if (reviewData.fileMode && latest.uploadedFilePath) {
          importedRecording = (await window.electron.audio.importRecordingFile(
            latest.uploadedFilePath,
          )) as SavedRecording;
          audioRelativePath = importedRecording.relativePath;
        } else if (
          !reviewData.fileMode &&
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
            : '保存到工作空间失败 / Unable to save',
        );
      } finally {
        setSaving(false);
      }
    },
    [engine, page, reviewData.fileMode, snapshot.savedRecording, snapshot.state, resetEngine],
  );

  const recording = useMemo(
    () => ({
      active: recordingActive,
      busy: snapshot.busy || transcriptionSnapshot.requestPending,
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
      transcriptionSnapshot.requestPending,
      transcriptionSnapshot.liveError,
      transcriptionSnapshot.requestError,
      elapsedMs,
      recordError,
    ],
  );

  return (
    <section className="studio-page">
      <AskAINotesPanel
        notes={page.notes}
        conversations={page.conversations}
        selectedNoteId={page.selectedNote?.id ?? null}
        onAddNote={() => setShowCreateDialog(true)}
        onSelectNote={page.selectNote}
        onOpenConversation={page.openConversation}
      />

      <StudioChatPanel
        messages={page.messages}
        sources={page.sources}
        selectedNote={page.selectedNote}
        allNotes={page.notes}
        scope={page.scope}
        status={page.status}
        isSending={page.isSending}
        recording={recording}
        onScopeChange={page.setScope}
        onAsk={page.ask}
        onStartRecording={startRecording}
        onStopRecording={stopRecording}
        onUploadAudio={uploadAudio}
      />

      <aside className="studio-source">
        <AskAINotePreview note={page.selectedNote} />
      </aside>

      {reviewOpen && (
        <RecordingReviewDialog
          open={reviewOpen}
          defaultNoteName={defaultNoteName(
            reviewData.fileMode
              ? transcriptionSnapshot.uploadedFileName
              : null,
          )}
          rawTranscript={reviewData.raw}
          summaries={reviewData.summaries}
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
          onCreate={page.createNote}
        />
      )}
    </section>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { Model } from '../../../main/AI-module/Model';
import { RuntimeStatusSummary } from '../../../main/runtime/RuntimeStatusService';
import { EmbeddingModelStatus } from '../../../main/semantic/SemanticTypes';
import {
  ModelRecommendation,
  ModelRecommendationController,
} from './ModelRecommendationController';

export type ModuleKey = 'stt' | 'tts' | 'embedding' | 'llm';

export type ModuleProgress = { message: string; percent: number | null };

type ByteProgress = {
  message?: string;
  receivedBytes?: number;
  totalBytes?: number;
};

const recommendationController = new ModelRecommendationController();

function toPercent(received?: number, total?: number): number | null {
  if (!received || !total) return null;
  return Math.round((received / total) * 100);
}

/**
 * 模型管理页的数据层：四个模块的模型列表、运行时状态、安装进度与错误。
 * 页面组件只负责展示，所有 IPC 调用集中在这里。
 */
export default function useModelManager() {
  const [sttModels, setSttModels] = useState<Model[]>([]);
  const [llmModels, setLlmModels] = useState<Model[]>([]);
  const [runtime, setRuntime] = useState<RuntimeStatusSummary | null>(null);
  const [embedding, setEmbedding] = useState<EmbeddingModelStatus | null>(null);
  const [recommendation, setRecommendation] =
    useState<ModelRecommendation | null>(null);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<ModuleKey, string>>>({});
  const [progress, setProgress] = useState<
    Partial<Record<ModuleKey, ModuleProgress | null>>
  >({});

  const setError = useCallback((module: ModuleKey, message: string) => {
    setErrors((current) => ({ ...current, [module]: message }));
  }, []);

  const loadRuntime = useCallback(async () => {
    const next = (await window.electron.runtime.getStatus()) as
      | RuntimeStatusSummary
      | undefined;
    if (next) setRuntime(next);
  }, []);

  const loadEmbedding = useCallback(async () => {
    const next = (await window.electron.semantic.getStatus()) as
      | EmbeddingModelStatus
      | undefined;
    if (next) setEmbedding(next);
  }, []);

  const loadModels = useCallback(async () => {
    const [stt, llm] = await Promise.all([
      window.electron.modelManagement.getModelList('stt'),
      window.electron.modelManagement.getModelList('llm'),
    ]);
    setSttModels(stt);
    setLlmModels(llm);
    return { stt, llm };
  }, []);

  const refreshAll = useCallback(async () => {
    const { stt, llm } = await loadModels();
    await Promise.all([loadRuntime(), loadEmbedding()]);
    try {
      setRecommendation(
        await recommendationController.getRecommendation(stt, llm),
      );
    } catch {
      // 推荐只是下拉里的一个标签，检测失败时静默降级。
      setRecommendation(null);
    }
  }, [loadModels, loadRuntime, loadEmbedding]);

  useEffect(() => {
    refreshAll().catch((reason) => {
      setError(
        'stt',
        reason instanceof Error ? reason.message : '读取状态失败',
      );
    });
  }, [refreshAll, setError]);

  useEffect(() => {
    const track =
      (module: ModuleKey) =>
      (raw: unknown): void => {
        const value = raw as ByteProgress;
        setProgress((current) => ({
          ...current,
          [module]: {
            message: value.message ?? '正在安装…',
            percent: toPercent(value.receivedBytes, value.totalBytes),
          },
        }));
      };

    const unsubscribes = [
      window.electron.runtime.onInstallProgress(track('stt')),
      window.electron.runtime.onFfmpegInstallProgress(track('stt')),
      window.electron.runtime.onOllamaInstallProgress(track('llm')),
      window.electron.runtime.onTTSInstallProgress(track('tts')),
      window.electron.semantic.onInstallProgress((raw) => {
        const value = raw as {
          status?: string;
          completed: number;
          total: number;
        };
        setProgress((current) => ({
          ...current,
          embedding: {
            message: value.status ?? '正在下载…',
            percent: toPercent(value.completed, value.total),
          },
        }));
      }),
    ];
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, []);

  /** 统一的操作外壳：置忙、清错、跑操作、刷新、收尾。 */
  const run = useCallback(
    async (
      module: ModuleKey,
      key: string,
      operation: () => Promise<unknown>,
      fallbackMessage: string,
    ) => {
      if (busyId) return;
      setBusyId(key);
      setErrors((current) => ({ ...current, [module]: '' }));
      try {
        await operation();
        await refreshAll();
      } catch (reason) {
        setError(
          module,
          reason instanceof Error ? reason.message : fallbackMessage,
        );
      } finally {
        setBusyId(null);
        setProgress((current) => ({ ...current, [module]: null }));
      }
    },
    [busyId, refreshAll, setError],
  );

  const modelActions = useCallback(
    (module: 'stt' | 'llm') => ({
      select: (id: string) =>
        run(
          module,
          id,
          () => window.electron.modelManagement.activateModel(module, id),
          '切换模型失败',
        ),
      download: (id: string) =>
        run(
          module,
          id,
          () => window.electron.modelManagement.downloadModel(module, id),
          '下载模型失败',
        ),
      remove: (id: string) =>
        run(
          module,
          id,
          () => window.electron.modelManagement.deleteModel(module, id),
          '删除模型失败',
        ),
    }),
    [run],
  );

  return {
    sttModels,
    llmModels,
    runtime,
    embedding,
    recommendation,
    busyId,
    errors,
    progress,
    refreshAll,
    stt: modelActions('stt'),
    llm: modelActions('llm'),
    installWhisper: () =>
      run(
        'stt',
        'runtime:whisper',
        () => window.electron.runtime.installWhisper(),
        'Whisper 运行时安装失败',
      ),
    installFfmpeg: () =>
      run(
        'stt',
        'runtime:ffmpeg',
        () => window.electron.runtime.installFfmpeg(),
        'ffmpeg 安装失败',
      ),
    installOllama: () =>
      run(
        'llm',
        'runtime:ollama',
        () => window.electron.runtime.installOllama(),
        'Ollama 运行时安装失败',
      ),
    installTTS: () =>
      run(
        'tts',
        'runtime:tts',
        () => window.electron.runtime.installTTS(),
        'TTS 模型安装失败',
      ),
    installEmbedding: () =>
      run(
        'embedding',
        'embedding:model',
        () => window.electron.semantic.installModel(),
        'Embedding 模型安装失败',
      ),
    /** 卸载应用自己下载的运行时；系统安装的副本由主进程拒绝并回报原因。 */
    uninstallRuntime: (module: ModuleKey, target: string) =>
      run(
        module,
        `uninstall:${target}`,
        () => window.electron.runtime.uninstall(target),
        '卸载失败',
      ),
  };
}

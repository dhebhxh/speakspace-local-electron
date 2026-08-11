import { useCallback, useEffect, useState } from 'react';
import {
  EmbeddingInstallProgress,
  EmbeddingModelStatus,
} from '../../../../main/semantic/SemanticTypes';
import './EmbeddingModelPanel.css';

export default function EmbeddingModelPanel() {
  const [status, setStatus] = useState<EmbeddingModelStatus | null>(null);
  const [progress, setProgress] = useState<EmbeddingInstallProgress | null>(
    null,
  );
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState('');

  const loadStatus = useCallback(async () => {
    const next = (await window.electron.semantic.getStatus()) as
      | EmbeddingModelStatus
      | undefined;
    if (next) setStatus(next);
  }, []);

  useEffect(() => {
    loadStatus().catch((reason) => {
      setError(
        reason instanceof Error ? reason.message : '无法读取 Embedding 状态',
      );
    });
  }, [loadStatus]);

  useEffect(
    () =>
      window.electron.semantic.onInstallProgress((rawProgress) => {
        setProgress(rawProgress as EmbeddingInstallProgress);
      }),
    [],
  );

  const install = async () => {
    try {
      setInstalling(true);
      setError('');
      await window.electron.semantic.installModel();
      await loadStatus();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Embedding 安装失败');
    } finally {
      setInstalling(false);
    }
  };

  const percent =
    typeof progress?.completed === 'number' && progress.total > 0
      ? Math.round((progress.completed / progress.total) * 100)
      : null;

  return (
    <section className="embedding-model-panel">
      <header>
        <div>
          <span className="model-manager-eyebrow">EMBEDDING</span>
          <h2>相似笔记检索</h2>
        </div>
        <span
          className={`embedding-model-badge${status?.installed ? ' is-ready' : ''}`}
        >
          {status?.installed ? '可搜索' : '尚未安装'}
        </span>
      </header>
      <p>
        使用 Ollama 的 <strong>{status?.modelName ?? 'bge-m3'}</strong>
        在本机建立可重建的笔记向量索引。
      </p>
      {progress && installing && (
        <p className="embedding-model-progress">
          {progress.status}
          {percent !== null ? ` · ${percent}%` : ''}
        </p>
      )}
      {error && (
        <p className="embedding-model-error" role="alert">
          {error}
        </p>
      )}
      {!status?.installed && (
        <button disabled={installing} onClick={install} type="button">
          {installing ? '正在下载…' : '安装 bge-m3'}
        </button>
      )}
    </section>
  );
}

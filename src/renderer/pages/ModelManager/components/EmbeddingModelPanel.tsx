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
        reason instanceof Error ? reason.message : '无法读取检索模型状态',
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
      setError(reason instanceof Error ? reason.message : '检索模型安装失败');
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
        <div className="runtime-panel-title">
          <span className="runtime-panel-title__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <circle cx="10.5" cy="10.5" r="5.5" />
              <path d="m15 15 4.5 4.5M8 10.5h5M10.5 8v5" />
            </svg>
          </span>
          <div>
            <span>SEARCH</span>
            <h3>相似笔记</h3>
          </div>
        </div>
        <span
          className={`embedding-model-badge${status?.installed ? ' is-ready' : ''}`}
        >
          {status?.installed ? '可用' : '未安装'}
        </span>
      </header>

      <strong className="compact-runtime-model">
        {status?.modelName ?? 'bge-m3'}
      </strong>
      <div className="compact-runtime-facts" aria-label="相似笔记检索状态">
        <span className={status?.installed ? 'is-ready' : ''}>向量模型</span>
        <span>本地索引</span>
      </div>

      {progress && installing && (
        <div className="runtime-inline-progress" role="status">
          <span>{progress.status}</span>
          <strong>{percent !== null ? `${percent}%` : '…'}</strong>
        </div>
      )}
      {error && (
        <p className="embedding-model-error" role="alert">
          {error}
        </p>
      )}
      {!status?.installed && (
        <button disabled={installing} onClick={install} type="button">
          {installing ? '安装中' : '安装 bge-m3'}
        </button>
      )}
    </section>
  );
}

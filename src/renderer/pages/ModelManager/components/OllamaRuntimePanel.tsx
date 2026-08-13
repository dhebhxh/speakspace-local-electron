import { useCallback, useEffect, useState } from 'react';
import { RuntimeStatusSummary } from '../../../../main/runtime/RuntimeStatusService';
import { OllamaInstallProgress } from '../../../../main/llm/OllamaRuntimeInstaller';
import './OllamaRuntimePanel.css';

export default function OllamaRuntimePanel(props: { refreshToken: string }) {
  const { refreshToken } = props;
  const [status, setStatus] = useState<RuntimeStatusSummary | null>(null);
  const [progress, setProgress] = useState<OllamaInstallProgress | null>(null);
  const [installing, setInstalling] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const loadStatus = useCallback(async () => {
    const nextStatus = (await window.electron.runtime.getStatus()) as
      | RuntimeStatusSummary
      | undefined;
    if (nextStatus) setStatus(nextStatus);
  }, []);

  useEffect(() => {
    loadStatus().catch((error) => {
      setErrorMessage(
        error instanceof Error ? error.message : '无法读取 Ollama 状态',
      );
    });
  }, [loadStatus, refreshToken]);

  useEffect(
    () =>
      window.electron.runtime.onOllamaInstallProgress((rawProgress) => {
        setProgress(rawProgress as OllamaInstallProgress);
      }),
    [],
  );

  const installRuntime = async () => {
    setInstalling(true);
    setErrorMessage('');
    try {
      await window.electron.runtime.installOllama();
      await loadStatus();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Ollama 安装失败',
      );
    } finally {
      setInstalling(false);
    }
  };

  const runtime = status?.languageModel;
  const percent =
    progress?.receivedBytes && progress.totalBytes
      ? Math.round((progress.receivedBytes / progress.totalBytes) * 100)
      : null;

  return (
    <section className="ollama-runtime-panel">
      <header>
        <div className="runtime-panel-title">
          <span className="runtime-panel-title__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <circle cx="8" cy="8" r="3" />
              <circle cx="17" cy="7" r="2" />
              <circle cx="16" cy="17" r="3" />
              <path d="m10.5 9.5 4.5-1.7M10 10.5l4 4.5" />
            </svg>
          </span>
          <div>
            <span>LLM</span>
            <h3>总结与问答</h3>
          </div>
        </div>
        <span
          className={`ollama-runtime-badge${runtime?.runtimeReady ? ' is-ready' : ''}`}
        >
          {runtime?.runtimeReady ? '可用' : '未就绪'}
        </span>
      </header>

      <strong
        className="compact-runtime-model"
        title={runtime?.activeModelName ?? undefined}
      >
        {runtime?.activeModelName ?? '未选择模型'}
      </strong>
      <div className="compact-runtime-facts" aria-label="Ollama 状态">
        <span className={runtime?.binaryPresent ? 'is-ready' : ''}>Ollama</span>
        <span className={runtime?.serverRunning ? 'is-ready' : ''}>服务</span>
        <span>{runtime?.installedModels.length ?? 0} 个模型</span>
      </div>

      {progress && installing && (
        <div className="runtime-inline-progress" role="status">
          <span>{progress.message}</span>
          <strong>{percent !== null ? `${percent}%` : '…'}</strong>
        </div>
      )}
      {errorMessage && (
        <p className="ollama-runtime-error" role="alert">
          {errorMessage}
        </p>
      )}
      {!runtime?.binaryPresent && (
        <button type="button" disabled={installing} onClick={installRuntime}>
          {installing ? '安装中' : '安装 Ollama'}
        </button>
      )}
    </section>
  );
}

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
        error instanceof Error ? error.message : 'Ollama 运行时安装失败',
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
        <div>
          <span className="model-manager-eyebrow">LLM RUNTIME</span>
          <h2>Ollama 本地运行时</h2>
        </div>
        <span
          className={`ollama-runtime-badge${runtime?.runtimeReady ? ' is-ready' : ''}`}
        >
          {runtime?.runtimeReady ? '可对话' : '尚未就绪'}
        </span>
      </header>

      <div className="ollama-runtime-grid">
        <span>Ollama CLI</span>
        <strong>{runtime?.binaryPresent ? '已安装' : '未安装'}</strong>
        <span>本地服务</span>
        <strong>{runtime?.serverRunning ? '运行中' : '未运行'}</strong>
        <span>当前 LLM</span>
        <strong>{runtime?.activeModelName ?? '未选择'}</strong>
        <span>已安装模型</span>
        <strong>{runtime?.installedModels.length ?? 0}</strong>
      </div>

      {progress && installing && (
        <p className="ollama-runtime-progress">
          {progress.message}
          {percent !== null ? ` · ${percent}%` : ''}
        </p>
      )}
      {errorMessage && (
        <p className="ollama-runtime-error" role="alert">
          {errorMessage}
        </p>
      )}
      {!runtime?.binaryPresent && (
        <button type="button" disabled={installing} onClick={installRuntime}>
          {installing ? '正在安装…' : '安装 Windows Ollama 运行时'}
        </button>
      )}
    </section>
  );
}

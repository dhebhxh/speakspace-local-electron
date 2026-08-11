import { useCallback, useEffect, useState } from 'react';
import { RuntimeStatusSummary } from '../../../../main/runtime/RuntimeStatusService';
import { TTSInstallProgress } from '../../../../main/tts/TTSInstallSupport';
import TTSVoicePreview from './TTSVoicePreview';
import './TTSRuntimePanel.css';

export default function TTSRuntimePanel() {
  const [status, setStatus] = useState<RuntimeStatusSummary | null>(null);
  const [progress, setProgress] = useState<TTSInstallProgress | null>(null);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState('');

  const loadStatus = useCallback(async () => {
    const next = (await window.electron.runtime.getStatus()) as
      | RuntimeStatusSummary
      | undefined;
    if (next) setStatus(next);
  }, []);

  useEffect(() => {
    loadStatus().catch((reason) => {
      setError(reason instanceof Error ? reason.message : '无法读取 TTS 状态');
    });
  }, [loadStatus]);

  useEffect(
    () =>
      window.electron.runtime.onTTSInstallProgress((rawProgress) => {
        setProgress(rawProgress as TTSInstallProgress);
      }),
    [],
  );

  const install = async () => {
    try {
      setInstalling(true);
      setError('');
      await window.electron.runtime.installTTS();
      await loadStatus();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'TTS 模型安装失败');
    } finally {
      setInstalling(false);
    }
  };

  const runtime = status?.speechSynthesis;
  const percent =
    typeof progress?.receivedBytes === 'number' && progress.totalBytes
      ? Math.round((progress.receivedBytes / progress.totalBytes) * 100)
      : null;

  return (
    <section className="tts-runtime-panel">
      <header>
        <div>
          <span className="model-manager-eyebrow">TTS RUNTIME</span>
          <h2>Kokoro 本地语音</h2>
        </div>
        <span
          className={`tts-runtime-badge${runtime?.runtimeReady ? ' is-ready' : ''}`}
        >
          {runtime?.runtimeReady ? '可播报' : '尚未就绪'}
        </span>
      </header>

      <div className="tts-runtime-grid">
        <span>原生模块</span>
        <strong>{runtime?.packageInstalled ? '已安装' : '未安装'}</strong>
        <span>语音模型</span>
        <strong>{runtime?.modelReady ? runtime.modelName : '未下载'}</strong>
        <span>音色数量</span>
        <strong>{runtime?.speakers.length ?? 0}</strong>
      </div>

      {progress && installing && (
        <p className="tts-runtime-progress">
          {progress.message}
          {percent !== null ? ` · ${percent}%` : ''}
        </p>
      )}
      {error && (
        <p className="tts-runtime-error" role="alert">
          {error}
        </p>
      )}
      {runtime && !runtime.modelReady && (
        <button disabled={installing} onClick={install} type="button">
          {installing ? '正在安装…' : '下载 Kokoro 中英双语模型'}
        </button>
      )}
      {runtime?.runtimeReady && <TTSVoicePreview runtime={runtime} />}
    </section>
  );
}

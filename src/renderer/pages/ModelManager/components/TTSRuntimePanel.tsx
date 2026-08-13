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
      setError(
        reason instanceof Error ? reason.message : '无法读取语音合成状态',
      );
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
      setError(reason instanceof Error ? reason.message : '语音模型安装失败');
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
        <div className="runtime-panel-title">
          <span className="runtime-panel-title__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M5 10v4M9 7v10M13 4v16M17 8v8M21 10v4" />
            </svg>
          </span>
          <div>
            <span>TTS</span>
            <h3>语音播放</h3>
          </div>
        </div>
        <span
          className={`tts-runtime-badge${runtime?.runtimeReady ? ' is-ready' : ''}`}
        >
          {runtime?.runtimeReady ? '可用' : '未就绪'}
        </span>
      </header>

      <strong className="compact-runtime-model">
        {runtime?.modelReady ? runtime.modelName : 'Kokoro 未安装'}
      </strong>
      <div className="compact-runtime-facts" aria-label="语音播放状态">
        <span className={runtime?.packageInstalled ? 'is-ready' : ''}>
          引擎
        </span>
        <span className={runtime?.modelReady ? 'is-ready' : ''}>模型</span>
        <span>{runtime?.speakers.length ?? 0} 个音色</span>
      </div>

      {progress && installing && (
        <div className="runtime-inline-progress" role="status">
          <span>{progress.message}</span>
          <strong>{percent !== null ? `${percent}%` : '…'}</strong>
        </div>
      )}
      {error && (
        <p className="tts-runtime-error" role="alert">
          {error}
        </p>
      )}
      {runtime && !runtime.modelReady && (
        <button disabled={installing} onClick={install} type="button">
          {installing ? '安装中' : '安装 Kokoro'}
        </button>
      )}
      {runtime?.runtimeReady && <TTSVoicePreview runtime={runtime} />}
    </section>
  );
}

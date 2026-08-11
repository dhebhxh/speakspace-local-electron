import { useCallback, useEffect, useState } from 'react';
import { RuntimeStatusSummary } from '../../../../main/runtime/RuntimeStatusService';
import { RuntimeInstallProgress } from '../../../../main/transcription/WhisperRuntimeInstaller';
import './WhisperRuntimePanel.css';

export default function WhisperRuntimePanel(props: { refreshToken: string }) {
  const { refreshToken } = props;
  const [status, setStatus] = useState<RuntimeStatusSummary | null>(null);
  const [progress, setProgress] = useState<RuntimeInstallProgress | null>(null);
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
        error instanceof Error ? error.message : '无法读取 Whisper 运行时状态',
      );
    });
  }, [loadStatus, refreshToken]);

  useEffect(
    () =>
      window.electron.runtime.onInstallProgress((rawProgress) => {
        setProgress(rawProgress as RuntimeInstallProgress);
      }),
    [],
  );

  const installRuntime = async () => {
    setInstalling(true);
    setErrorMessage('');
    try {
      await window.electron.runtime.installWhisper();
      await loadStatus();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Whisper 运行时安装失败',
      );
    } finally {
      setInstalling(false);
    }
  };

  const transcription = status?.transcription;
  const percent =
    progress?.receivedBytes && progress.totalBytes
      ? Math.round((progress.receivedBytes / progress.totalBytes) * 100)
      : null;

  return (
    <section className="whisper-runtime-panel">
      <header>
        <div>
          <span className="model-manager-eyebrow">STT RUNTIME</span>
          <h2>Whisper 本地运行时</h2>
        </div>
        <span
          className={`whisper-runtime-badge${transcription?.ready ? ' is-ready' : ''}`}
        >
          {transcription?.ready ? '可转写' : '尚未就绪'}
        </span>
      </header>

      <div className="whisper-runtime-grid">
        <span>Whisper CLI</span>
        <strong>
          {transcription?.whisperCliPresent ? '已安装' : '未安装'}
        </strong>
        <span>当前 STT 模型</span>
        <strong>{transcription?.activeModelName ?? '未选择'}</strong>
        <span>ffmpeg</span>
        <strong>{transcription?.ffmpegPresent ? '可用' : '未检测到'}</strong>
      </div>

      {!transcription?.ffmpegPresent && (
        <p className="whisper-runtime-hint">
          WebM、MP3 等格式需要系统 ffmpeg；WAV 文件可以直接转写。
        </p>
      )}
      {progress && installing && (
        <p className="whisper-runtime-progress">
          {progress.message}
          {percent !== null ? ` · ${percent}%` : ''}
        </p>
      )}
      {errorMessage && (
        <p className="whisper-runtime-error" role="alert">
          {errorMessage}
        </p>
      )}

      {!transcription?.whisperCliPresent && (
        <button type="button" disabled={installing} onClick={installRuntime}>
          {installing ? '正在安装…' : '安装 Windows Whisper 运行时'}
        </button>
      )}
    </section>
  );
}

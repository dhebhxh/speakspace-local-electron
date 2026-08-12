import { useCallback, useEffect, useState } from 'react';
import { RuntimeStatusSummary } from '../../../../main/runtime/RuntimeStatusService';
import { RuntimeInstallProgress } from '../../../../main/transcription/WhisperRuntimeInstaller';
import { FfmpegInstallProgress } from '../../../../main/runtime/FfmpegInstaller';
import './WhisperRuntimePanel.css';

export default function WhisperRuntimePanel(props: { refreshToken: string }) {
  const { refreshToken } = props;
  const [status, setStatus] = useState<RuntimeStatusSummary | null>(null);
  const [progress, setProgress] = useState<RuntimeInstallProgress | null>(null);
  const [installing, setInstalling] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [ffmpegProgress, setFfmpegProgress] =
    useState<FfmpegInstallProgress | null>(null);
  const [ffmpegInstalling, setFfmpegInstalling] = useState(false);
  const [ffmpegError, setFfmpegError] = useState('');

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

  useEffect(
    () =>
      window.electron.runtime.onFfmpegInstallProgress((rawProgress) => {
        setFfmpegProgress(rawProgress as FfmpegInstallProgress);
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

  const installFfmpeg = async () => {
    setFfmpegInstalling(true);
    setFfmpegError('');
    try {
      await window.electron.runtime.installFfmpeg();
      await loadStatus();
    } catch (error) {
      setFfmpegError(
        error instanceof Error ? error.message : 'ffmpeg 安装失败',
      );
    } finally {
      setFfmpegInstalling(false);
    }
  };

  const transcription = status?.transcription;
  const percent =
    progress?.receivedBytes && progress.totalBytes
      ? Math.round((progress.receivedBytes / progress.totalBytes) * 100)
      : null;
  const ffmpegPercent =
    ffmpegProgress?.receivedBytes && ffmpegProgress.totalBytes
      ? Math.round(
          (ffmpegProgress.receivedBytes / ffmpegProgress.totalBytes) * 100,
        )
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
        <>
          <p className="whisper-runtime-hint">
            WebM、MP3 等格式（含麦克风录音）需要 ffmpeg；WAV 文件可以直接转写。点击下方按钮自动下载安装，无需手动配置。
          </p>
          {ffmpegProgress && ffmpegInstalling && (
            <p className="whisper-runtime-progress">
              {ffmpegProgress.message}
              {ffmpegPercent !== null ? ` · ${ffmpegPercent}%` : ''}
            </p>
          )}
          {ffmpegError && (
            <p className="whisper-runtime-error" role="alert">
              {ffmpegError}
            </p>
          )}
          <button
            type="button"
            disabled={ffmpegInstalling}
            onClick={installFfmpeg}
          >
            {ffmpegInstalling ? '正在安装 ffmpeg…' : '安装 ffmpeg'}
          </button>
        </>
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

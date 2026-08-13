import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { RuntimeStatusSummary } from '../../../../main/runtime/RuntimeStatusService';
import { RuntimeInstallProgress } from '../../../../main/transcription/WhisperRuntimeInstaller';
import { FfmpegInstallProgress } from '../../../../main/runtime/FfmpegInstaller';
import './WhisperRuntimePanel.css';

type RuntimeRowProps = {
  icon: string;
  name: string;
  detail: string;
  ready: boolean;
  status: string;
  action: ReactNode;
};

function RuntimeRow({
  icon,
  name,
  detail,
  ready,
  status,
  action,
}: RuntimeRowProps) {
  return (
    <article className="speech-runtime-row">
      <span className="speech-runtime-row__icon" aria-hidden="true">
        {icon}
      </span>
      <div className="speech-runtime-row__identity">
        <strong>{name}</strong>
        <span title={detail}>{detail}</span>
      </div>
      <span className={`speech-runtime-row__status${ready ? ' is-ready' : ''}`}>
        {status}
      </span>
      {action && <div className="speech-runtime-row__action">{action}</div>}
    </article>
  );
}

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
        error instanceof Error ? error.message : '无法读取语音转写状态',
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
        error instanceof Error ? error.message : 'Whisper 安装失败',
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
        error instanceof Error ? error.message : 'FFmpeg 安装失败',
      );
    } finally {
      setFfmpegInstalling(false);
    }
  };

  const transcription = status?.transcription;
  const parakeet = status?.parakeetTranscription;
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
  const readyCount = [
    Boolean(transcription?.whisperCliPresent),
    Boolean(parakeet?.packageInstalled),
    Boolean(transcription?.ffmpegPresent),
  ].filter(Boolean).length;

  return (
    <section className="whisper-runtime-panel">
      <header className="whisper-runtime-panel__header">
        <div className="runtime-panel-title">
          <span className="runtime-panel-title__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M4 12h2l2-6 3 12 3-9 2 6 2-3h2" />
            </svg>
          </span>
          <div>
            <span>STT</span>
            <h3>语音转写</h3>
          </div>
        </div>
        <span className="runtime-count">{readyCount}/3 就绪</span>
      </header>

      <div className="speech-runtime-list">
        <RuntimeRow
          icon="W"
          name="Whisper"
          detail={transcription?.activeModelName ?? '未选择模型'}
          ready={Boolean(transcription?.whisperCliPresent)}
          status={transcription?.whisperCliPresent ? '可用' : '缺少组件'}
          action={
            !transcription?.whisperCliPresent ? (
              <button
                type="button"
                disabled={installing}
                onClick={installRuntime}
              >
                {installing ? '安装中' : '安装'}
              </button>
            ) : undefined
          }
        />
        <RuntimeRow
          icon="P"
          name="Parakeet"
          detail={parakeet?.activeModelName ?? '未选择模型'}
          ready={Boolean(parakeet?.packageInstalled)}
          status={parakeet?.packageInstalled ? '可用' : '未就绪'}
          action={null}
        />
        <RuntimeRow
          icon="FF"
          name="FFmpeg"
          detail="音频格式转换"
          ready={Boolean(transcription?.ffmpegPresent)}
          status={transcription?.ffmpegPresent ? '可用' : '未安装'}
          action={
            !transcription?.ffmpegPresent ? (
              <button
                type="button"
                disabled={ffmpegInstalling}
                onClick={installFfmpeg}
              >
                {ffmpegInstalling ? '安装中' : '安装'}
              </button>
            ) : undefined
          }
        />
      </div>

      {progress && installing && (
        <div className="runtime-inline-progress" role="status">
          <span>{progress.message}</span>
          <strong>{percent !== null ? `${percent}%` : '…'}</strong>
        </div>
      )}
      {ffmpegProgress && ffmpegInstalling && (
        <div className="runtime-inline-progress" role="status">
          <span>{ffmpegProgress.message}</span>
          <strong>{ffmpegPercent !== null ? `${ffmpegPercent}%` : '…'}</strong>
        </div>
      )}
      {(errorMessage || ffmpegError) && (
        <p className="whisper-runtime-error" role="alert">
          {errorMessage || ffmpegError}
        </p>
      )}
    </section>
  );
}

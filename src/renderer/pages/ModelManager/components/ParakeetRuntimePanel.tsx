import { useCallback, useEffect, useState } from 'react';
import { RuntimeStatusSummary } from '../../../../main/runtime/RuntimeStatusService';
import './WhisperRuntimePanel.css';

/** 展示 Parakeet 原生依赖和当前模型；模型下载仍使用下方统一模型卡片。 */
export default function ParakeetRuntimePanel(props: { refreshToken: string }) {
  const { refreshToken } = props;
  const [status, setStatus] = useState<RuntimeStatusSummary | null>(null);
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
        reason instanceof Error ? reason.message : '无法读取 Parakeet 状态',
      );
    });
  }, [loadStatus, refreshToken]);

  const runtime = status?.parakeetTranscription;
  return (
    <section className="whisper-runtime-panel">
      <header>
        <div>
          <span className="model-manager-eyebrow">STT RUNTIME</span>
          <h2>Parakeet 本地识别</h2>
        </div>
        <span
          className={`whisper-runtime-badge${runtime?.ready ? ' is-ready' : ''}`}
        >
          {runtime?.ready ? '可转写' : '待选择模型'}
        </span>
      </header>
      <div className="whisper-runtime-grid">
        <span>sherpa-onnx-node</span>
        <strong>
          {runtime?.packageInstalled
            ? `已安装 ${runtime.packageVersion ?? ''}`
            : '未安装'}
        </strong>
        <span>当前 Parakeet 模型</span>
        <strong>{runtime?.activeModelName ?? '未选择'}</strong>
        <span>ffmpeg</span>
        <strong>{runtime?.ffmpegPath ? '可用' : '未检测到'}</strong>
      </div>
      <p className="whisper-runtime-hint">
        当前 V2 INT8 模型仅支持英语；在下方 Speech To Text 列表下载并设为当前。
      </p>
      {error && (
        <p className="whisper-runtime-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

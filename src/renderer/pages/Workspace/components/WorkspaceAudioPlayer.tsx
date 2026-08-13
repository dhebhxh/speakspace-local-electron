import { useEffect, useState } from 'react';
import { NoteItem, WorkspaceController } from '../WorkspaceController';

export default function WorkspaceAudioPlayer({
  workspaceId,
  note,
}: {
  workspaceId: number;
  note: NoteItem;
}) {
  const [audioUrl, setAudioUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const controller = new WorkspaceController();

  useEffect(
    () => () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    },
    [audioUrl],
  );

  if (!note.audio_relative_path) {
    return <span className="workspace-content-empty">无录音</span>;
  }

  const loadAudio = async () => {
    try {
      setLoading(true);
      setError('');
      const audio = await controller.getNoteAudio(workspaceId, note.id);
      if (!audio) {
        setError('录音文件不存在或已经移动');
        return;
      }
      const bytes = new Uint8Array(audio.bytes);
      const data = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ) as ArrayBuffer;
      setAudioUrl(
        URL.createObjectURL(new Blob([data], { type: audio.mime_type })),
      );
    } catch (reason) {
      setError(WorkspaceController.getErrorMessage(reason, '读取录音失败'));
    } finally {
      setLoading(false);
    }
  };

  if (audioUrl) {
    return (
      <audio
        className="workspace-audio"
        controls
        preload="metadata"
        src={audioUrl}
      >
        <track kind="captions" />
      </audio>
    );
  }

  // 文件路径又长又没用，平时藏进 title；只有出错时才需要占位说明。
  return (
    <div className="workspace-audio-loader" title={note.audio_relative_path}>
      <button
        className="ws-btn"
        disabled={loading}
        onClick={loadAudio}
        type="button"
      >
        {loading ? '⏳ 读取中' : '▶ 播放录音'}
      </button>
      {error && <small className="workspace-audio-error">{error}</small>}
    </div>
  );
}

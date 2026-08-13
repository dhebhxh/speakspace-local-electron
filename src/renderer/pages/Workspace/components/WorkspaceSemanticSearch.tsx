import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  EmbeddingModelStatus,
  SemanticNoteResult,
} from '../../../../main/semantic/SemanticTypes';
import WorkspaceSemanticController from '../WorkspaceSemanticController';

const controller = new WorkspaceSemanticController();

type Props = {
  query: string;
  workspaceId: number;
  onSelect(noteId: number): void;
};

/** 语义搜索由按钮显式触发，避免用户每输入一个字符就运行本地模型。 */
export default function WorkspaceSemanticSearch({
  query,
  workspaceId,
  onSelect,
}: Props) {
  const [status, setStatus] = useState<EmbeddingModelStatus | null>(null);
  const [results, setResults] = useState<SemanticNoteResult[]>([]);
  const [searchedQuery, setSearchedQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    controller
      .getStatus()
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  const search = async () => {
    const cleanQuery = query.trim();
    if (!cleanQuery) return;
    try {
      setLoading(true);
      setError('');
      setResults(await controller.search(cleanQuery, workspaceId));
      setSearchedQuery(cleanQuery);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '语义搜索失败');
    } finally {
      setLoading(false);
    }
  };

  // 作为工具条的一员渲染：控件与关键词搜索框同一行，结果另起一整行。
  return (
    <>
      <div className="workspace-semantic-control">
        {status?.installed ? (
          <button
            className="ws-btn"
            disabled={!query.trim() || loading}
            onClick={search}
            title="按含义查找相似笔记，不要求出现完全相同的关键词"
            type="button"
          >
            {loading ? '⏳ 建立索引…' : '✨ 语义查找'}
          </button>
        ) : (
          <Link
            className="ws-link"
            title="语义查找需要先安装 bge-m3 嵌入模型"
            to="/ModelManagement"
          >
            安装 bge-m3
          </Link>
        )}
      </div>
      {error && (
        <p className="workspace-semantic-error" role="alert">
          {error}
        </p>
      )}
      {searchedQuery && !error && (
        <div className="workspace-semantic-results">
          <span>
            “{searchedQuery}” · {results.length} 条结果
          </span>
          {results.map((result) => (
            <button
              key={result.id}
              onClick={() => onSelect(result.id)}
              type="button"
            >
              <strong>{result.name}</strong>
              <small>{Math.round(result.score * 100)}% 相似</small>
              <span>{result.transcriptPreview}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

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

  return (
    <section className="workspace-semantic-search">
      <div>
        <strong>相似笔记</strong>
        <span>按含义查找，不要求出现完全相同的关键词。</span>
      </div>
      {status?.installed ? (
        <button
          disabled={!query.trim() || loading}
          onClick={search}
          type="button"
        >
          {loading ? '正在建立索引…' : '语义查找'}
        </button>
      ) : (
        <Link to="/ModelManagement">安装 bge-m3</Link>
      )}
      {error && <p role="alert">{error}</p>}
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
    </section>
  );
}

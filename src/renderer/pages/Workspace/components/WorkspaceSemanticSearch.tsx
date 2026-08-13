import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
      setError(
        reason instanceof Error
          ? reason.message
          : t('workspace.semantic.error'),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="workspace-semantic-search">
      <div>
        <strong>{t('workspace.semantic.title')}</strong>
        <span>{t('workspace.semantic.description')}</span>
      </div>
      {status?.installed ? (
        <button
          disabled={!query.trim() || loading}
          onClick={search}
          type="button"
        >
          {loading
            ? t('workspace.semantic.loading')
            : t('workspace.semantic.search')}
        </button>
      ) : (
        <Link to="/ModelManagement">{t('workspace.semantic.install')}</Link>
      )}
      {error && <p role="alert">{error}</p>}
      {searchedQuery && !error && (
        <div className="workspace-semantic-results">
          <span>
            {t('workspace.semantic.results', {
              query: searchedQuery,
              count: results.length,
            })}
          </span>
          {results.map((result) => (
            <button
              key={result.id}
              onClick={() => onSelect(result.id)}
              type="button"
            >
              <strong>{result.name}</strong>
              <small>
                {t('workspace.semantic.similarity', {
                  score: Math.round(result.score * 100),
                })}
              </small>
              <span>{result.transcriptPreview}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

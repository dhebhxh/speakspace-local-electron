import { useState } from 'react';
import { WorkspaceSuggestion } from './WorkspaceSuggestionController';
import './WorkspaceSuggestionCard.css';

type WorkspaceSuggestionCardProps = {
  suggestion: WorkspaceSuggestion;
  onUseName: (name: string) => void;
  onRename: (workspaceId: number, name: string) => Promise<void>;
};

/** 自动整理建议卡；只在用户确认后填入名称或重命名现有空间。 */
export default function WorkspaceSuggestionCard({
  suggestion,
  onUseName,
  onRename,
}: WorkspaceSuggestionCardProps) {
  const [renaming, setRenaming] = useState(false);
  const [error, setError] = useState('');

  if (!suggestion.shouldSuggest) return null;

  const renameWorkspace = async () => {
    if (!suggestion.targetWorkspaceId) return;
    try {
      setRenaming(true);
      setError('');
      await onRename(suggestion.targetWorkspaceId, suggestion.name);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '整理工作空间失败');
    } finally {
      setRenaming(false);
    }
  };

  return (
    <aside className="workspace-suggestion" aria-label="工作空间整理建议">
      <span className="workspace-suggestion-icon" aria-hidden="true">
        ✦
      </span>
      <div className="workspace-suggestion-copy">
        <span>智能整理建议 · {suggestion.category}</span>
        <strong>{suggestion.name}</strong>
        <small>{error || suggestion.reason}</small>
      </div>
      <div className="workspace-suggestion-actions">
        <button onClick={() => onUseName(suggestion.name)} type="button">
          用于新建
        </button>
        {suggestion.targetWorkspaceId && (
          <button
            className="is-primary"
            disabled={renaming}
            onClick={renameWorkspace}
            type="button"
          >
            {renaming ? '整理中…' : '整理现有空间'}
          </button>
        )}
      </div>
    </aside>
  );
}

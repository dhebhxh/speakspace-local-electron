import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DashboardNoteItem } from '../models/DashboardNoteItem';
import { TodoItem } from '../models/TodoItem';
import {
  DASHBOARD_CATEGORY_FILTERS,
  DashboardCategory,
  DashboardCategoryKey,
} from '../models/DashboardCategory';

/** 一条笔记在列表里显示的待办日期摘要。 */
export type NoteTodoSummary = {
  /** 主显日期：最近一个还没到的，全过期则取最后一个。 */
  primary: string;
  /** 除主显之外还有几个不同日期。 */
  extraCount: number;
  /** 全部日期，挂在 title 上供悬浮查看。 */
  allDates: string[];
  overdue: boolean;
};

/**
 * 按笔记归并待办日期。
 *
 * 重复待办会被展开成很多行（「每天」就是九十多条），
 * 表格里只显示一个代表日期加计数，否则一行塞不下也没法看。
 */
export function summarizeTodosByNote(
  todos: TodoItem[],
  today: string,
): Map<number, NoteTodoSummary> {
  const byNote = new Map<number, Set<string>>();
  todos.forEach((todo) => {
    const noteId = todo.getAssociatedNoteId();
    if (!noteId) return;
    if (!byNote.has(noteId)) byNote.set(noteId, new Set());
    byNote.get(noteId)!.add(todo.getDateString().slice(0, 10));
  });

  const summaries = new Map<number, NoteTodoSummary>();
  byNote.forEach((dateSet, noteId) => {
    const allDates = [...dateSet].sort();
    if (allDates.length === 0) return;
    const upcoming = allDates.find((date) => date >= today);
    const primary = upcoming ?? allDates[allDates.length - 1];
    summaries.set(noteId, {
      primary,
      extraCount: allDates.length - 1,
      allDates,
      overdue: primary < today,
    });
  });
  return summaries;
}

interface NoteListTableProps {
  notes: DashboardNoteItem[];
  /** 用来在列表里显示每条笔记的待办日期。 */
  todos: TodoItem[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedCategory: DashboardCategoryKey | 'all';
  onCategoryChange: (category: DashboardCategoryKey | 'all') => void;
  sortOrder: 'updated' | 'created';
  onSortChange: (order: 'updated' | 'created') => void;
  onTogglePin: (noteId: number, e: React.MouseEvent) => void;
  onSelectNote: (noteId: number) => void;
  onContextMenu?: (noteId: number, e: React.MouseEvent) => void;
  /**
   * 悬停某条「待办日期」时把该笔记的全部日期报上去，供日历闪烁提示；
   * 移开时传 null。
   */
  onHoverTodoDates?: (dates: string[] | null) => void;
}

export const NoteListTable: React.FC<NoteListTableProps> = ({
  notes,
  todos,
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  sortOrder,
  onSortChange,
  onTogglePin,
  onSelectNote,
  onContextMenu,
  onHoverTodoDates = () => {},
}) => {
  const { t } = useTranslation();

  const todoSummaries = useMemo(() => {
    const now = new Date();
    const today = `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, '0')}-${`${now.getDate()}`.padStart(2, '0')}`;
    return summarizeTodosByNote(todos, today);
  }, [todos]);

  const getCategoryBadgeClass = (categoryKey: DashboardCategoryKey) => {
    switch (categoryKey) {
      case 'review':
        return 'badge-blue';
      case 'discussion':
        return 'badge-green';
      case 'brainstorm':
        return 'badge-brass';
      default:
        return 'badge-gray';
    }
  };

  return (
    <section className="note-list-section">
      <div className="table-header-controls">
        <div className="table-title">
          <h3>{t('dashboard.notes.title', { total: notes.length })}</h3>
        </div>

        <div className="table-filters">
          <div className="search-input-wrapper">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder={t('dashboard.notes.search.placeholder')}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="search-input"
            />
            {searchQuery && (
              <button
                className="clear-search"
                aria-label={t('dashboard.notes.search.clear')}
                onClick={() => onSearchChange('')}
                type="button"
              >
                ✕
              </button>
            )}
          </div>

          <div className="filter-dropdown">
            <select
              value={selectedCategory}
              onChange={(e) =>
                onCategoryChange(e.target.value as DashboardCategoryKey | 'all')
              }
              className="custom-select"
            >
              {DASHBOARD_CATEGORY_FILTERS.map((category) => (
                <option key={category} value={category}>
                  {t('dashboard.notes.filter.label', {
                    category: t(DashboardCategory.translationKey(category)),
                  })}
                </option>
              ))}
            </select>
          </div>

          <div className="sort-dropdown">
            <select
              value={sortOrder}
              onChange={(e) =>
                onSortChange(e.target.value as 'updated' | 'created')
              }
              className="custom-select"
            >
              <option value="updated">
                {t('dashboard.notes.sort.updated')}
              </option>
              <option value="created">
                {t('dashboard.notes.sort.created')}
              </option>
            </select>
          </div>
        </div>
      </div>

      <div className="table-responsive">
        <table className="notes-table">
          <thead>
            <tr>
              <th className="th-star">{t('dashboard.notes.column.pinned')}</th>
              <th className="th-title">{t('dashboard.notes.column.title')}</th>
              <th className="th-type">{t('dashboard.notes.column.type')}</th>
              <th className="th-todo">{t('dashboard.notes.column.todo')}</th>
            </tr>
          </thead>
          <tbody>
            {notes.length === 0 ? (
              <tr>
                <td colSpan={4} className="no-data-cell">
                  <div className="empty-table-state">
                    <div className="empty-icon">📂</div>
                    <p>{t('dashboard.notes.empty')}</p>
                  </div>
                </td>
              </tr>
            ) : (
              notes.map((note) => {
                const isPinned = note.isPinned();
                const categoryKey = note.getCategoryKey();
                const noteTodo = todoSummaries.get(note.getId());
                return (
                  <tr
                    key={note.getId()}
                    className={`note-row ${isPinned ? 'pinned-row' : ''}`}
                    onClick={() => onSelectNote(note.getId())}
                    onContextMenu={(e) =>
                      onContextMenu && onContextMenu(note.getId(), e)
                    }
                  >
                    <td
                      className="td-star"
                      onClick={(e) => onTogglePin(note.getId(), e)}
                    >
                      <span
                        className={`star-icon ${isPinned ? 'active' : 'inactive'}`}
                      >
                        {isPinned ? '★' : '☆'}
                      </span>
                    </td>
                    <td className="td-title">
                      <div className="note-title-text">{note.getName()}</div>
                      <div className="note-snippet-text">
                        {note.getTranscript().slice(0, 40)}...
                      </div>
                    </td>
                    <td className="td-type">
                      <span
                        className={`type-badge ${getCategoryBadgeClass(categoryKey)}`}
                      >
                        {t(DashboardCategory.translationKey(categoryKey))}
                      </span>
                    </td>
                    <td
                      className="td-todo"
                      // 悬停整格就联动日历，不必精确压在那颗药丸上
                      onMouseEnter={() =>
                        onHoverTodoDates(noteTodo ? noteTodo.allDates : null)
                      }
                      onMouseLeave={() => onHoverTodoDates(null)}
                    >
                      {noteTodo ? (
                        <span
                          className={`todo-date-pill ${noteTodo.overdue ? 'is-overdue' : ''}`}
                          title={noteTodo.allDates.join('  ')}
                        >
                          🗓 {noteTodo.primary}
                          {noteTodo.extraCount > 0 && (
                            <span className="todo-date-more">
                              +{noteTodo.extraCount}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="todo-date-none">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};

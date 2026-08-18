import React from 'react';
import { useTranslation } from 'react-i18next';
import { DashboardNoteItem } from '../models/DashboardNoteItem';
import {
    DASHBOARD_CATEGORY_FILTERS,
    DashboardCategory,
    DashboardCategoryKey
} from '../models/DashboardCategory';

interface NoteListTableProps {
    notes: DashboardNoteItem[];
    searchQuery: string;
    onSearchChange: (query: string) => void;
    selectedCategory: DashboardCategoryKey | 'all';
    onCategoryChange: (category: DashboardCategoryKey | 'all') => void;
    sortOrder: 'updated' | 'created';
    onSortChange: (order: 'updated' | 'created') => void;
    onTogglePin: (noteId: number, e: React.MouseEvent) => void;
    onSelectNote: (noteId: number) => void;
    onContextMenu?: (noteId: number, e: React.MouseEvent) => void;
}

export const NoteListTable: React.FC<NoteListTableProps> = ({
    notes,
    searchQuery,
    onSearchChange,
    selectedCategory,
    onCategoryChange,
    sortOrder,
    onSortChange,
    onTogglePin,
    onSelectNote,
    onContextMenu
}) => {
    const { t } = useTranslation();

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
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    <div className="filter-dropdown">
                        <select
                            value={selectedCategory}
                            onChange={(e) => onCategoryChange(e.target.value as DashboardCategoryKey | 'all')}
                            className="custom-select"
                        >
                            {DASHBOARD_CATEGORY_FILTERS.map((category) => (
                                <option key={category} value={category}>
                                    {t('dashboard.notes.filter.label', {
                                        category: t(DashboardCategory.translationKey(category))
                                    })}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="sort-dropdown">
                        <select
                            value={sortOrder}
                            onChange={(e) => onSortChange(e.target.value as 'updated' | 'created')}
                            className="custom-select"
                        >
                            <option value="updated">{t('dashboard.notes.sort.updated')}</option>
                            <option value="created">{t('dashboard.notes.sort.created')}</option>
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
                            <th className="th-duration">{t('dashboard.notes.column.duration')}</th>
                            <th className="th-created">{t('dashboard.notes.column.created')}</th>
                            <th className="th-updated">{t('dashboard.notes.column.updated')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {notes.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="no-data-cell">
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
                                const updatedTime = note.getUpdatedTimeDescriptor();
                                return (
                                    <tr
                                        key={note.getId()}
                                        className={`note-row ${isPinned ? 'pinned-row' : ''}`}
                                        onClick={() => onSelectNote(note.getId())}
                                        onContextMenu={(e) => onContextMenu && onContextMenu(note.getId(), e)}
                                    >
                                        <td className="td-star" onClick={(e) => onTogglePin(note.getId(), e)}>
                                            <span className={`star-icon ${isPinned ? 'active' : 'inactive'}`}>
                                                {isPinned ? '★' : '☆'}
                                            </span>
                                        </td>
                                        <td className="td-title">
                                            <div className="note-title-text">{note.getName()}</div>
                                            <div className="note-snippet-text">{note.getTranscript().slice(0, 40)}...</div>
                                        </td>
                                        <td className="td-type">
                                            <span className={`type-badge ${getCategoryBadgeClass(categoryKey)}`}>
                                                {t(DashboardCategory.translationKey(categoryKey))}
                                            </span>
                                        </td>
                                        <td className="td-duration">
                                            <span className="duration-pill">⏱ {note.getFormattedDuration()}</span>
                                        </td>
                                        <td className="td-created">
                                            {note.getFormattedCreatedDate()}
                                        </td>
                                        <td className="td-updated">
                                            <span className="update-highlight">
                                                {updatedTime.labelKey
                                                    ? t(updatedTime.labelKey, { time: updatedTime.time })
                                                    : updatedTime.absoluteText}
                                            </span>
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

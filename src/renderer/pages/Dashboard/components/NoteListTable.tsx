import React from 'react';
import { DashboardNoteItem } from '../models/DashboardNoteItem';

interface NoteListTableProps {
    notes: DashboardNoteItem[];
    searchQuery: string;
    onSearchChange: (query: string) => void;
    selectedCategory: string;
    onCategoryChange: (category: string) => void;
    sortOrder: 'updated' | 'created';
    onSortChange: (order: 'updated' | 'created') => void;
    onTogglePin: (noteId: number, e: React.MouseEvent) => void;
    onSelectNote: (noteId: number) => void;
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
    onSelectNote
}) => {
    const categories = ["全部", "需求評審", "項目討論", "頭腦風暴", "一般筆記"];

    const getCategoryBadgeClass = (category: string) => {
        switch (category) {
            case '需求評審':
            case '需求评审':
                return 'badge-blue';
            case '項目討論':
            case '项目讨论':
                return 'badge-green';
            case '頭腦風暴':
            case '头脑风暴':
                return 'badge-purple';
            default:
                return 'badge-gray';
        }
    };

    return (
        <section className="note-list-section">
            <div className="table-header-controls">
                <div className="table-title">
                    <h3>筆記列表 ({notes.length})</h3>
                </div>
                
                <div className="table-filters">
                    <div className="search-input-wrapper">
                        <span className="search-icon">🔍</span>
                        <input 
                            type="text" 
                            placeholder="搜尋筆記標題、內容或分類..." 
                            value={searchQuery}
                            onChange={(e) => onSearchChange(e.target.value)}
                            className="search-input"
                        />
                        {searchQuery && (
                            <button className="clear-search" onClick={() => onSearchChange('')}>✕</button>
                        )}
                    </div>

                    <div className="filter-dropdown">
                        <select 
                            value={selectedCategory} 
                            onChange={(e) => onCategoryChange(e.target.value)}
                            className="custom-select"
                        >
                            {categories.map((cat) => (
                                <option key={cat} value={cat}>▼ 篩選: {cat}</option>
                            ))}
                        </select>
                    </div>

                    <div className="sort-dropdown">
                        <select 
                            value={sortOrder} 
                            onChange={(e) => onSortChange(e.target.value as 'updated' | 'created')}
                            className="custom-select"
                        >
                            <option value="updated">最新更新</option>
                            <option value="created">建立時間</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="table-responsive">
                <table className="notes-table">
                    <thead>
                        <tr>
                            <th className="th-checkbox"><input type="checkbox" /></th>
                            <th className="th-star">釘選</th>
                            <th className="th-title">筆記標題與概觀</th>
                            <th className="th-type">類型</th>
                            <th className="th-duration">錄音時長</th>
                            <th className="th-created">創建時間</th>
                            <th className="th-updated">最新更新</th>
                        </tr>
                    </thead>
                    <tbody>
                        {notes.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="no-data-cell">
                                    <div className="empty-table-state">
                                        <div className="empty-icon">📂</div>
                                        <p>沒有找到合乎篩選條件的會議或語音筆記紀錄。</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            notes.map((note) => {
                                const isPinned = note.isPinned();
                                return (
                                    <tr 
                                        key={note.getId()} 
                                        className={`note-row ${isPinned ? 'pinned-row' : ''}`}
                                        onClick={() => onSelectNote(note.getId())}
                                    >
                                        <td className="td-checkbox" onClick={(e) => e.stopPropagation()}>
                                            <input type="checkbox" />
                                        </td>
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
                                            <span className={`type-badge ${getCategoryBadgeClass(note.getTypeCategory())}`}>
                                                {note.getTypeCategory()}
                                            </span>
                                        </td>
                                        <td className="td-duration">
                                            <span className="duration-pill">⏱ {note.getFormattedDuration()}</span>
                                        </td>
                                        <td className="td-created">
                                            {note.getFormattedCreatedDate()}
                                        </td>
                                        <td className="td-updated">
                                            <span className="update-highlight">{note.getFormattedUpdatedDate()}</span>
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

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { RouteManager } from '../../router/RouteManager';
import { DashboardNoteItem } from './models/DashboardNoteItem';
import { TodoItem } from './models/TodoItem';
import { DashboardStatistics } from './models/DashboardStatistics';
import { DashboardTimeUtil } from './models/DashboardTimeUtil';
import { HeaderBar } from './components/HeaderBar';
import { MetricCardsGrid } from './components/MetricCardsGrid';
import { CalendarWidget } from './components/CalendarWidget';
import { NoteListTable } from './components/NoteListTable';
import './DashboardPage.css';

// Initial Mock Data initialized via OOP Constructors
const INITIAL_NOTES: DashboardNoteItem[] = [];

const INITIAL_TODOS: TodoItem[] = [];

export const DashboardPage: React.FC = () => {
    const navigate = useNavigate();
    const routeManager = useMemo(() => new RouteManager(navigate), [navigate]);

    const [notes, setNotes] = useState<DashboardNoteItem[]>(INITIAL_NOTES);
    const [todos] = useState<TodoItem[]>(INITIAL_TODOS);

    // Filters and Sorting State
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('全部');
    const [sortOrder, setSortOrder] = useState<'updated' | 'created'>('updated');
    const [isPinnedFilterActive, setIsPinnedFilterActive] = useState(false);
    const [isTodoFilterActive, setIsTodoFilterActive] = useState(false);

    // OOP Calculation Service Instance
    const stats = useMemo(() => {
        return new DashboardStatistics(notes, todos);
    }, [notes, todos]);

    // Handle Pin Toggle using OOP entity cloning and state update
    const handleTogglePin = (noteId: number, e: React.MouseEvent) => {
        e.stopPropagation();
        setNotes(prevNotes => prevNotes.map(n => {
            if (n.getId() === noteId) {
                const updated = new DashboardNoteItem(
                    n.getId(), n.getWorkspaceId(), n.getName(), n.getAudioRelativePath(),
                    n.getTranscript(), !n.isPinned(), !n.isPinned() ? new Date() : null,
                    n.getCreatedAt(), n.getUpdatedAt(), n.getTypeCategory(), n.getDurationSeconds()
                );
                return updated;
            }
            return n;
        }));
    };

    // Filter and Sort Notes cleanly utilizing OOP helper methods on each instance
    const filteredNotes = useMemo(() => {
        return notes.filter(note => {
            const matchesSearch = note.matchesSearch(searchQuery);
            const matchesCategory = selectedCategory === '全部' || note.getTypeCategory() === selectedCategory;
            const matchesPinned = !isPinnedFilterActive || note.isPinned();
            const matchesTodo = !isTodoFilterActive || stats.hasTodoForNote(note.getId());
            return matchesSearch && matchesCategory && matchesPinned && matchesTodo;
        }).sort((a, b) => {
            if (sortOrder === 'updated') {
                return b.getUpdatedAt().getTime() - a.getUpdatedAt().getTime();
            } else {
                return b.getCreatedAt().getTime() - a.getCreatedAt().getTime();
            }
        });
    }, [notes, searchQuery, selectedCategory, isPinnedFilterActive, isTodoFilterActive, sortOrder, stats]);

    const handleSelectNote = (noteId: number) => {
        console.log(`Navigate to note ID: ${noteId}`);
        // Can integrate with React Router navigate inside full app context
    };

    return (
        <div className="dashboard-page-container">
            <HeaderBar
                title="儀表板"
                onCreateNote={() => routeManager.navigateToTranscription()}
                onNavigateSettings={() => routeManager.navigateToSettings()}
            />

            <main className="dashboard-main-content">
                {/* Left Column: Metric Cards + Calendar & ToDos */}
                <aside className="dashboard-left-column">
                    <MetricCardsGrid
                        stats={stats}
                        isPinnedFilterActive={isPinnedFilterActive}
                        onTogglePinnedFilter={() => setIsPinnedFilterActive(!isPinnedFilterActive)}
                        isTodoFilterActive={isTodoFilterActive}
                        onToggleTodoFilter={() => setIsTodoFilterActive(!isTodoFilterActive)}
                    />

                    <CalendarWidget
                        todos={todos}
                        onSelectNote={handleSelectNote}
                    />
                </aside>

                {/* Right Column: Note Table with Search, Filter & Sort */}
                <section className="dashboard-right-column">
                    <NoteListTable
                        notes={filteredNotes}
                        searchQuery={searchQuery}
                        onSearchChange={setSearchQuery}
                        selectedCategory={selectedCategory}
                        onCategoryChange={setSelectedCategory}
                        sortOrder={sortOrder}
                        onSortChange={setSortOrder}
                        onTogglePin={handleTogglePin}
                        onSelectNote={handleSelectNote}
                    />
                </section>
            </main>
        </div>
    );
};

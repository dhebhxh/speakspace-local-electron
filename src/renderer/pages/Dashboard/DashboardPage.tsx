import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TrashActionResult } from '@shared/types/TrashTypes';
import { RouteManager } from '../../router/RouteManager';
import TrashUndoToast from '../../components/TrashUndoToast';
import {
  DashboardCategory,
  DashboardCategoryKey,
} from './models/DashboardCategory';
import { DashboardNoteItem } from './models/DashboardNoteItem';
import { TodoItem } from './models/TodoItem';
import { DashboardStatistics } from './models/DashboardStatistics';
import { HeaderBar } from './components/HeaderBar';
import { MetricCardsGrid } from './components/MetricCardsGrid';
import { CalendarWidget } from './components/CalendarWidget';
import { NoteListTable } from './components/NoteListTable';
import './DashboardPage.css';

// Initial Mock Data initialized via OOP Constructors
const INITIAL_NOTES: DashboardNoteItem[] = [];

const INITIAL_TODOS: TodoItem[] = [];

export const DashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const routeManager = useMemo(() => new RouteManager(navigate), [navigate]);

  const [notes, setNotes] = useState<DashboardNoteItem[]>(INITIAL_NOTES);
  const [todos, setTodos] = useState<TodoItem[]>(INITIAL_TODOS);
  // 悬停笔记列表的「待办日期」时，让日历把这几天闪出来。
  const [highlightedDates, setHighlightedDates] = useState<string[] | null>(
    null,
  );
  const [trashUndo, setTrashUndo] = useState<TrashActionResult | null>(null);
  const [trashError, setTrashError] = useState('');

  const fetchDashboardData = React.useCallback(async () => {
    try {
      const overview = await window.electron.dashboard.getDashboardOverview();
      const fetchedNotes = overview.notes.map(
        (n: any) =>
          new DashboardNoteItem(
            n.id,
            n.workspaceId,
            n.name,
            n.audioRelativePath,
            n.transcript,
            n.isPinned,
            n.pinnedAt,
            n.createdAt,
            n.updatedAt,
            n.typeCategory,
            n.durationSeconds,
          ),
      );
      setNotes(fetchedNotes);

      if (overview.todos) {
        const fetchedTodos = overview.todos.map(
          (todo: any) =>
            new TodoItem(
              todo.id,
              todo.title,
              todo.dateString,
              todo.isCompleted,
              todo.noteId,
              fetchedNotes
                .find((n: DashboardNoteItem) => n.getId() === todo.noteId)
                ?.getName(),
            ),
        );
        setTodos(fetchedTodos);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
  }, []);

  React.useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Filters and Sorting State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<
    DashboardCategoryKey | 'all'
  >('all');
  const [sortOrder, setSortOrder] = useState<'updated' | 'created'>('updated');
  const [isPinnedFilterActive, setIsPinnedFilterActive] = useState(false);
  const [isTodoFilterActive, setIsTodoFilterActive] = useState(false);

  // OOP Calculation Service Instance
  const stats = useMemo(() => {
    return new DashboardStatistics(notes, todos);
  }, [notes, todos]);

  // Handle Pin Toggle using OOP entity cloning and state update
  const handleDeleteNote = async (noteId: number) => {
    try {
      setTrashError('');
      const moved = (await window.electron.trash.moveNote(
        noteId,
      )) as TrashActionResult;
      setNotes((prev) => prev.filter((n) => n.getId() !== noteId));
      setTodos((prev) =>
        prev.filter((todo) => todo.getAssociatedNoteId() !== noteId),
      );
      setTrashUndo(moved);
    } catch (reason) {
      setTrashError(
        reason instanceof Error ? reason.message : t('trash.error.move'),
      );
    }
  };

  const undoDeleteNote = async () => {
    if (!trashUndo) return;
    await window.electron.trash.restore({
      itemType: 'note',
      id: trashUndo.id,
    });
    await fetchDashboardData();
  };

  const handleTogglePin = async (noteId: number, e: React.MouseEvent) => {
    e.stopPropagation();

    const noteToToggle = notes.find((n) => n.getId() === noteId);
    if (!noteToToggle) return;

    const newPinnedState = !noteToToggle.isPinned();

    setNotes((prevNotes) =>
      prevNotes.map((n) => {
        if (n.getId() === noteId) {
          const updated = new DashboardNoteItem(
            n.getId(),
            n.getWorkspaceId(),
            n.getName(),
            n.getAudioRelativePath(),
            n.getTranscript(),
            newPinnedState,
            newPinnedState ? new Date() : null,
            n.getCreatedAt(),
            n.getUpdatedAt(),
            n.getTypeCategory(),
            n.getDurationSeconds(),
          );
          return updated;
        }
        return n;
      }),
    );

    try {
      await window.electron.dashboard.toggleNotePin(noteId, newPinnedState);
    } catch (error) {
      console.error('Failed to toggle pin state on backend:', error);
      // Optionally revert the state here on failure
    }
  };

  // Filter and Sort Notes cleanly utilizing OOP helper methods on each instance
  const filteredNotes = useMemo(() => {
    return notes
      .filter((note) => {
        const categoryKey = note.getCategoryKey();
        const matchesSearch = note.matchesSearch(
          searchQuery,
          t(DashboardCategory.translationKey(categoryKey)),
        );
        const matchesCategory =
          selectedCategory === 'all' || categoryKey === selectedCategory;
        const matchesPinned = !isPinnedFilterActive || note.isPinned();
        const matchesTodo =
          !isTodoFilterActive || stats.hasTodoForNote(note.getId());
        return matchesSearch && matchesCategory && matchesPinned && matchesTodo;
      })
      .sort((a, b) => {
        if (sortOrder === 'updated') {
          return b.getUpdatedAt().getTime() - a.getUpdatedAt().getTime();
        }
        return b.getCreatedAt().getTime() - a.getCreatedAt().getTime();
      });
  }, [
    notes,
    searchQuery,
    selectedCategory,
    isPinnedFilterActive,
    isTodoFilterActive,
    sortOrder,
    stats,
    t,
  ]);

  const handleSelectNote = (noteId: number) => {
    const note = notes.find((n) => n.getId() === noteId);
    if (note && note.getWorkspaceId()) {
      routeManager.navigateToWorkspace(note.getWorkspaceId()!);
    } else {
      routeManager.navigateToTranscription({ state: { noteId } });
    }
  };

  return (
    <div className="dashboard-page-container">
      <HeaderBar onCreateNote={() => routeManager.navigateToTranscription()} />

      <main className="dashboard-main-content">
        {/* Left Column: Metric Cards + Calendar & ToDos */}
        <aside className="dashboard-left-column">
          <MetricCardsGrid
            stats={stats}
            isPinnedFilterActive={isPinnedFilterActive}
            onTogglePinnedFilter={() =>
              setIsPinnedFilterActive(!isPinnedFilterActive)
            }
            isTodoFilterActive={isTodoFilterActive}
            onToggleTodoFilter={() =>
              setIsTodoFilterActive(!isTodoFilterActive)
            }
          />

          <CalendarWidget
            todos={todos}
            onSelectNote={handleSelectNote}
            highlightedDates={highlightedDates}
          />
        </aside>

        {/* Right Column: Note Table with Search, Filter & Sort */}
        <section className="dashboard-right-column">
          <NoteListTable
            notes={filteredNotes}
            todos={todos}
            onHoverTodoDates={setHighlightedDates}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedCategory={selectedCategory}
            onCategoryChange={setSelectedCategory}
            sortOrder={sortOrder}
            onSortChange={setSortOrder}
            onTogglePin={handleTogglePin}
            onSelectNote={handleSelectNote}
            onDelete={handleDeleteNote}
          />
        </section>
      </main>
      {trashError && (
        <p className="dashboard-trash-error" role="alert">
          {trashError}
        </p>
      )}
      {trashUndo && (
        <TrashUndoToast
          dismissLabel={t('trash.action.dismiss')}
          message={t('trash.notice.noteMoved', {
            name: trashUndo.name,
          })}
          onDismiss={() => setTrashUndo(null)}
          onUndo={undoDeleteNote}
          undoLabel={t('trash.action.undo')}
          undoingLabel={t('trash.action.restoring')}
        />
      )}
    </div>
  );
};

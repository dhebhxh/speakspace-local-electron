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
const INITIAL_NOTES: DashboardNoteItem[] = [
    new DashboardNoteItem(
        1, null, "2024-05-20 需求評審會議", "audios/001.wav", 
        "評審新功能需求：用戶權限管理、數據導出功能，確認下週開始進行 UI  prototype 設計與後端結構審核。",
        true, new Date("2024-05-20T10:30:00"), new Date("2024-05-20T10:30:00"), new Date("2024-05-20T10:30:00"),
        "需求評審", 4980 // 1h 23m
    ),
    new DashboardNoteItem(
        2, null, "用戶反饋與需求分析", "audios/002.wav", 
        "整理近期客戶訪談反饋，分析核心需求和痛點，特別注意匯出檔案的速度改善以及批次過濾的效率問題。",
        true, new Date("2024-05-19T14:20:00"), new Date("2024-05-19T14:20:00"), new Date("2024-05-19T16:45:00"),
        "項目討論", 2700 // 45m
    ),
    new DashboardNoteItem(
        3, null, "產品功能頭腦風暴", "audios/003.wav", 
        "圍繞核心功能展開頭腦風暴，收集創意和想法。擬定下一期專案新增 AI 自動結論以及智慧標籤分區等特性。",
        false, null, new Date("2024-05-18T09:15:00"), new Date("2024-05-18T17:30:00"),
        "頭腦風暴", 4200 // 1h 10m
    ),
    new DashboardNoteItem(
        4, null, "項目進度同步會議", "audios/004.wav", 
        "同步當前各模組開發進度，明確下一步里程碑與測試環境部署規劃。後台音訊轉譯伺服器運作平穩。",
        false, null, new Date("2024-05-17T16:00:00"), new Date("2024-05-17T16:30:00"),
        "項目討論", 2100 // 35m
    ),
    new DashboardNoteItem(
        5, null, "Q3 年度行銷規劃會議", "audios/005.wav", 
        "檢視第三季度對外企業客戶試點方案，確保本地端自動化逐字稿生成符合客戶公司資訊安全政策限制。",
        true, new Date("2024-05-15T11:00:00"), new Date("2024-05-15T11:00:00"), new Date("2024-05-22T09:10:00"),
        "項目討論", 5400 // 1h 30m
    ),
    new DashboardNoteItem(
        6, null, "資安稽核與音訊加密探討", "audios/006.wav", 
        "確認 Whisper.cpp 運行於線下隔絕環境下的檔案權限，確認零外泄疑慮並通過初始內部安檢合格測試。",
        false, null, new Date("2024-05-14T14:00:00"), new Date("2024-05-21T15:20:00"),
        "需求評審", 3600 // 1h 00m
    )
];

const INITIAL_TODOS: TodoItem[] = [
    new TodoItem(101, "提交用戶權限管理 UI 架構圖", DashboardTimeUtil.getSystemMonthDayString(20), false, 1, "需求評審會議"),
    new TodoItem(102, "確認數據導出 Excel 效能瓶頸", DashboardTimeUtil.getSystemMonthDayString(20), false, 1, "需求評審會議"),
    new TodoItem(103, "回覆客戶端反饋問卷重點整理", DashboardTimeUtil.getSystemMonthDayString(19), true, 2, "用戶反饋與需求分析"),
    new TodoItem(104, "整理 AI 關鍵字靈感列表", DashboardTimeUtil.getSystemMonthDayString(18), false, 3, "產品功能頭腦風暴"),
    new TodoItem(105, "測試 Electron 開發主程式封裝", DashboardTimeUtil.getSystemMonthDayString(22), false, 4, "項目進度同步會議"),
    new TodoItem(106, "檢視本週本地音訊與會議成果", DashboardTimeUtil.getSystemMonthDayString(DashboardTimeUtil.getCurrentYearMonth().currentDay), false, 5, "Q3 年度行銷規劃會議")
];

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
                onCreateNote={() => alert("點擊：新建語音轉譯筆記流程啟動！")}
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

import React from 'react';
import { DashboardStatistics } from '../models/DashboardStatistics';

interface MetricCardsGridProps {
    stats: DashboardStatistics;
    isPinnedFilterActive: boolean;
    onTogglePinnedFilter: () => void;
    isTodoFilterActive: boolean;
    onToggleTodoFilter: () => void;
}

export const MetricCardsGrid: React.FC<MetricCardsGridProps> = ({
    stats,
    isPinnedFilterActive,
    onTogglePinnedFilter,
    isTodoFilterActive,
    onToggleTodoFilter
}) => {
    return (
        <section className="metric-cards-grid">
            {/* 🔵 Card 1: Total Notes */}
            <div className="metric-card card-blue">
                <div className="card-icon-wrapper icon-blue">
                    📄
                </div>
                <div className="card-content">
                    <div className="card-value">{stats.getTotalNotesCount()}</div>
                    <div className="card-label">筆記總數</div>
                    <div className="card-trend trend-positive">較上週 +2</div>
                </div>
            </div>

            {/* 🟢 Card 2: Pinned Notes (Interactive Filter Shortcut) */}
            <div 
                className={`metric-card card-green interactive-card ${isPinnedFilterActive ? 'active-filter' : ''}`}
                onClick={onTogglePinnedFilter}
                title="點擊切換篩選：僅查看釘選重點筆記"
            >
                <div className="card-icon-wrapper icon-green">
                    📌
                </div>
                <div className="card-content">
                    <div className="card-value">{stats.getPinnedNotesCount()}</div>
                    <div className="card-label">釘選的筆記</div>
                    <div className="card-trend trend-neutral">
                        {isPinnedFilterActive ? '✓ 已開啟重點篩選' : '點擊快速篩選重點'}
                    </div>
                </div>
            </div>

            {/* 🟣 Card 3: Transcribed Total Words (Static Display) */}
            <div className="metric-card card-purple static-card">
                <div className="card-icon-wrapper icon-purple">
                    📝
                </div>
                <div className="card-content">
                    <div className="card-value">{stats.getTotalTranscribedWordCount().toLocaleString()}</div>
                    <div className="card-label">轉錄總字數</div>
                    <div className="card-trend trend-positive">較上週 +8,205</div>
                </div>
            </div>

            {/* 🟠 Card 4: Pending ToDos (Interactive Filter Shortcut) */}
            <div 
                className={`metric-card card-orange interactive-card ${isTodoFilterActive ? 'active-filter-orange' : ''}`}
                onClick={onToggleTodoFilter}
                title="點擊切換篩選：僅查看含待辦事項之筆記"
            >
                <div className="card-icon-wrapper icon-orange">
                    📅
                </div>
                <div className="card-content">
                    <div className="card-value">{stats.getPendingTodosCount()}</div>
                    <div className="card-label">待辦事項</div>
                    <div className="card-trend trend-warning">
                        {isTodoFilterActive ? '✓ 已開啟待辦篩選' : '點擊快速篩選待辦'}
                    </div>
                </div>
            </div>
        </section>
    );
};

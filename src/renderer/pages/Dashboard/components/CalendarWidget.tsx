import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TodoItem } from '../models/TodoItem';
import { DashboardTimeUtil } from '../models/DashboardTimeUtil';

interface CalendarWidgetProps {
    todos: TodoItem[];
    onSelectNote?: (noteId: number) => void;
}

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export const CalendarWidget: React.FC<CalendarWidgetProps> = ({
    todos,
    onSelectNote = () => {}
}) => {
    const { t, i18n } = useTranslation();
    const [activePopoverDate, setActivePopoverDate] = useState<string | null>(null);
    const [popoverPos, setPopoverPos] = useState<React.CSSProperties | null>(null);

    // Dynamically synchronize with computer system time using OOP Time Utility (DRY)
    const { year, month, currentDay } = DashboardTimeUtil.getCurrentYearMonth();
    const { daysInMonth, startDayOfWeek } = DashboardTimeUtil.getMonthCalendarInfo(year, month);

    const weeks = [];
    let currentWeek = [];
    
    // Empty prefix padding for previous month days
    for (let i = 0; i < startDayOfWeek; i++) {
        currentWeek.push(null);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        currentWeek.push(day);
        if (currentWeek.length === 7) {
            weeks.push(currentWeek);
            currentWeek = [];
        }
    }
    if (currentWeek.length > 0) {
        while (currentWeek.length < 7) {
            currentWeek.push(null);
        }
        weeks.push(currentWeek);
    }

    const getDateString = (day: number) => {
        return DashboardTimeUtil.formatYYYYMMDD(year, month, day);
    };

    const getTodosForDate = (dateStr: string) => {
        return todos.filter(todo => todo.isOnDate(dateStr));
    };

    const popoverTodos = activePopoverDate ? getTodosForDate(activePopoverDate) : [];

    return (
        <section className="calendar-widget">
            <div className="calendar-header">
                <h3 className="calendar-title">📅 {t('dashboard.calendar.title')}</h3>
                <div className="calendar-month-badge">
                    {DashboardTimeUtil.formatYearMonthDisplay(year, month, i18n.language)}
                </div>
            </div>

            <div className="calendar-grid-container">
                <div className="calendar-weekdays">
                    {WEEKDAY_KEYS.map((weekdayKey) => (
                        <span key={weekdayKey}>{t(`dashboard.calendar.weekday.${weekdayKey}`)}</span>
                    ))}
                </div>

                <div className="calendar-days">
                    {weeks.map((week, weekIdx) => (
                        <div key={weekIdx} className="calendar-row">
                            {week.map((day, dayIdx) => {
                                if (day === null) {
                                    return <div key={dayIdx} className="calendar-day empty"></div>;
                                }
                                const dateStr = getDateString(day);
                                const dayTodos = getTodosForDate(dateStr);
                                const hasTodos = dayTodos.length > 0;
                                const isToday = day === currentDay;

                                return (
                                    <div
                                        key={dayIdx}
                                        className={`calendar-day ${hasTodos ? 'has-events' : ''} ${isToday ? 'is-today' : ''} ${activePopoverDate === dateStr ? 'selected' : ''}`}
                                        onClick={(e) => {
                                            if (hasTodos) {
                                                if (activePopoverDate === dateStr) {
                                                    setActivePopoverDate(null);
                                                    setPopoverPos(null);
                                                } else {
                                                    setActivePopoverDate(dateStr);
                                                    
                                                    const x = e.clientX;
                                                    const y = e.clientY;
                                                    const pos: React.CSSProperties = {};
                                                    
                                                    // Responsive popover positioning to prevent screen boundary clipping
                                                    if (x + 350 > window.innerWidth) {
                                                        pos.right = window.innerWidth - x + 15;
                                                    } else {
                                                        pos.left = x + 15;
                                                    }
                                                    
                                                    if (y + 200 > window.innerHeight) {
                                                        pos.bottom = window.innerHeight - y + 15;
                                                    } else {
                                                        pos.top = y + 15;
                                                    }
                                                    
                                                    setPopoverPos(pos);
                                                }
                                            } else {
                                                setActivePopoverDate(null);
                                                setPopoverPos(null);
                                            }
                                        }}
                                    >
                                        <span className="day-number">{day}</span>
                                        {hasTodos && (
                                            <div className="indicator-dots">
                                                <span className="dot dot-orange"></span>
                                                {dayTodos.length > 1 && <span className="dot dot-blue"></span>}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>

            {/* Floating Popover Panel */}
            {activePopoverDate && popoverTodos.length > 0 && popoverPos && (
                <div 
                    className="calendar-popover-panel floating-popover"
                    style={popoverPos}
                >
                    <div className="event-list">
                        <div className="event-list-header">
                            <span className="event-date">
                                📌 {t('dashboard.calendar.popover.title', { date: activePopoverDate })}
                            </span>
                            <button className="btn-close-pin" onClick={() => {
                                setActivePopoverDate(null);
                                setPopoverPos(null);
                            }}>
                                ✕ {t('dashboard.calendar.popover.close')}
                            </button>
                        </div>
                        {popoverTodos.map(todo => (
                            <div 
                                key={todo.getId()} 
                                className={`todo-item-card ${todo.isCompleted() ? 'completed' : ''}`}
                                onClick={() => todo.getAssociatedNoteId() && onSelectNote(todo.getAssociatedNoteId()!)}
                            >
                                <span className="todo-checkbox">
                                    {todo.isCompleted() ? '☑' : '☐'}
                                </span>
                                <div className="todo-info">
                                    <div className="todo-title">{todo.getTitle()}</div>
                                    {todo.getNoteTitle() && (
                                        <div className="todo-note-link">
                                            🔗 {t('dashboard.calendar.todo.jump', { title: todo.getNoteTitle() })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </section>
    );
};

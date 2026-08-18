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
  onSelectNote = () => {},
}) => {
  const { t, i18n } = useTranslation();
  const [activePopoverDate, setActivePopoverDate] = useState<string | null>(
    null,
  );
  const [popoverPos, setPopoverPos] = useState<React.CSSProperties | null>(
    null,
  );

  // Base system date for styling "today"
  const {
    year: currentYear,
    month: currentMonth,
    currentDay,
  } = DashboardTimeUtil.getCurrentYearMonth();

  // UI View state
  const [viewYear, setViewYear] = useState<number>(currentYear);
  const [viewMonth, setViewMonth] = useState<number>(currentMonth);

  const { daysInMonth, startDayOfWeek } =
    DashboardTimeUtil.getMonthCalendarInfo(viewYear, viewMonth);

  const handlePrevMonth = () => {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear((v) => v - 1);
    } else {
      setViewMonth((v) => v - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear((v) => v + 1);
    } else {
      setViewMonth((v) => v + 1);
    }
  };

  // 网格单元自带 key：占位格没有日期，用「年-月-第几格」当身份，
  // 换月时年月变化会整片重建，不会出现跨月复用节点。
  type CalendarCell = { key: string; day: number | null };
  const weeks: CalendarCell[][] = [];
  let currentWeek: CalendarCell[] = [];
  let cellIndex = 0;

  const pushCell = (day: number | null) => {
    currentWeek.push({
      key:
        day === null
          ? `${viewYear}-${viewMonth}-pad-${cellIndex}`
          : `${viewYear}-${viewMonth}-${day}`,
      day,
    });
    cellIndex += 1;
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  };

  // Empty prefix padding for previous month days
  for (let i = 0; i < startDayOfWeek; i += 1) {
    pushCell(null);
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    pushCell(day);
  }
  while (currentWeek.length > 0) {
    pushCell(null);
  }

  const getDateString = (day: number) => {
    return DashboardTimeUtil.formatYYYYMMDD(viewYear, viewMonth, day);
  };

  const getTodosForDate = (dateStr: string) => {
    return todos.filter((todo) => todo.isOnDate(dateStr));
  };

  const popoverTodos = activePopoverDate
    ? getTodosForDate(activePopoverDate)
    : [];

  return (
    <section className="calendar-widget">
      <div className="calendar-header">
        <h3 className="calendar-title">📅 {t('dashboard.calendar.title')}</h3>
        <div className="calendar-month-badge">
          <button
            className="calendar-nav-btn"
            onClick={handlePrevMonth}
            type="button"
          >
            &lt;
          </button>
          <span className="calendar-month-text">
            {DashboardTimeUtil.formatYearMonthDisplay(
              viewYear,
              viewMonth,
              i18n.language,
            )}
          </span>
          <button
            className="calendar-nav-btn"
            onClick={handleNextMonth}
            type="button"
          >
            &gt;
          </button>
        </div>
      </div>

      <div className="calendar-grid-container">
        <div className="calendar-weekdays">
          {WEEKDAY_KEYS.map((weekdayKey) => (
            <span key={weekdayKey}>
              {t(`dashboard.calendar.weekday.${weekdayKey}`)}
            </span>
          ))}
        </div>

        <div className="calendar-days">
          {weeks.map((week) => (
            <div key={week[0].key} className="calendar-row">
              {week.map((cell) => {
                const { day } = cell;
                if (day === null) {
                  return <div key={cell.key} className="calendar-day empty" />;
                }
                const dateStr = getDateString(day);
                const dayTodos = getTodosForDate(dateStr);
                const hasTodos = dayTodos.length > 0;
                const isToday =
                  day === currentDay &&
                  viewYear === currentYear &&
                  viewMonth === currentMonth;

                return (
                  <button
                    type="button"
                    key={dateStr}
                    className={`btn-plain calendar-day ${hasTodos ? 'has-events' : ''} ${isToday ? 'is-today' : ''} ${activePopoverDate === dateStr ? 'selected' : ''}`}
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
                        <span className="dot dot-orange" />
                        {dayTodos.length > 1 && (
                          <span className="dot dot-blue" />
                        )}
                      </div>
                    )}
                  </button>
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
                📌{' '}
                {t('dashboard.calendar.popover.title', {
                  date: activePopoverDate,
                })}
              </span>
              <button
                className="btn-close-pin"
                onClick={() => {
                  setActivePopoverDate(null);
                  setPopoverPos(null);
                }}
                type="button"
              >
                ✕
              </button>
            </div>
            {popoverTodos.map((todo) => (
              <button
                type="button"
                key={todo.getId()}
                className={`btn-plain todo-item-card ${todo.isCompleted() ? 'completed' : ''}`}
                onClick={() =>
                  todo.getAssociatedNoteId() &&
                  onSelectNote(todo.getAssociatedNoteId()!)
                }
              >
                <span className="todo-checkbox">
                  {todo.isCompleted() ? '☑' : '☐'}
                </span>
                <div className="todo-info">
                  <div className="todo-title">{todo.getTitle()}</div>
                  {todo.getNoteTitle() && (
                    <div className="todo-note-link">
                      🔗{' '}
                      {t('dashboard.calendar.todo.jump', {
                        title: todo.getNoteTitle(),
                      })}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};

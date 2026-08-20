import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { TodoItem } from '../models/TodoItem';
import { DashboardTimeUtil } from '../models/DashboardTimeUtil';

interface CalendarWidgetProps {
  todos: TodoItem[];
  onSelectNote?: (noteId: number) => void;
  /**
   * 需要闪烁提示的日期（YYYY-MM-DD）。
   * 笔记列表里悬停某条「待办日期」时传进来，用于一眼看出是哪几天。
   */
  highlightedDates?: string[] | null;
}

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export const CalendarWidget: React.FC<CalendarWidgetProps> = ({
  todos,
  onSelectNote = () => {},
  highlightedDates,
}) => {
  const { t, i18n } = useTranslation();
  const [activePopoverDate, setActivePopoverDate] = useState<string | null>(
    null,
  );
  const [popoverPos, setPopoverPos] = useState<React.CSSProperties | null>(
    null,
  );
  // 点击过的日期会「钉住」，移开鼠标也不关，方便慢慢点里面的待办。
  const [pinned, setPinned] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelScheduledClose = useCallback(() => {
    if (closeTimer.current !== null) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const closePopover = useCallback(() => {
    cancelScheduledClose();
    setActivePopoverDate(null);
    setPopoverPos(null);
    setPinned(false);
  }, [cancelScheduledClose]);

  /**
   * 悬浮离开后延迟再关。
   * 从日期格挪到弹窗的路上鼠标会短暂脱离两者，立刻关会让弹窗点不到。
   */
  const scheduleClose = useCallback(() => {
    if (pinned) return;
    cancelScheduledClose();
    closeTimer.current = setTimeout(() => {
      setActivePopoverDate(null);
      setPopoverPos(null);
    }, 220);
  }, [pinned, cancelScheduledClose]);

  /** 以日期格为锚点定位，避免贴边时弹窗被裁掉。 */
  const openPopoverAt = useCallback(
    (dateStr: string, anchor: DOMRect) => {
      cancelScheduledClose();
      setActivePopoverDate(dateStr);

      const pos: React.CSSProperties = {};
      if (anchor.left + 350 > window.innerWidth) {
        pos.right = Math.max(8, window.innerWidth - anchor.left + 8);
      } else {
        pos.left = anchor.right + 8;
      }
      if (anchor.top + 260 > window.innerHeight) {
        pos.bottom = Math.max(8, window.innerHeight - anchor.bottom - 8);
      } else {
        pos.top = anchor.top;
      }
      setPopoverPos(pos);
    },
    [cancelScheduledClose],
  );

  // 组件卸载时别留下定时器
  useEffect(() => cancelScheduledClose, [cancelScheduledClose]);

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

  // 用 Set 查表：一条「每天」的待办能有九十多个日期，逐格 includes 太亏。
  const highlighted = useMemo(
    () => new Set(highlightedDates ?? []),
    [highlightedDates],
  );

  // 高亮的日期可能落在别的月份，这时当月一个都不会闪。
  // 在月份导航上给个提示，免得用户以为功能没生效。
  const highlightOutsideView = useMemo(() => {
    if (highlighted.size === 0) return { before: 0, after: 0 };
    const prefix = `${viewYear}-${`${viewMonth}`.padStart(2, '0')}`;
    let before = 0;
    let after = 0;
    highlighted.forEach((date: string) => {
      if (date.slice(0, 7) < prefix) before += 1;
      if (date.slice(0, 7) > prefix) after += 1;
    });
    return { before, after };
  }, [highlighted, viewYear, viewMonth]);

  return (
    <section className="calendar-widget">
      <div className="calendar-header">
        <h3 className="calendar-title">📅 {t('dashboard.calendar.title')}</h3>
        <div className="calendar-month-badge">
          <button
            className={`calendar-nav-btn ${highlightOutsideView.before > 0 ? 'has-highlight-elsewhere' : ''}`}
            onClick={handlePrevMonth}
            type="button"
            title={
              highlightOutsideView.before > 0
                ? `${highlightOutsideView.before} 个待办日期在更早的月份`
                : undefined
            }
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
            className={`calendar-nav-btn ${highlightOutsideView.after > 0 ? 'has-highlight-elsewhere' : ''}`}
            onClick={handleNextMonth}
            type="button"
            title={
              highlightOutsideView.after > 0
                ? `${highlightOutsideView.after} 个待办日期在更晚的月份`
                : undefined
            }
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
                    className={`btn-plain calendar-day ${hasTodos ? 'has-events' : ''} ${isToday ? 'is-today' : ''} ${activePopoverDate === dateStr ? 'selected' : ''} ${highlighted.has(dateStr) ? 'is-flashing' : ''}`}
                    // 悬浮即展开，不必再点一次
                    onMouseEnter={(e) => {
                      if (!hasTodos) {
                        if (!pinned) closePopover();
                        return;
                      }
                      openPopoverAt(
                        dateStr,
                        e.currentTarget.getBoundingClientRect(),
                      );
                    }}
                    onMouseLeave={scheduleClose}
                    // 键盘 Tab 过来也要能看到，不能只照顾鼠标
                    onFocus={(e) => {
                      if (!hasTodos) return;
                      openPopoverAt(
                        dateStr,
                        e.currentTarget.getBoundingClientRect(),
                      );
                    }}
                    onBlur={scheduleClose}
                    // 点击＝钉住，鼠标移开也不收，方便逐条点待办
                    onClick={(e) => {
                      if (!hasTodos) {
                        closePopover();
                        return;
                      }
                      if (activePopoverDate === dateStr && pinned) {
                        closePopover();
                        return;
                      }
                      openPopoverAt(
                        dateStr,
                        e.currentTarget.getBoundingClientRect(),
                      );
                      setPinned(true);
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
          // 鼠标挪进弹窗就取消关闭，否则里面的待办点不到
          onMouseEnter={cancelScheduledClose}
          onMouseLeave={scheduleClose}
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
                onClick={closePopover}
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
                onClick={() => {
                  const noteId = todo.getAssociatedNoteId();
                  if (!noteId) return;
                  onSelectNote(noteId);
                  // 跳走之后弹窗留着没意义
                  closePopover();
                }}
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

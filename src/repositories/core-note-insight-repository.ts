import { DatabaseManager } from "@/database";
import {
  CoreNoteInsight,
  type CoreActionItem,
  type CoreCalendarIntent,
  type CoreCalendarIntentKind,
  type CoreInsightStatus,
  type CoreTask,
} from "@/domain/core-note-insight/core-note-insight";
import { DatabaseError } from "@/errors/database-error";

type InsightRow = { id: string; note_id: string; summary: string; model_id: string; created_at: string; updated_at: string };
type KeyPointRow = { content: string };
type ActionRow = { id: string; task_id: string | null; position: number; title: string; description: string | null; status: string; starts_at: string | null; due_at: string | null; completed_at: string | null; source_note_id: string; external_system: string | null; external_id: string | null; metadata_json: string };
type TaskRow = { id: string; position: number; title: string; description: string | null; status: string; starts_at: string | null; due_at: string | null; completed_at: string | null; source_note_id: string; external_system: string | null; external_id: string | null; metadata_json: string };
type CalendarRow = { id: string; kind: string; title: string; description: string | null; status: string; starts_at: string | null; ends_at: string | null; due_at: string | null; remind_at: string | null; all_day: number; timezone: string | null; source_note_id: string; external_system: string | null; external_id: string | null; metadata_json: string };

export type CoreDashboardItems = {
  tasks: { id: string; noteId: string; status: CoreInsightStatus }[];
  calendarIntents: CoreCalendarIntent[];
};

export class CoreNoteInsightRepository {
  public constructor(private readonly databaseManager: DatabaseManager) {}

  public async findByNoteId(noteId: string): Promise<CoreNoteInsight | null> {
    try {
      const database = this.databaseManager.getDatabase();
      const row = await database.getFirstAsync<InsightRow>("SELECT * FROM core_note_insights WHERE note_id = ?", noteId);
      if (!row) return null;
      const [keyPoints, taskRows, actionRows, calendarRows] = await Promise.all([
        database.getAllAsync<KeyPointRow>("SELECT content FROM core_note_key_points WHERE insight_id = ? ORDER BY position", row.id),
        database.getAllAsync<TaskRow>("SELECT * FROM core_note_tasks WHERE insight_id = ? ORDER BY position", row.id),
        database.getAllAsync<ActionRow>("SELECT * FROM core_note_action_items WHERE insight_id = ? ORDER BY position", row.id),
        database.getAllAsync<CalendarRow>("SELECT * FROM core_note_calendar_intents WHERE insight_id = ? ORDER BY rowid", row.id),
      ]);
      return new CoreNoteInsight(
        row.id, row.note_id, row.summary, keyPoints.map((item) => item.content),
        taskRows.map((item) => this.mapTask(item, actionRows.filter((action) => action.task_id === item.id))),
        actionRows.filter((item) => item.task_id === null).map((item) => this.mapAction(item)),
        calendarRows.map((item) => this.mapCalendar(item)),
        row.model_id, row.created_at, row.updated_at,
      );
    } catch (error) {
      console.error("[CoreInsights] Unable to load saved insights", { noteId, error });
      throw new DatabaseError("Unable to load core note insights.", { cause: error instanceof Error ? error : undefined });
    }
  }

  public async findDashboardItems(): Promise<CoreDashboardItems> {
    try {
      const database = this.databaseManager.getDatabase();
      const [tasks, calendarRows] = await Promise.all([
        database.getAllAsync<{ id: string; source_note_id: string; status: string }>(
          `SELECT tasks.id, tasks.source_note_id, tasks.status
           FROM core_note_tasks AS tasks
           INNER JOIN core_note_insights AS insights
             ON insights.id = tasks.insight_id
             AND insights.note_id = tasks.source_note_id
           INNER JOIN notes ON notes.id = tasks.source_note_id
           WHERE tasks.status IN ('pending', 'completed', 'cancelled')`,
        ),
        database.getAllAsync<CalendarRow>(
          `SELECT calendar.*
           FROM core_note_calendar_intents AS calendar
           INNER JOIN core_note_insights AS insights
             ON insights.id = calendar.insight_id
             AND insights.note_id = calendar.source_note_id
           INNER JOIN notes ON notes.id = calendar.source_note_id
           ORDER BY calendar.starts_at, calendar.due_at, calendar.remind_at`,
        ),
      ]);

      return {
        tasks: tasks.map((task) => ({
          id: task.id,
          noteId: task.source_note_id,
          status: task.status as CoreInsightStatus,
        })),
        calendarIntents: calendarRows.map((item) => this.mapCalendar(item)),
      };
    } catch (error) {
      throw new DatabaseError("Unable to load dashboard insights.", {
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  public async save(insight: CoreNoteInsight): Promise<void> {
    try {
      await this.databaseManager.getDatabase().withExclusiveTransactionAsync(async (database) => {
        const existing = await database.getFirstAsync<{ id: string }>("SELECT id FROM core_note_insights WHERE note_id = ?", insight.getNoteId());
        if (existing) await database.runAsync("DELETE FROM core_note_insights WHERE id = ?", existing.id);
        await database.runAsync(
          "INSERT INTO core_note_insights (id, note_id, summary, model_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
          insight.getId(), insight.getNoteId(), insight.getSummary(), insight.getModelId(), insight.getCreatedAt(), insight.getUpdatedAt(),
        );
        for (const [position, keyPoint] of insight.getKeyPoints().entries()) {
          await database.runAsync("INSERT INTO core_note_key_points (id, insight_id, position, content) VALUES (?, ?, ?, ?)", `${insight.getId()}-key-${position}`, insight.getId(), position, keyPoint);
        }
        for (const [position, task] of insight.getTasks().entries()) {
          await database.runAsync(
            `INSERT INTO core_note_tasks (id, insight_id, position, title, description, status, starts_at, due_at, completed_at, source_note_id, external_system, external_id, metadata_json)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            task.id, insight.getId(), position, task.title, task.description, task.status, task.startsAt, task.dueAt, task.completedAt, task.sourceNoteId, task.externalSystem, task.externalId, JSON.stringify(task.metadata),
          );
        }
        for (const item of insight.getActionItems()) {
          await database.runAsync(
            `INSERT INTO core_note_action_items (id, insight_id, task_id, position, title, description, status, starts_at, due_at, completed_at, source_note_id, external_system, external_id, metadata_json)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            item.id, insight.getId(), item.taskId, item.position, item.title, item.description, item.status, item.startsAt, item.dueAt, item.completedAt, item.sourceNoteId, item.externalSystem, item.externalId, JSON.stringify(item.metadata),
          );
        }
        for (const item of insight.getCalendarIntents()) {
          await database.runAsync(
            `INSERT INTO core_note_calendar_intents (id, insight_id, kind, title, description, status, starts_at, ends_at, due_at, remind_at, all_day, timezone, source_note_id, external_system, external_id, metadata_json)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            item.id, insight.getId(), item.kind, item.title, item.description, item.status, item.startsAt, item.endsAt, item.dueAt, item.remindAt, item.allDay ? 1 : 0, item.timezone, item.sourceNoteId, item.externalSystem, item.externalId, JSON.stringify(item.metadata),
          );
        }
      });
    } catch (error) {
      console.error("[CoreInsights] Unable to persist insights", { noteId: insight.getNoteId(), error });
      throw new DatabaseError("Unable to save core note insights.", { cause: error instanceof Error ? error : undefined });
    }
  }

  public async setTaskCompleted(noteId: string, taskId: string, completed: boolean): Promise<void> {
    await this.setItemCompleted(noteId, taskId, completed);
  }

  private async setItemCompleted(
    noteId: string,
    itemId: string,
    completed: boolean,
  ): Promise<void> {
    try {
      await this.databaseManager.getDatabase().withExclusiveTransactionAsync(async (database) => {
        const now = new Date().toISOString();
        const result = await database.runAsync(
          `UPDATE core_note_tasks
           SET status = ?, completed_at = ?
           WHERE id = ? AND source_note_id = ?`,
          completed ? "completed" : "pending",
          completed ? now : null,
          itemId,
          noteId,
        );
        if (result.changes === 0) throw new Error("Core insight item not found.");
        await database.runAsync(
          "UPDATE core_note_insights SET updated_at = ? WHERE note_id = ?",
          now,
          noteId,
        );
      });
    } catch (error) {
      throw new DatabaseError("Unable to update the core insight item.", {
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  private mapAction(row: ActionRow): CoreActionItem {
    return { id: row.id, taskId: row.task_id, position: row.position, title: row.title, description: row.description, status: row.status as CoreInsightStatus, startsAt: row.starts_at, dueAt: row.due_at, completedAt: row.completed_at, sourceNoteId: row.source_note_id, externalSystem: row.external_system, externalId: row.external_id, metadata: this.parseMetadata(row.metadata_json) };
  }

  private mapTask(row: TaskRow, actions: ActionRow[]): CoreTask {
    return { id: row.id, title: row.title, description: row.description, status: row.status as CoreInsightStatus, startsAt: row.starts_at, dueAt: row.due_at, completedAt: row.completed_at, sourceNoteId: row.source_note_id, externalSystem: row.external_system, externalId: row.external_id, metadata: this.parseMetadata(row.metadata_json), actionItems: actions.map((item) => this.mapAction(item)) };
  }

  private mapCalendar(row: CalendarRow): CoreCalendarIntent {
    return { id: row.id, kind: row.kind as CoreCalendarIntentKind, title: row.title, description: row.description, status: row.status as CoreInsightStatus, startsAt: row.starts_at, endsAt: row.ends_at, dueAt: row.due_at, remindAt: row.remind_at, allDay: row.all_day === 1, timezone: row.timezone, sourceNoteId: row.source_note_id, externalSystem: row.external_system, externalId: row.external_id, metadata: this.parseMetadata(row.metadata_json) };
  }

  private parseMetadata(value: string): Record<string, unknown> {
    try { const parsed = JSON.parse(value) as unknown; return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}; } catch { return {}; }
  }
}

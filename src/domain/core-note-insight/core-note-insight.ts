export type CoreInsightStatus = "pending" | "completed" | "cancelled";

export type CoreActionItem = {
  id: string;
  title: string;
  description: string | null;
  status: CoreInsightStatus;
  startsAt: string | null;
  dueAt: string | null;
  completedAt: string | null;
  sourceNoteId: string;
  externalSystem: string | null;
  externalId: string | null;
  metadata: Record<string, unknown>;
};

export type CoreCalendarIntentKind = "reminder" | "calendar";

export type CoreCalendarIntent = {
  id: string;
  kind: CoreCalendarIntentKind;
  title: string;
  description: string | null;
  status: CoreInsightStatus;
  startsAt: string | null;
  endsAt: string | null;
  dueAt: string | null;
  remindAt: string | null;
  allDay: boolean;
  timezone: string | null;
  sourceNoteId: string;
  externalSystem: string | null;
  externalId: string | null;
  metadata: Record<string, unknown>;
};

export class CoreNoteInsight {
  public constructor(
    private readonly id: string,
    private readonly noteId: string,
    private readonly summary: string,
    private readonly keyPoints: string[],
    private readonly actionItems: CoreActionItem[],
    private readonly calendarIntents: CoreCalendarIntent[],
    private readonly modelId: string,
    private readonly createdAt: string,
    private readonly updatedAt: string,
  ) {}

  public getId(): string { return this.id; }
  public getNoteId(): string { return this.noteId; }
  public getSummary(): string { return this.summary; }
  public getKeyPoints(): readonly string[] { return this.keyPoints; }
  public getActionItems(): readonly CoreActionItem[] { return this.actionItems; }
  public getCalendarIntents(): readonly CoreCalendarIntent[] { return this.calendarIntents; }
  public getModelId(): string { return this.modelId; }
  public getCreatedAt(): string { return this.createdAt; }
  public getUpdatedAt(): string { return this.updatedAt; }
}

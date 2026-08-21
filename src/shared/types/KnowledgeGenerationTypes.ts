export const KNOWLEDGE_SCENARIOS = [
  'meeting',
  'lecture',
  'consultation',
  'interview',
  'brainstorm',
  'general',
] as const;
export type KnowledgeScenario = (typeof KNOWLEDGE_SCENARIOS)[number];
export type GenerationStatus =
  | 'idle'
  | 'queued'
  | 'generating'
  | 'completed'
  | 'failed';
export type GenerationState = {
  status: GenerationStatus;
  requestId?: string;
  scenario?: KnowledgeScenario;
  startedAt?: number;
  finishedAt?: number;
  message?: string;
};
export type InsightItem = {
  id: string;
  title: string;
  description: string | null;
  status: 'pending' | 'completed' | 'cancelled';
  startsAt: string | null;
  dueAt: string | null;
  completedAt: string | null;
  sourceNoteId: number;
  externalSystem: string | null;
  externalId: string | null;
  metadata: Record<string, unknown>;
};
export type InsightTask = InsightItem & { actionItems: InsightItem[] };
export type CalendarIntent = InsightItem & {
  kind: 'reminder' | 'calendar';
  endsAt: string | null;
  remindAt: string | null;
  allDay: boolean;
  timezone: string | null;
};
export type StructuredNote = {
  noteId: number;
  summary: string;
  keyPoints: string[];
  tasks: InsightTask[];
  unassignedActionItems: InsightItem[];
  calendarIntents: CalendarIntent[];
  modelId: string;
  createdAt: string;
  updatedAt: string;
};
export type KnowledgeSection = { key: string; title: string; items: string[] };
export type ScenarioKnowledge = {
  noteId: number;
  scenario: KnowledgeScenario;
  sections: KnowledgeSection[];
  modelId: string;
  createdAt: string;
  updatedAt: string;
};
export type NoteKnowledgeBundle = {
  structuredNote: StructuredNote | null;
  scenario: ScenarioKnowledge | null;
  structuredNoteState: GenerationState;
  scenarioState: GenerationState;
};

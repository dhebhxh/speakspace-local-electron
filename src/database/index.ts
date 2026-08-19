import type { SQLiteDatabase } from "expo-sqlite";

import { DatabaseConfig } from "./config/database-config";
import { DatabaseManager } from "./core/database-manager";
import { MigrationRunner } from "./core/migration-runner";
import { InitialSchemaMigration } from "./migrations/initial-schema-migration";
import { LlmModelSchemaMigration } from "./migrations/llm-model-schema-migration";
import { SttModelSchemaMigration } from "./migrations/stt-model-schema-migration";
import { KnowledgeDocumentSchemaMigration } from "./migrations/knowledge-document-schema-migration";
import { KnowledgeDocumentSchemaRepairMigration } from "./migrations/knowledge-document-schema-repair-migration";
import { CoreNoteInsightSchemaMigration } from "./migrations/core-note-insight-schema-migration";
import { CoreNoteTaskHierarchyMigration } from "./migrations/core-note-task-hierarchy-migration";

export { DatabaseConfig } from "./config/database-config";
export { DatabaseManager } from "./core/database-manager";
export { Migration } from "./core/migration";
export { MigrationRunner } from "./core/migration-runner";
export { InitialSchemaMigration } from "./migrations/initial-schema-migration";
export { LlmModelSchemaMigration } from "./migrations/llm-model-schema-migration";
export { SttModelSchemaMigration } from "./migrations/stt-model-schema-migration";
export { KnowledgeDocumentSchemaMigration } from "./migrations/knowledge-document-schema-migration";
export { KnowledgeDocumentSchemaRepairMigration } from "./migrations/knowledge-document-schema-repair-migration";
export { CoreNoteInsightSchemaMigration } from "./migrations/core-note-insight-schema-migration";
export { CoreNoteTaskHierarchyMigration } from "./migrations/core-note-task-hierarchy-migration";
export { Repository } from "./repositories/repository";
export type { DatabaseConnection } from "./types/database-types";

export const databaseConfig = new DatabaseConfig("speakspace.db", 7);

export const migrationRunner = new MigrationRunner([
  new InitialSchemaMigration(),
  new SttModelSchemaMigration(),
  new LlmModelSchemaMigration(),
  new KnowledgeDocumentSchemaMigration(),
  new KnowledgeDocumentSchemaRepairMigration(),
  new CoreNoteInsightSchemaMigration(),
  new CoreNoteTaskHierarchyMigration(),
]);

export const databaseManager = new DatabaseManager(
  databaseConfig,
  migrationRunner,
);

export async function initializeDatabase(
  database: SQLiteDatabase,
): Promise<void> {
  await databaseManager.initialize(database);
}

import type { SQLiteDatabase } from "expo-sqlite";

import { DatabaseConfig } from "./config/database-config";
import { DatabaseManager } from "./core/database-manager";
import { MigrationRunner } from "./core/migration-runner";
import { InitialSchemaMigration } from "./migrations/initial-schema-migration";

export { DatabaseConfig } from "./config/database-config";
export { DatabaseManager } from "./core/database-manager";
export { Migration } from "./core/migration";
export { MigrationRunner } from "./core/migration-runner";
export { InitialSchemaMigration } from "./migrations/initial-schema-migration";
export { Repository } from "./repositories/repository";
export type { DatabaseConnection } from "./types/database-types";

export const databaseConfig = new DatabaseConfig("speakspace.db", 1);

export const migrationRunner = new MigrationRunner([
  new InitialSchemaMigration(),
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

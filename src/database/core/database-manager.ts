import type { SQLiteDatabase } from "expo-sqlite";

import { DatabaseConfig } from "../config/database-config";
import { MigrationRunner } from "./migration-runner";

export class DatabaseManager {
  private database: SQLiteDatabase | null = null;

  public constructor(
    private readonly config: DatabaseConfig,
    private readonly migrationRunner: MigrationRunner,
  ) {}

  public async initialize(database: SQLiteDatabase): Promise<void> {
    if (this.database === database) {
      return;
    }

    if (this.database !== null) {
      throw new Error("DatabaseManager has already been initialized.");
    }

    await database.execAsync(
      "PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;",
    );
    await this.migrationRunner.run(database);
    this.database = database;
  }

  public getDatabase(): SQLiteDatabase {
    if (this.database === null) {
      throw new Error(
        `Database ${this.config.databaseName} has not been initialized.`,
      );
    }

    return this.database;
  }

  public isInitialized(): boolean {
    return this.database !== null;
  }
}

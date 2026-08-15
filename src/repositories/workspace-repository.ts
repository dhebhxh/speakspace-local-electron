import { DatabaseManager } from "@/database";
import { Workspace } from "@/domain/workspace/workspace";
import { DatabaseError } from "@/errors/database-error";

type WorkspaceRow = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export class WorkspaceRepository {
  public constructor(private readonly databaseManager: DatabaseManager) {}

  public async findAll(): Promise<Workspace[]> {
    try {
      const rows = await this.databaseManager
        .getDatabase()
        .getAllAsync<WorkspaceRow>(
          "SELECT id, name, created_at, updated_at FROM workspaces ORDER BY updated_at DESC",
        );

      return rows.map((row) => this.mapRowToEntity(row));
    } catch (error) {
      throw this.toDatabaseError("Unable to load workspaces.", error);
    }
  }

  public async findById(id: string): Promise<Workspace | null> {
    try {
      const row = await this.databaseManager
        .getDatabase()
        .getFirstAsync<WorkspaceRow>(
          "SELECT id, name, created_at, updated_at FROM workspaces WHERE id = ?",
          id,
        );

      return row ? this.mapRowToEntity(row) : null;
    } catch (error) {
      throw this.toDatabaseError("Unable to load the workspace.", error);
    }
  }

  public async create(workspace: Workspace): Promise<void> {
    try {
      await this.databaseManager
        .getDatabase()
        .runAsync(
          "INSERT INTO workspaces (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)",
          workspace.getId(),
          workspace.getName(),
          workspace.getCreatedAt(),
          workspace.getUpdatedAt(),
        );
    } catch (error) {
      throw this.toDatabaseError("Unable to create the workspace.", error);
    }
  }

  public async update(workspace: Workspace): Promise<void> {
    try {
      await this.databaseManager
        .getDatabase()
        .runAsync(
          "UPDATE workspaces SET name = ?, updated_at = ? WHERE id = ?",
          workspace.getName(),
          workspace.getUpdatedAt(),
          workspace.getId(),
        );
    } catch (error) {
      throw this.toDatabaseError("Unable to update the workspace.", error);
    }
  }

  public async delete(id: string): Promise<void> {
    try {
      await this.databaseManager
        .getDatabase()
        .runAsync("DELETE FROM workspaces WHERE id = ?", id);
    } catch (error) {
      throw this.toDatabaseError("Unable to delete the workspace.", error);
    }
  }

  private mapRowToEntity(row: WorkspaceRow): Workspace {
    return new Workspace(row.id, row.name, row.created_at, row.updated_at);
  }

  private toDatabaseError(message: string, error: unknown): DatabaseError {
    return new DatabaseError(message, {
      cause: error instanceof Error ? error : undefined,
    });
  }
}

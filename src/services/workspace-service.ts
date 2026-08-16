import { Workspace } from "@/domain/workspace/workspace";
import { ValidationError } from "@/errors/validation-error";
import { WorkspaceNotFoundError } from "@/errors/workspace-not-found-error";
import { WorkspaceRepository } from "@/repositories/workspace-repository";

export class WorkspaceService {
  private static readonly defaultWorkspaceId = "workspace-default";
  public constructor(
    private readonly workspaceRepository: WorkspaceRepository,
  ) {}

  public async getWorkspaces(): Promise<Workspace[]> {
    return this.workspaceRepository.findAll();
  }

  public async getWorkspace(id: string): Promise<Workspace | null> {
    return this.workspaceRepository.findById(id);
  }

  public async createWorkspace(name: string): Promise<Workspace> {
    const normalizedName = this.normalizeName(name);
    const now = new Date().toISOString();
    const workspace = new Workspace(this.createId(), normalizedName, now, now);

    await this.workspaceRepository.create(workspace);
    return workspace;
  }

  public async getOrCreateDefaultWorkspace(): Promise<Workspace> {
    const existing = await this.workspaceRepository.findById(
      WorkspaceService.defaultWorkspaceId,
    );
    if (existing !== null) {
      return existing;
    }

    const now = new Date().toISOString();
    const workspace = new Workspace(
      WorkspaceService.defaultWorkspaceId,
      "My Workspace",
      now,
      now,
    );
    await this.workspaceRepository.create(workspace);
    return workspace;
  }

  public async renameWorkspace(id: string, name: string): Promise<void> {
    const workspace = await this.getWorkspaceOrThrow(id);
    workspace.rename(this.normalizeName(name));
    await this.workspaceRepository.update(workspace);
  }

  public async deleteWorkspace(id: string): Promise<void> {
    await this.getWorkspaceOrThrow(id);
    await this.workspaceRepository.delete(id);
  }

  private async getWorkspaceOrThrow(id: string): Promise<Workspace> {
    const workspace = await this.workspaceRepository.findById(id);

    if (workspace === null) {
      throw new WorkspaceNotFoundError(id);
    }

    return workspace;
  }

  private normalizeName(name: string): string {
    const normalizedName = name.trim();

    if (normalizedName.length === 0) {
      throw new ValidationError("Workspace name cannot be empty.");
    }

    return normalizedName;
  }

  private createId(): string {
    return `workspace-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

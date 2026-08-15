export class Workspace {
  private readonly id: string;
  private name: string;
  private readonly createdAt: string;
  private updatedAt: string;

  public constructor(
    id: string,
    name: string,
    createdAt: string,
    updatedAt: string,
  ) {
    this.id = id;
    this.name = name;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  public getId(): string {
    return this.id;
  }

  public getName(): string {
    return this.name;
  }

  public getCreatedAt(): string {
    return this.createdAt;
  }

  public getUpdatedAt(): string {
    return this.updatedAt;
  }

  public rename(name: string): void {
    this.name = name;
    this.updatedAt = new Date().toISOString();
  }
}

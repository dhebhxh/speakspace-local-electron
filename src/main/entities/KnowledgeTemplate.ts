import { Entity } from "./Entity";


export class KnowledgeTemplate extends Entity {

    private name: string;
    private prompt: string;
    private createdAt: Date;
    private updatedAt: Date;

    public constructor(
        id: number,
        name: string,
        prompt: string,
        createdAt: Date,
        updatedAt: Date
    ) {
        super(id);

        this.name = name;
        this.prompt = prompt;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public getName(): string {
        return this.name;
    }

    public setName(name: string): void {
        this.name = name;
    }

    public getPrompt(): string {
        return this.prompt;
    }

    public setPrompt(prompt: string): void {
        this.prompt = prompt;
    }

    public getCreatedAt(): Date {
        return this.createdAt;
    }

    public getUpdatedAt(): Date {
        return this.updatedAt;
    }

    public setUpdatedAt(updatedAt: Date): void {
        this.updatedAt = updatedAt;
    }
}
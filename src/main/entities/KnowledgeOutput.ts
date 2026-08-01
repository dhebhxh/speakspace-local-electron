import { Entity } from "./Entity";


export class KnowledgeOutput extends Entity {

    private noteId: string;
    private templateId: string;
    private contentType: string;
    private content: string;
    private createdAt: Date;
    private updatedAt: Date;

    public constructor(
        id: string,
        noteId: string,
        templateId: string,
        contentType: string,
        content: string,
        createdAt: Date,
        updatedAt: Date
    ) {
        super(id);

        this.noteId = noteId;
        this.templateId = templateId;
        this.contentType = contentType;
        this.content = content;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public getNoteId(): string {
        return this.noteId;
    }

    public setNoteId(noteId: string): void {
        this.noteId = noteId;
    }

    public getTemplateId(): string {
        return this.templateId;
    }

    public setTemplateId(templateId: string): void {
        this.templateId = templateId;
    }

    public getContentType(): string {
        return this.contentType;
    }

    public setContentType(contentType: string): void {
        this.contentType = contentType;
    }

    public getContent(): string {
        return this.content;
    }

    public updateContent(content: string): void {
        this.content = content;
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
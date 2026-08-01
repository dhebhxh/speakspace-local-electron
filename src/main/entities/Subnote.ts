import { Entity } from "./Entity";


export class Subnote extends Entity {

    private noteId: string;
    private contentType: string;
    private content: string;
    private createdAt: Date;

    public constructor(
        id: string,
        noteId: string,
        contentType: string,
        content: string,
        createdAt: Date
    ) {
        super(id);

        this.noteId = noteId;
        this.contentType = contentType;
        this.content = content;
        this.createdAt = createdAt;
    }

    public getNoteId(): string {
        return this.noteId;
    }

    public setNoteId(noteId: string): void {
        this.noteId = noteId;
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

    public setContent(content: string): void {
        this.content = content;
    }

    public getCreatedAt(): Date {
        return this.createdAt;
    }
}
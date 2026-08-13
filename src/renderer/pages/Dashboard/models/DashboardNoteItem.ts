import { Note } from "../../../../main/entities/Note";
import { DashboardTimeUtil } from "./DashboardTimeUtil";

export class DashboardNoteItem extends Note {
    private typeCategory: string;
    private durationSeconds: number;

    public constructor(
        id: number,
        workspaceId: number | null,
        name: string | null,
        audioRelativePath: string | null,
        transcript: string,
        pinned: boolean,
        pinnedAt: Date | null,
        createdAt: Date,
        updatedAt: Date,
        typeCategory: string = "需求評審",
        durationSeconds: number = 3600
    ) {
        super(id, workspaceId, name, audioRelativePath, transcript, pinned, pinnedAt, createdAt, updatedAt);
        this.typeCategory = typeCategory;
        this.durationSeconds = durationSeconds;
    }

    public getTypeCategory(): string {
        return this.typeCategory;
    }

    public getDurationSeconds(): number {
        return this.durationSeconds;
    }

    public getFormattedDuration(): string {
        return DashboardTimeUtil.formatDuration(this.durationSeconds);
    }

    public getFormattedCreatedDate(): string {
        return DashboardTimeUtil.formatDateTime(this.getCreatedAt());
    }

    public getFormattedUpdatedDate(): string {
        return DashboardTimeUtil.formatRelativeUpdatedTime(this.getUpdatedAt());
    }

    public matchesSearch(query: string): boolean {
        if (!query || query.trim() === "") return true;
        const q = query.toLowerCase();
        const titleMatch = this.getName() ? this.getName()!.toLowerCase().includes(q) : false;
        const transcriptMatch = this.getTranscript() ? this.getTranscript().toLowerCase().includes(q) : false;
        const typeMatch = this.typeCategory.toLowerCase().includes(q);
        return titleMatch || transcriptMatch || typeMatch;
    }
}

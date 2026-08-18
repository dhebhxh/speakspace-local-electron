import { Note } from '../../../../main/entities/Note';
import { DashboardCategory, DashboardCategoryKey } from './DashboardCategory';
import { DashboardTimeUtil, RelativeUpdatedTime } from './DashboardTimeUtil';

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
    typeCategory: string = '',
    durationSeconds: number = 3600,
  ) {
    super(
      id,
      workspaceId,
      name,
      audioRelativePath,
      transcript,
      pinned,
      pinnedAt,
      createdAt,
      updatedAt,
    );
    this.typeCategory = typeCategory;
    this.durationSeconds = durationSeconds;
  }

  public getTypeCategory(): string {
    return this.typeCategory;
  }

  /** 语言无关的分类 key，用于筛选与文案渲染。 */
  public getCategoryKey(): DashboardCategoryKey {
    return DashboardCategory.resolveKey(this.typeCategory);
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

  public getUpdatedTimeDescriptor(): RelativeUpdatedTime {
    return DashboardTimeUtil.describeRelativeUpdatedTime(this.getUpdatedAt());
  }

  /**
   * categoryLabel 传入当前界面语言下的分类文案，让搜索匹配用户实际看到的文字。
   */
  public matchesSearch(
    query: string,
    categoryLabel: string = this.typeCategory,
  ): boolean {
    if (!query || query.trim() === '') return true;
    const q = query.toLowerCase();
    const titleMatch = this.getName()
      ? this.getName()!.toLowerCase().includes(q)
      : false;
    const transcriptMatch = this.getTranscript()
      ? this.getTranscript().toLowerCase().includes(q)
      : false;
    const typeMatch = categoryLabel.toLowerCase().includes(q);
    return titleMatch || transcriptMatch || typeMatch;
  }
}

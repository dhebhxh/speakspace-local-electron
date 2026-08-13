/**
 * 笔记类型分类以语言无关的 key 存在于界面逻辑中，显示文案交给 i18n，
 * 避免筛选行为随界面语言（简体 / 繁体 / 英文）漂移。
 */
export type DashboardCategoryKey =
    | 'review'
    | 'discussion'
    | 'brainstorm'
    | 'general'
    | 'uncategorized';

export const DASHBOARD_CATEGORY_FILTERS: Array<DashboardCategoryKey | 'all'> = [
    'all',
    'review',
    'discussion',
    'brainstorm',
    'general',
    'uncategorized'
];

/** 历史数据里同一分类可能是简体或繁体写法，这里统一归一到 key。 */
const RAW_CATEGORY_TO_KEY: Record<string, DashboardCategoryKey> = {
    '需求评审': 'review',
    '需求評審': 'review',
    '项目讨论': 'discussion',
    '項目討論': 'discussion',
    '头脑风暴': 'brainstorm',
    '頭腦風暴': 'brainstorm',
    '一般笔记': 'general',
    '一般筆記': 'general',
    '未分类': 'uncategorized',
    '未分類': 'uncategorized'
};

export class DashboardCategory {
    public static resolveKey(rawCategory: string): DashboardCategoryKey {
        return RAW_CATEGORY_TO_KEY[rawCategory.trim()] ?? 'uncategorized';
    }

    public static translationKey(category: DashboardCategoryKey | 'all'): string {
        return `dashboard.category.${category}`;
    }
}

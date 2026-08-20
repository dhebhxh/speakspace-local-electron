export type TrashItemType = 'note' | 'workspace';

export type TrashFilter = 'all' | TrashItemType;

export type TrashActionTarget = {
  itemType: TrashItemType;
  id: number;
};

export type TrashListQuery = {
  search?: string;
  filter?: TrashFilter;
  page?: number;
  pageSize?: number;
};

export type TrashedNoteItem = {
  itemType: 'note';
  id: number;
  name: string;
  trashedAt: string;
  originalWorkspaceId: number;
  originalWorkspaceName: string;
  preview: string;
};

export type TrashedWorkspaceItem = {
  itemType: 'workspace';
  id: number;
  name: string;
  trashedAt: string;
  noteCount: number;
  matchedContainedNote: boolean;
};

export type TrashItem = TrashedNoteItem | TrashedWorkspaceItem;

export type TrashListResult = {
  items: TrashItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type TrashActionResult = {
  itemType: TrashItemType;
  id: number;
  name: string;
  workspaceId: number | null;
  noteCount: number;
};

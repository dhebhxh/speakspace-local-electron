import React from 'react';
import '@testing-library/jest-dom';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WorkspacePage from './WorkspacePage';
import useWorkspaceDetail from './useWorkspaceDetail';
import { NoteItem, WorkspaceItem } from './WorkspaceController';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockedNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockedNavigate,
}));

jest.mock('./useWorkspaceDetail', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('./components/WorkspaceDetailHeader', () => ({
  __esModule: true,
  // 真实顶栏把工具条渲染在元信息那一行，这里照样把它渲染出来，
  // 否则搜索和批量操作的用例根本看不到那些按钮。
  default: ({
    onDelete,
    toolbar,
  }: {
    onDelete: () => void;
    toolbar?: React.ReactNode;
  }) => (
    <div className="workspace-detail-topbar">
      <button data-testid="workspace-header" onClick={onDelete} type="button">
        Open delete confirmation
      </button>
      <div className="workspace-detail-tools">{toolbar}</div>
    </div>
  ),
}));

jest.mock('./components/WorkspaceSemanticSearch', () => ({
  __esModule: true,
  default: () => <div data-testid="semantic-search" />,
}));

jest.mock('./components/WorkspaceNoteCard', () => ({
  __esModule: true,
  default: ({ note }: { note: NoteItem }) => (
    <div data-testid="workspace-note">{note.name}</div>
  ),
}));

const mockedUseWorkspaceDetail = jest.mocked(useWorkspaceDetail);

const workspace: WorkspaceItem = {
  id: 1,
  name: 'Test workspace',
  created_at: '2026-08-16T00:00:00.000Z',
  updated_at: '2026-08-16T00:00:00.000Z',
  last_opened_at: '2026-08-16T00:00:00.000Z',
  recent_at: '2026-08-16T00:00:00.000Z',
  note_count: 0,
  pinned_count: 0,
};

const note: NoteItem = {
  id: 10,
  name: 'Existing note',
  audio_relative_path: null,
  transcript: 'Transcript',
  is_pinned: 0,
  created_at: '2026-08-16T00:00:00.000Z',
  updated_at: '2026-08-16T00:00:00.000Z',
  subnotes: [],
  knowledge_outputs: [],
  conversations: [],
};

function createDetail(
  visibleNotes: NoteItem[],
  selectedNoteIds: number[] = [],
): ReturnType<typeof useWorkspaceDetail> {
  return {
    workspaceId: workspace.id,
    workspace,
    templates: [],
    loading: false,
    error: '',
    status: '',
    query: '',
    setQuery: jest.fn(),
    generatingNoteId: null,
    selectedNoteIds,
    toggleNoteSelection: jest.fn(),
    setSelectedNoteIds: jest.fn(),
    generateOutput: jest.fn(),
    renameWorkspace: jest.fn(),
    moveWorkspaceToTrash: jest.fn(),
    moveNoteToTrash: jest.fn(),
    reloadNotes: jest.fn(),
    revealNote: jest.fn(),
    visibleNotes,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <WorkspacePage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mockedNavigate.mockClear();
});

describe('WorkspacePage', () => {
  it('renders an empty workspace using the detail hook note contract', () => {
    mockedUseWorkspaceDetail.mockReturnValue(createDetail([]));

    renderPage();

    expect(screen.getByText('workspace.detail.empty')).toBeInTheDocument();
  });

  it('renders existing notes using the detail hook note contract', () => {
    mockedUseWorkspaceDetail.mockReturnValue(createDetail([note]));

    renderPage();

    expect(screen.getByTestId('workspace-note')).toHaveTextContent(
      'Existing note',
    );
  });

  it('笔记问答按钮和批量删除同在顶栏工具条里，且都带计数', () => {
    mockedUseWorkspaceDetail.mockReturnValue(createDetail([note], [note.id]));

    const { container } = renderPage();
    const toolbar = container.querySelector('.workspace-detail-tools')!;

    expect(
      within(toolbar as HTMLElement).getByText(/workspace.detail.noteChat/),
    ).toHaveTextContent('(1)');
    expect(
      within(toolbar as HTMLElement).getByText(/workspace.detail.batchDelete/),
    ).toHaveTextContent('(1)');
    // 「已选中 N 篇笔记」那一行已经不存在
    expect(container.querySelector('.workspace-select-bar')).toBeNull();
  });

  it('点笔记问答就带着选中的笔记跳到对话工作台', () => {
    const second = { ...note, id: 11, name: 'Second note' };
    mockedUseWorkspaceDetail.mockReturnValue(
      createDetail([note, second], [note.id, second.id]),
    );

    renderPage();
    fireEvent.click(screen.getByText(/workspace.detail.noteChat/));

    expect(mockedNavigate).toHaveBeenCalledWith('/', {
      state: { askNoteIds: [note.id, second.id] },
    });
  });

  it('批量删除按钮只在勾选之后出现', () => {
    mockedUseWorkspaceDetail.mockReturnValue(createDetail([note]));
    const { unmount } = renderPage();

    expect(
      screen.queryByText(/workspace.detail.batchDelete/),
    ).not.toBeInTheDocument();
    unmount();

    mockedUseWorkspaceDetail.mockReturnValue(createDetail([note], [note.id]));
    renderPage();

    expect(
      screen.getByText(/workspace.detail.batchDelete/),
    ).toBeInTheDocument();
  });

  it('点批量删除先弹确认框，不直接删', () => {
    const detail = createDetail([note], [note.id]);
    mockedUseWorkspaceDetail.mockReturnValue(detail);

    renderPage();
    fireEvent.click(screen.getByText(/workspace.detail.batchDelete/));

    expect(screen.getByRole('dialog')).toHaveClass('workspace-confirm-modal');
    expect(detail.moveNoteToTrash).not.toHaveBeenCalled();
  });

  it('确认之后才把选中的笔记逐条移入回收站', async () => {
    const second = { ...note, id: 11, name: 'Second note' };
    const detail = createDetail([note, second], [note.id, second.id]);
    mockedUseWorkspaceDetail.mockReturnValue(detail);

    renderPage();
    fireEvent.click(screen.getByText(/workspace.detail.batchDelete/));
    // 弹窗标题和确认按钮文案相同，按角色取按钮
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'workspace.detail.batchDelete',
      }),
    );

    await waitFor(() =>
      expect(detail.moveNoteToTrash).toHaveBeenCalledTimes(2),
    );
    expect(detail.moveNoteToTrash).toHaveBeenNthCalledWith(1, note.id);
    expect(detail.moveNoteToTrash).toHaveBeenNthCalledWith(2, second.id);
  });

  it('取消就什么都不删', () => {
    const detail = createDetail([note], [note.id]);
    mockedUseWorkspaceDetail.mockReturnValue(detail);

    renderPage();
    fireEvent.click(screen.getByText(/workspace.detail.batchDelete/));
    fireEvent.click(screen.getByText('common.cancel'));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(detail.moveNoteToTrash).not.toHaveBeenCalled();
  });

  it('uses a content-sized dialog for workspace deletion confirmation', () => {
    mockedUseWorkspaceDetail.mockReturnValue(createDetail([]));

    renderPage();
    fireEvent.click(screen.getByTestId('workspace-header'));

    expect(screen.getByRole('dialog')).toHaveClass('workspace-confirm-modal');
  });
});

describe('两个容器的版式', () => {
  it('笔记装在自己的滚动容器里，和顶栏是并列的两块', () => {
    mockedUseWorkspaceDetail.mockReturnValue(createDetail([note]));

    const { container } = renderPage();
    const page = container.querySelector('.workspace-detail-page')!;
    const body = page.querySelector('.workspace-detail-body')!;

    // 笔记在 body 里，不在顶栏里
    expect(body.querySelector('.workspace-detail-notes')).not.toBeNull();
    expect(
      page.querySelector('.workspace-detail-topbar .workspace-detail-notes'),
    ).toBeNull();
    // 两块是页面的直接子元素，谁也不套着谁
    expect(body.parentElement).toBe(page);
  });

  it('空状态和提示也放在滚动容器里，不会挤在顶栏上', () => {
    mockedUseWorkspaceDetail.mockReturnValue(createDetail([]));

    const { container } = renderPage();
    const body = container.querySelector('.workspace-detail-body')!;

    expect(body.querySelector('.workspace-detail-empty')).not.toBeNull();
  });
});

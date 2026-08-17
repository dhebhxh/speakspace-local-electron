import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WorkspacePage from './WorkspacePage';
import useWorkspaceDetail from './useWorkspaceDetail';
import { NoteItem, WorkspaceItem } from './WorkspaceController';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('./useWorkspaceDetail', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('./components/WorkspaceDetailHeader', () => ({
  __esModule: true,
  default: () => <div data-testid="workspace-header" />,
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

jest.mock('./components/WorkspaceMultiNoteModal', () => ({
  __esModule: true,
  default: () => <div data-testid="multi-note-modal" />,
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
    selectedNoteIds: [],
    toggleNoteSelection: jest.fn(),
    setSelectedNoteIds: jest.fn(),
    generateOutput: jest.fn(),
    renameWorkspace: jest.fn(),
    deleteWorkspace: jest.fn(),
    deleteNote: jest.fn(),
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
});

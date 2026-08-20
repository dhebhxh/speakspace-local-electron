import Database from 'better-sqlite3';
import TrashService from '../TrashService';

const FIRST_TIME = '2026-08-19T10:00:00.000Z';
const SECOND_TIME = '2026-08-19T11:00:00.000Z';

function createDatabase(): Database.Database {
  const database = new Database(':memory:');
  database.pragma('foreign_keys = ON');
  database.exec(`
    CREATE TABLE workspaces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      last_opened_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      trashed_at TEXT
    );
    CREATE TABLE notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL,
      name TEXT,
      audio_relative_path TEXT,
      transcript TEXT NOT NULL,
      is_pinned INTEGER NOT NULL DEFAULT 0,
      pinned_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      trashed_at TEXT,
      FOREIGN KEY(workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    );
    CREATE TABLE subnotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_id INTEGER NOT NULL,
      content_type TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(note_id) REFERENCES notes(id) ON DELETE CASCADE
    );
    CREATE TABLE todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      date_string TEXT NOT NULL,
      is_completed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(note_id) REFERENCES notes(id) ON DELETE CASCADE
    );
    CREATE TABLE ai_conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE ai_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE
    );
    CREATE TABLE conversation_contexts (
      conversation_id INTEGER NOT NULL,
      note_id INTEGER NOT NULL,
      PRIMARY KEY(conversation_id, note_id),
      FOREIGN KEY(conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE,
      FOREIGN KEY(note_id) REFERENCES notes(id) ON DELETE CASCADE
    );
  `);
  return database;
}

function insertWorkspace(database: Database.Database, name: string): number {
  return Number(
    database
      .prepare(
        `INSERT INTO workspaces (name, created_at, updated_at)
        VALUES (?, ?, ?)`,
      )
      .run(name, FIRST_TIME, SECOND_TIME).lastInsertRowid,
  );
}

function insertNote(
  database: Database.Database,
  workspaceId: number,
  name: string,
  transcript: string,
  audioRelativePath: string | null = null,
): number {
  return Number(
    database
      .prepare(
        `INSERT INTO notes (
          workspace_id, name, audio_relative_path, transcript, is_pinned,
          pinned_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 1, ?, ?, ?)`,
      )
      .run(
        workspaceId,
        name,
        audioRelativePath,
        transcript,
        FIRST_TIME,
        FIRST_TIME,
        SECOND_TIME,
      ).lastInsertRowid,
  );
}

/** Jest normally runs under Node while this repo installs the Electron ABI. */
function nativeDatabaseMatchesRuntime(): boolean {
  try {
    const probe = new Database(':memory:');
    probe.close();
    return true;
  } catch {
    return false;
  }
}

const describeWithNativeDatabase = nativeDatabaseMatchesRuntime()
  ? describe
  : describe.skip;

describeWithNativeDatabase('TrashService', () => {
  let database: Database.Database;
  let discardRecording: jest.Mock;
  let service: TrashService;

  beforeEach(() => {
    database = createDatabase();
    discardRecording = jest.fn(() => ({ deleted: true, reason: 'deleted' }));
    service = new TrashService({
      database,
      recordingStorage: { discardRecording },
    });
  });

  afterEach(() => database.close());

  it('moves and restores the same note without changing its content state', () => {
    const workspaceId = insertWorkspace(database, 'Research');
    const noteId = insertNote(database, workspaceId, 'Interview', 'Keep me');

    service.moveNote(noteId);
    const trashed = service.list({ filter: 'note' });
    expect(trashed.total).toBe(1);
    expect(trashed.items[0]).toMatchObject({
      itemType: 'note',
      id: noteId,
      originalWorkspaceId: workspaceId,
    });

    service.restore({ itemType: 'note', id: noteId });
    const row = database
      .prepare(
        `SELECT trashed_at, is_pinned, pinned_at, created_at, updated_at
        FROM notes WHERE id = ?`,
      )
      .get(noteId) as Record<string, unknown>;
    expect(row).toEqual({
      trashed_at: null,
      is_pinned: 1,
      pinned_at: FIRST_TIME,
      created_at: FIRST_TIME,
      updated_at: SECOND_TIME,
    });
  });

  it('absorbs previously trashed notes into one workspace item', () => {
    const workspaceId = insertWorkspace(database, 'August');
    const firstNoteId = insertNote(
      database,
      workspaceId,
      'Earlier removal',
      'first',
    );
    insertNote(database, workspaceId, 'Still active', 'second');

    service.moveNote(firstNoteId);
    expect(service.count()).toBe(1);
    service.moveWorkspace(workspaceId);

    const result = service.list({ filter: 'all' });
    expect(result.total).toBe(1);
    expect(result.items).toEqual([
      expect.objectContaining({
        itemType: 'workspace',
        id: workspaceId,
        noteCount: 2,
      }),
    ]);

    service.restore({ itemType: 'workspace', id: workspaceId });
    const activeNotes = database
      .prepare(
        `SELECT COUNT(*) AS count FROM notes
        WHERE workspace_id = ? AND trashed_at IS NULL`,
      )
      .get(workspaceId) as { count: number };
    expect(activeNotes.count).toBe(2);
  });

  it('returns a workspace when the search matches a contained note', () => {
    const workspaceId = insertWorkspace(database, 'General');
    insertNote(
      database,
      workspaceId,
      'Meeting arranged at nine',
      'tomorrow morning',
    );
    service.moveWorkspace(workspaceId);

    const result = service.list({ search: 'arranged', filter: 'all' });
    expect(result.items).toEqual([
      expect.objectContaining({
        itemType: 'workspace',
        id: workspaceId,
        matchedContainedNote: true,
      }),
    ]);
  });

  it('permanently deletes note attachments but preserves its conversation', () => {
    const workspaceId = insertWorkspace(database, 'Calls');
    const noteId = insertNote(
      database,
      workspaceId,
      'Client call',
      'transcript',
      'recordings/call.wav',
    );
    const conversationId = Number(
      database
        .prepare(
          `INSERT INTO ai_conversations (name, created_at, updated_at)
          VALUES (?, ?, ?)`,
        )
        .run('Follow-up', FIRST_TIME, SECOND_TIME).lastInsertRowid,
    );
    database
      .prepare(
        `INSERT INTO ai_messages (conversation_id, role, content, created_at)
        VALUES (?, 'assistant', 'Saved answer', ?)`,
      )
      .run(conversationId, FIRST_TIME);
    database
      .prepare(
        `INSERT INTO conversation_contexts (conversation_id, note_id)
        VALUES (?, ?)`,
      )
      .run(conversationId, noteId);
    database
      .prepare(
        `INSERT INTO subnotes (note_id, content_type, content, created_at)
        VALUES (?, 'summary', 'Attached', ?)`,
      )
      .run(noteId, FIRST_TIME);
    database
      .prepare(
        `INSERT INTO todos (
          note_id, title, date_string, is_completed, created_at, updated_at
        ) VALUES (?, 'Follow up', 'tomorrow', 0, ?, ?)`,
      )
      .run(noteId, FIRST_TIME, SECOND_TIME);

    service.moveNote(noteId);
    service.permanentlyDelete({ itemType: 'note', id: noteId });

    expect(
      database.prepare('SELECT 1 FROM notes WHERE id = ?').get(noteId),
    ).toBeUndefined();
    expect(
      database
        .prepare('SELECT content FROM ai_messages WHERE conversation_id = ?')
        .get(conversationId),
    ).toEqual({ content: 'Saved answer' });
    expect(
      database
        .prepare(
          'SELECT 1 FROM conversation_contexts WHERE conversation_id = ?',
        )
        .get(conversationId),
    ).toBeUndefined();
    expect(discardRecording).toHaveBeenCalledWith('recordings/call.wav');
  });

  it('permanently deletes a workspace and its Notes but preserves conversations', () => {
    const workspaceId = insertWorkspace(database, 'Finished project');
    const firstNoteId = insertNote(
      database,
      workspaceId,
      'First call',
      'first transcript',
      'recordings/first.wav',
    );
    insertNote(
      database,
      workspaceId,
      'Second call',
      'second transcript',
      'recordings/second.wav',
    );
    const conversationId = Number(
      database
        .prepare(
          `INSERT INTO ai_conversations (name, created_at, updated_at)
          VALUES (?, ?, ?)`,
        )
        .run('Project follow-up', FIRST_TIME, SECOND_TIME).lastInsertRowid,
    );
    database
      .prepare(
        `INSERT INTO ai_messages (conversation_id, role, content, created_at)
        VALUES (?, 'assistant', 'Retain this answer', ?)`,
      )
      .run(conversationId, FIRST_TIME);
    database
      .prepare(
        `INSERT INTO conversation_contexts (conversation_id, note_id)
        VALUES (?, ?)`,
      )
      .run(conversationId, firstNoteId);

    service.moveWorkspace(workspaceId);
    service.permanentlyDelete({ itemType: 'workspace', id: workspaceId });

    expect(
      database
        .prepare('SELECT 1 FROM workspaces WHERE id = ?')
        .get(workspaceId),
    ).toBeUndefined();
    expect(
      database
        .prepare('SELECT COUNT(*) AS count FROM notes WHERE workspace_id = ?')
        .get(workspaceId),
    ).toEqual({ count: 0 });
    expect(
      database
        .prepare('SELECT content FROM ai_messages WHERE conversation_id = ?')
        .get(conversationId),
    ).toEqual({ content: 'Retain this answer' });
    expect(
      database
        .prepare(
          'SELECT 1 FROM conversation_contexts WHERE conversation_id = ?',
        )
        .get(conversationId),
    ).toBeUndefined();
    expect(discardRecording).toHaveBeenCalledTimes(2);
    expect(discardRecording).toHaveBeenCalledWith('recordings/first.wav');
    expect(discardRecording).toHaveBeenCalledWith('recordings/second.wav');
  });

  it('rejects irreversible deletion of an active item', () => {
    const workspaceId = insertWorkspace(database, 'Protected');
    const noteId = insertNote(database, workspaceId, 'Active', 'safe');

    expect(() =>
      service.permanentlyDelete({ itemType: 'note', id: noteId }),
    ).toThrow('Note not found in Trash');
    expect(
      database.prepare('SELECT 1 FROM notes WHERE id = ?').get(noteId),
    ).toBeDefined();
  });
});

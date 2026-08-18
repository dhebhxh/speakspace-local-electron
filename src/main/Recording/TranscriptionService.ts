import { BrowserWindow } from 'electron';
import { STTModelManager } from '../AI-module/STTModelManager';
import { BlobStorage } from '../database/BlobStorage';
import { DatabaseManager } from '../database/DatabaseManager';
import { NoteRepository } from '../database/repositories/NoteRepository';

const whisperFactory = require('whisper.cpp');

export class TranscriptionService {
  private count: number;

  private audioChunks: Blob[];

  private textChunks: string[];

  private ctx: any;

  private mainWindow: BrowserWindow;

  public constructor() {
    this.count = 0;
    this.audioChunks = [];
    this.textChunks = [];
    this.ctx = null;
    this.mainWindow = BrowserWindow.getAllWindows()[0];
  }

  public async initialize(): Promise<void> {
    const sttManager = new STTModelManager();
    const activeModel = sttManager.getActivatedModel();
    if (!activeModel) {
      console.error('No active model found.');
      return;
    }
    const modelPath = sttManager.getActivatedModelPath();
    if (!modelPath) {
      console.error('No active model path found.');
      return;
    }
    this.ctx = await whisperFactory.init(modelPath);
  }

  public async handleChunk(chunk: Blob): Promise<void> {
    if (!this.ctx) {
      throw new Error('Transcription service has not been initialized.');
    }

    const id = this.count;
    this.audioChunks[id] = chunk;
    this.count++;

    const text = await this.ctx.transcribe(chunk);
    this.textChunks[id] = text;

    this.mainWindow.webContents.send('Transcription:onText', id, text);
  }

  public async save(title: string): Promise<void> {
    let transcript = '';

    for (let i = 0; i < this.textChunks.length; i++) {
      transcript += this.textChunks[i];
    }

    const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });

    const fileName = `${Date.now()}.webm`;
    const relativePath = `audio/${fileName}`;
    const blobStorage = BlobStorage.getInstance();
    await blobStorage.save(relativePath, audioBlob);

    const noteRepository = new NoteRepository();
    const workspace = DatabaseManager.getInstance()
      .getDatabase()
      .prepare('SELECT id FROM workspaces ORDER BY id ASC LIMIT 1')
      .get() as { id: number } | undefined;

    if (!workspace) {
      throw new Error('No workspace is available to save the recording.');
    }

    const { Note } = require('../database/entities/Note');

    noteRepository.create(
      new Note(
        0,
        workspace.id,
        title,
        relativePath,
        transcript,
        false,
        null,
        new Date(),
        new Date(),
      ),
    );
  }

  public stop(): void {
    this.ctx?.free();
    this.ctx = null;
  }
}

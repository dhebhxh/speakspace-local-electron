import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { NoteRepository } from '../database/repositories/NoteRepository';
import { TodoRepository } from '../database/repositories/TodoRepository';
import LocalChatService from '../llm/LocalChatService';
import OllamaEmbeddingService from '../semantic/OllamaEmbeddingService';
import { rankBySimilarity } from '../semantic/EmbeddingMath';

export class TodoExtractionService {
  private noteRepository: NoteRepository;

  private todoRepository: TodoRepository;

  private chatService: LocalChatService;

  private embeddingService: OllamaEmbeddingService;

  constructor() {
    this.noteRepository = new NoteRepository();
    this.todoRepository = new TodoRepository();
    this.chatService = new LocalChatService();
    this.embeddingService = new OllamaEmbeddingService();
  }

  private static chunkText(text: string, size = 500, overlap = 100): string[] {
    const chunks: string[] = [];
    let i = 0;
    while (i < text.length) {
      chunks.push(text.slice(i, i + size));
      i += size - overlap;
    }
    return chunks;
  }

  public async extractTodosForNote(noteId: number): Promise<boolean> {
    try {
      const note = this.noteRepository.findById(noteId);
      if (!note) {
        console.error(`Note ${noteId} not found for extraction.`);
        return false;
      }

      const transcript = note.getTranscript();
      if (!transcript || transcript.trim().length === 0) {
        console.warn(`Note ${noteId} has no transcript.`);
        return false;
      }

      let contextText = transcript;
      const logFile = path.join(
        app.getPath('userData'),
        'speakspace_extraction.log',
      );
      
      const isDebugMode = process.env.SPEAKSPACE_DEBUG_AI_LOGS === 'true';
      const log = (msg: string, debugOnly: boolean = false) => {
        if (debugOnly && !isDebugMode) return;
        try {
          fs.appendFileSync(logFile, msg);
        } catch (e) {
          // ignore log errors
        }
      };

      log(`\n\n[${new Date().toISOString()}] Starting extraction for note ${noteId} (length: ${transcript.length})\n`);

      // Apply RAG if transcript is long
      if (transcript.length > 1500) {
        log(`Applying RAG for long transcript...\n`);
        try {
          const status = await this.embeddingService.getStatus();
          if (status.installed) {
            const chunks = TodoExtractionService.chunkText(
              transcript,
              500,
              100,
            );
            const query =
              'action items, tasks, to-dos, assignments, deadlines, reminders, 待办事项, 任务, 行动项';
            const [queryVector] = await this.embeddingService.embedMany([
              query,
            ]);

            const chunkVectors = await this.embeddingService.embedMany(chunks);
            const items = chunks.map((text, idx) => ({
              text,
              embedding: chunkVectors[idx],
            }));

            const topChunks = rankBySimilarity(queryVector, items, 5, 0.1);
            if (topChunks.length > 0) {
              contextText = topChunks.map((c) => c.text).join('\n...\n');
              log(`RAG selected ${topChunks.length} chunks. Reduced context to ${contextText.length} chars.\n`);
            }
          } else {
            log(`Embedding model not installed. Falling back to full transcript.\n`);
          }
        } catch (err) {
          log(`RAG failed (${err}). Falling back to full transcript.\n`);
        }
      }

      const prompt = `
You are an AI assistant that extracts actionable to-do items from transcripts (including meetings, personal voice notes, ideas, and daily reminders).
Analyze the following context and extract all action items, tasks, and personal reminders.
Output your response as a raw JSON array of objects.
EACH object MUST have exactly two keys: "title" (the task description) and "dueDate" (the due date in YYYY-MM-DD format, or null if no date is implied).
CRITICAL RULES:
1. Do NOT generate multiple redundant tasks for the same underlying event. If the text says "I have an event on Date A, remind me on Date B", create ONLY ONE task with the dueDate set to Date B (the reminder date).
2. If the context mentions dates relative to "today" (like tomorrow, next week) or recurring habits (like "every day", "daily"), use the current date (${new Date().toISOString().split('T')[0]}) or the nearest logical date as reference.
3. Do NOT include markdown formatting, code blocks, or any other text outside the JSON array.
If no tasks are found, return an empty array [].

Example output:
[
  {"title": "Schedule follow-up meeting with design team", "dueDate": "2026-08-20"},
  {"title": "Attend job interview", "dueDate": "2026-09-04"},
  {"title": "Eat an egg", "dueDate": "${new Date().toISOString().split('T')[0]}"}
]

Relevant Context:
"""
${contextText}
"""
`;

      if (transcript.length <= 1500) {
        log(`Context: ${contextText}\n`, true);
      }

      const response = await this.chatService.chat(
        [{ role: 'user', content: prompt }],
        { temperature: 0.1 },
      );
      let content = response.content.trim();

      log(`LLM Response:\n${content}\n`, true);

      // If the LLM returned a single object without array brackets, wrap it
      if (content.startsWith('{') && content.endsWith('}')) {
        content = `[${content}]`;
        log(`Wrapped single object in array: ${content}\n`, true);
      }

      // Robustly extract JSON array using Regex in case LLM added conversational filler
      const match = content.match(/\[[\s\S]*\]/);
      if (match) {
        [content] = match;
        log(`Regex matched JSON: ${content}\n`, true);
      } else {
        console.warn(
          `No JSON array found in LLM output for note ${noteId}:`,
          content,
        );
        log(`Failed to match JSON array. Aborting.\n`);
        return false;
      }

      let extractedItems: Array<{ title: string; dueDate: string | null }> = [];
      try {
        extractedItems = JSON.parse(content);
        if (!Array.isArray(extractedItems)) {
          throw new Error('Output is not a JSON array.');
        }
        log(`Parsed ${extractedItems.length} items successfully.\n`);
      } catch (e) {
        console.error(
          `Failed to parse LLM output as JSON for note ${noteId}:`,
          content,
          e,
        );
        log(`JSON Parse Error: ${e}\n`);
        return false;
      }

      // Clear old ones first
      this.todoRepository.deleteTodosByNoteId(noteId);

      const today = new Date().toISOString().split('T')[0];

      // 逐条写库并带条件过滤，普通循环比链式调用更直观。
      // eslint-disable-next-line no-restricted-syntax
      for (const item of extractedItems) {
        if (
          item &&
          typeof item.title === 'string' &&
          item.title.trim().length > 0
        ) {
          this.todoRepository.createTodo({
            noteId,
            title: item.title.trim(),
            dateString: item.dueDate || today,
            isCompleted: false,
          });
          log(`Saved todo: ${item.title.trim()}\n`, true);
        }
      }

      return true;
    } catch (error) {
      console.error(`Error extracting todos for note ${noteId}:`, error);
      const logFile = path.join(
        app.getPath('userData'),
        'speakspace_extraction.log',
      );
      try {
        fs.appendFileSync(logFile, `Fatal Error: ${error}\n`);
      } catch (e) {
        // ignore
      }
      return false;
    }
  }
}

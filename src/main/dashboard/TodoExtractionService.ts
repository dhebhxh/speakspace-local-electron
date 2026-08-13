import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { app } from 'electron';
import { NoteRepository } from "../database/repositories/NoteRepository";
import { TodoRepository } from "../database/repositories/TodoRepository";
import LocalChatService from "../llm/LocalChatService";

export class TodoExtractionService {
    private noteRepository: NoteRepository;
    private todoRepository: TodoRepository;
    private chatService: LocalChatService;

    constructor() {
        this.noteRepository = new NoteRepository();
        this.todoRepository = new TodoRepository();
        this.chatService = new LocalChatService();
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

            const prompt = `
You are an AI assistant that extracts actionable to-do items from meeting transcripts.
Analyze the following transcript and extract all action items and tasks.
Output your response as a raw JSON array of objects.
EACH object MUST have exactly one key "title" containing the task description.
Do NOT include markdown formatting, code blocks, or any other text outside the JSON array.
If no tasks are found, return an empty array [].

Example output:
[
  {"title": "Schedule follow-up meeting with design team"},
  {"title": "Send the weekly report"}
]

Transcript:
"""
${transcript}
"""
`;

            const logFile = path.join(app.getPath('userData'), 'speakspace_extraction.log');
            fs.appendFileSync(logFile, `\n\n[${new Date().toISOString()}] Starting extraction for note ${noteId}\nTranscript: ${transcript}\n`);

            const response = await this.chatService.chat([{ role: 'user', content: prompt }], { temperature: 0.1 });
            let content = response.content.trim();
            
            fs.appendFileSync(logFile, `LLM Response:\n${content}\n`);

            // If the LLM returned a single object without array brackets, wrap it
            if (content.startsWith('{') && content.endsWith('}')) {
                content = `[${content}]`;
                fs.appendFileSync(logFile, `Wrapped single object in array: ${content}\n`);
            }

            // Robustly extract JSON array using Regex in case LLM added conversational filler
            const match = content.match(/\[[\s\S]*\]/);
            if (match) {
                content = match[0];
                fs.appendFileSync(logFile, `Regex matched JSON: ${content}\n`);
            } else {
                console.warn(`No JSON array found in LLM output for note ${noteId}:`, content);
                fs.appendFileSync(logFile, `Failed to match JSON array. Aborting.\n`);
                return false;
            }

            let extractedItems: Array<{title: string}> = [];
            try {
                extractedItems = JSON.parse(content);
                if (!Array.isArray(extractedItems)) {
                    throw new Error("Output is not a JSON array.");
                }
                fs.appendFileSync(logFile, `Parsed ${extractedItems.length} items successfully.\n`);
            } catch (e) {
                console.error(`Failed to parse LLM output as JSON for note ${noteId}:`, content, e);
                fs.appendFileSync(logFile, `JSON Parse Error: ${e}\n`);
                return false;
            }

            // Clear old ones first
            this.todoRepository.deleteTodosByNoteId(noteId);

            const today = new Date().toISOString().split('T')[0];

            for (const item of extractedItems) {
                if (item && typeof item.title === 'string' && item.title.trim().length > 0) {
                    this.todoRepository.createTodo({
                        noteId: noteId,
                        title: item.title.trim(),
                        dateString: today, // Default to today as per design
                        isCompleted: false
                    });
                    fs.appendFileSync(logFile, `Saved todo: ${item.title.trim()}\n`);
                }
            }

            return true;
        } catch (error) {
            console.error(`Error extracting todos for note ${noteId}:`, error);
            const logFile = path.join(app.getPath('userData'), 'speakspace_extraction.log');
            fs.appendFileSync(logFile, `Fatal Error: ${error}\n`);
            return false;
        }
    }
}

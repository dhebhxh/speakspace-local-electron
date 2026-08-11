import { ipcMain } from "electron";
import { TranscriptionService } from "../Recording/TranscriptionService";

let transcriptionService: TranscriptionService | null = null;

function getTranscriptionService(): TranscriptionService {
    if (!transcriptionService) {
        throw new Error("No recording session is active.");
    }

    return transcriptionService;
}

ipcMain.handle(
    "Transcription:start",
    async (_event) => {
        transcriptionService?.stop();
        transcriptionService = new TranscriptionService();
        await transcriptionService.initialize();
    }
);

ipcMain.handle(
    "Transcription:stop",
    (_event) => {
        getTranscriptionService().stop();
    }
);

ipcMain.handle(
    "Transcription:save",
    async (_event, title: string) => {
        const service = getTranscriptionService();
        await service.save(title);
        service.stop();

        if (transcriptionService === service) {
            transcriptionService = null;
        }
    }
);

ipcMain.handle(
    "Transcription:discard",
    (_event) => {
        transcriptionService?.stop();
        transcriptionService = null;
    }
);

ipcMain.on(
    "Transcription:sendChunk",
    (_event, chunk: Blob) => {
        getTranscriptionService().handleChunk(chunk).catch(console.error);
    }
);

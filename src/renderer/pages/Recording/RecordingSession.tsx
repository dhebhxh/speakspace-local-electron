export enum RecordingState {
    Idle = "idle",
    Recording = "recording",
    Paused = "paused",
    Completed = "completed"
}

export class RecordingSession {
    private recorder?: MediaRecorder;
    private state = RecordingState.Idle;
    private transcriptListeners = new Set<() => void>();

    public transcript = '';

    public constructor() {

    }


    public getState(): RecordingState {
        return this.state;
    }

    public subscribe(listener: () => void): () => void {
        this.transcriptListeners.add(listener);

        return () => this.transcriptListeners.delete(listener);
    }


    public async start(): Promise<void> {
        const stream =
            await navigator.mediaDevices.getUserMedia({
                audio: true
            });

        this.recorder = new MediaRecorder(stream);

        this.recorder.ondataavailable = (event) => {
            this.sendAudioChunk(event.data);
        };

        this.recorder.start(1000);

        this.state = RecordingState.Recording;
    }


    public pause(): void {
        this.recorder?.pause();

        this.state = RecordingState.Paused;
    }


    public resume(): void {
        this.recorder?.resume();

        this.state = RecordingState.Recording;
    }


    public stop(): void {
        this.recorder?.stop();

        this.state = RecordingState.Completed;
    }

    
    public save(): void {
        // TODO IPC: save recording

        this.state = RecordingState.Idle;
    }


    public discard(): void {
        // TODO IPC: discard recording

        this.state = RecordingState.Idle;
    }


    private async sendAudioChunk(blob: Blob) {
        const buffer = await blob.arrayBuffer();

        // TODO IPC
    }

    //增加状态检查
}

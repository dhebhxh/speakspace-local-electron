import TranscriptionController from '../renderer/pages/Recording/TranscriptionController';

/**
 * 关掉复核窗之后必须能马上重新录音。
 *
 * 之前的两个坑：主进程的转写任务没取消照样在跑；而重建的 controller 会把
 * 这个还在跑的任务「认领」过来，于是界面一直显示转写中，录音和上传都点不动。
 */

type StatusListener = (job: unknown) => void;

let emitStatus: StatusListener = () => {};
const cancel = jest.fn().mockResolvedValue(undefined);
const start = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  (window as any).electron = {
    transcription: {
      onStatus: (listener: StatusListener) => {
        emitStatus = listener;
        return () => {};
      },
      onPartial: () => () => {},
      start,
      cancel,
    },
  };
});

const processingJob = (id: string) => ({
  id,
  status: 'processing',
  source: { kind: 'recording', relativePath: 'a.webm' },
});

describe('转写任务的归属', () => {
  it('不认领别的 controller 发起的任务', () => {
    const controller = new TranscriptionController();

    // 上一轮遗留的任务还在广播状态
    emitStatus(processingJob('old-job'));

    expect(controller.getSnapshot().job).toBeNull();
  });

  it('自己发起的任务才跟着更新状态', async () => {
    const controller = new TranscriptionController();
    start.mockResolvedValue(processingJob('mine'));
    await controller.startRecording('a.webm');

    emitStatus({ ...processingJob('mine'), status: 'completed' });

    expect(controller.getSnapshot().job?.status).toBe('completed');
  });

  it('别人的任务插进来也不会改掉自己的状态', async () => {
    const controller = new TranscriptionController();
    start.mockResolvedValue(processingJob('mine'));
    await controller.startRecording('a.webm');

    emitStatus({ ...processingJob('other'), status: 'failed' });

    expect(controller.getSnapshot().job?.id).toBe('mine');
    expect(controller.getSnapshot().job?.status).toBe('processing');
  });
});

describe('放弃这一轮采集', () => {
  it('取消主进程那边还在跑的任务', async () => {
    const controller = new TranscriptionController();
    start.mockResolvedValue(processingJob('mine'));
    await controller.startRecording('a.webm');

    await controller.abort();

    expect(cancel).toHaveBeenCalledWith('mine');
  });

  it('本地状态清空，忙碌标记跟着消失——不然录音按钮一直是灰的', async () => {
    const controller = new TranscriptionController();
    start.mockResolvedValue(processingJob('mine'));
    await controller.startRecording('a.webm');

    await controller.abort();
    const snapshot = controller.getSnapshot();

    expect(snapshot.job).toBeNull();
    expect(snapshot.livePendingCount).toBe(0);
    expect(snapshot.summaryPendingCount).toBe(0);
    expect(snapshot.liveSegments).toEqual([]);
  });

  it('放弃之后，原任务再广播状态也不会被认领回来', async () => {
    const controller = new TranscriptionController();
    start.mockResolvedValue(processingJob('mine'));
    await controller.startRecording('a.webm');
    await controller.abort();

    emitStatus({ ...processingJob('mine'), status: 'completed' });

    expect(controller.getSnapshot().job).toBeNull();
  });

  it('没有在跑的任务时不去调取消', async () => {
    const controller = new TranscriptionController();

    await controller.abort();

    expect(cancel).not.toHaveBeenCalled();
  });

  it('取消失败也不抛出去：本地状态已经清干净了', async () => {
    const controller = new TranscriptionController();
    start.mockResolvedValue(processingJob('mine'));
    await controller.startRecording('a.webm');
    cancel.mockRejectedValueOnce(new Error('job already gone'));

    await expect(controller.abort()).resolves.toBeUndefined();
    expect(controller.getSnapshot().job).toBeNull();
  });
});

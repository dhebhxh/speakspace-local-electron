import { ipcMain } from 'electron';
import AgentRunManager from '../agent/AgentRunManager';
import { AgentEvent } from '../agent/AgentTypes';

const manager = new AgentRunManager();

ipcMain.handle('Agent:start', (event, request: unknown) => {
  const { sender } = event;
  const started = manager.start(request, (agentEvent: AgentEvent) => {
    if (!sender.isDestroyed()) sender.send('Agent:event', agentEvent);
  });
  sender.once('destroyed', () => manager.cancel(started.runId));
  return started;
});

ipcMain.handle('Agent:cancel', (_event, runId: unknown) =>
  manager.cancel(runId),
);

import { LLMModelManager } from '../AI-module/LLMModelManager';
import OllamaRuntimeLocator, {
  OllamaRuntimeLocation,
} from './OllamaRuntimeLocator';

const DEFAULT_SERVER_URL = 'http://127.0.0.1:11434';
const STATUS_TIMEOUT_MS = 1500;

type OllamaTagsResponse = {
  models?: Array<{ name?: unknown; model?: unknown }>;
};

type RuntimeServiceDependencies = {
  locator?: OllamaRuntimeLocator;
  modelManager?: LLMModelManager;
  fetchImpl?: typeof fetch;
  serverUrl?: string;
};

export type OllamaRuntimeStatus = {
  runtimeName: 'Ollama';
  serverUrl: string;
  binaryPath: string | null;
  runtimeLocation: OllamaRuntimeLocation;
  binaryPresent: boolean;
  serverRunning: boolean;
  installedModels: string[];
  activeModelId: string | null;
  activeModelName: string | null;
  runtimeReady: boolean;
};

/**
 * 读取 Ollama 的本机状态。
 * 操作方法：Renderer 调用 Runtime:getStatus；本方法只探测，不会自动启动服务。
 */
export default class OllamaRuntimeService {
  private readonly locator: OllamaRuntimeLocator;

  private readonly modelManager: LLMModelManager;

  private readonly fetchImpl: typeof fetch;

  private readonly serverUrl: string;

  public constructor(dependencies: RuntimeServiceDependencies = {}) {
    this.locator = dependencies.locator ?? new OllamaRuntimeLocator();
    this.modelManager = dependencies.modelManager ?? new LLMModelManager();
    this.fetchImpl = dependencies.fetchImpl ?? fetch;
    this.serverUrl = dependencies.serverUrl ?? DEFAULT_SERVER_URL;
  }

  public async getStatus(): Promise<OllamaRuntimeStatus> {
    const binary = this.locator.locate();
    const installedModels = await this.readInstalledModels();
    const serverRunning = installedModels !== null;
    const activeModel = serverRunning
      ? await this.modelManager.getActivatedModel()
      : null;

    return {
      runtimeName: 'Ollama',
      serverUrl: this.serverUrl,
      binaryPath: binary.binaryPath,
      runtimeLocation: binary.location,
      binaryPresent: binary.binaryPath !== null,
      serverRunning,
      installedModels: installedModels ?? [],
      activeModelId: activeModel?.id ?? null,
      activeModelName: activeModel?.modelName ?? null,
      // 聊天真正需要的是可访问的服务和已激活模型；二者缺一都不可执行。
      runtimeReady: serverRunning && activeModel !== null,
    };
  }

  private async readInstalledModels(): Promise<string[] | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), STATUS_TIMEOUT_MS);

    try {
      const response = await this.fetchImpl(`${this.serverUrl}/api/tags`, {
        method: 'GET',
        signal: controller.signal,
      });
      if (!response.ok) return null;

      const payload = (await response.json()) as OllamaTagsResponse;
      return (payload.models ?? []).flatMap((model) => {
        let name: string | null = null;
        if (typeof model.name === 'string') {
          name = model.name;
        } else if (typeof model.model === 'string') {
          name = model.model;
        }
        return name ? [name] : [];
      });
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}

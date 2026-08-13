import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Model } from '../../../main/AI-module/Model';
import { STTModel } from '../../../main/AI-module/STTModel';
import { LLMModel } from '../../../main/AI-module/LLMModel';
import { RuntimeStatusSummary } from '../../../main/runtime/RuntimeStatusService';
import { EmbeddingModelStatus } from '../../../main/semantic/SemanticTypes';
import {
  ModelRecommendation,
  ModelRecommendationController,
} from './ModelRecommendationController';
import ModelModuleCard, { RichModelOption } from './components/ModelModuleCard';
import './ModelManagerPage.css';

type ModuleId = 'stt' | 'tts' | 'embedding' | 'lm';
type PendingOperation = { module: ModuleId; value: string };

function selectDefaultModel(
  models: Model[],
  recommendationId?: string,
): string {
  return (
    models.find((model) => model.activated)?.id ??
    models.find((model) => model.id === recommendationId)?.id ??
    models[0]?.id ??
    ''
  );
}

function languageLabel(language: string, t: TFunction): string {
  if (language === 'multilingual') return t('models.value.multilingual');
  if (language === 'en') return t('models.value.english');
  return language || t('models.value.general');
}

function sttProfile(
  model: STTModel,
  t: TFunction,
): { tier: string; speed: string } {
  const identity = `${model.id} ${model.name}`.toLowerCase();
  if (identity.includes('parakeet')) {
    return { tier: '0.6B', speed: t('models.speed.ultra') };
  }
  if (identity.includes('tiny')) {
    return { tier: 'Tiny', speed: t('models.speed.fastest') };
  }
  if (identity.includes('base')) {
    return { tier: 'Base', speed: t('models.speed.fast') };
  }
  if (identity.includes('small')) {
    return { tier: 'Small', speed: t('models.speed.balanced') };
  }
  if (identity.includes('medium')) {
    return { tier: 'Medium', speed: t('models.speed.precise') };
  }
  return { tier: 'Large', speed: t('models.speed.highPrecision') };
}

function sttFormat(model: STTModel): string {
  const identity = `${model.id} ${model.format}`.toLowerCase();
  if (identity.includes('int8')) return 'INT8';
  if (identity.includes('q5')) return 'Q5';
  return model.format.toUpperCase();
}

function llmParameters(model: LLMModel): number | null {
  const match = model.name.match(/(\d+(?:\.\d+)?)\s*[Bb](?:\b|-)/u);
  return match ? Number(match[1]) : null;
}

function llmSpeed(parameters: number | null, t: TFunction): string {
  if (parameters === null) return t('models.value.local');
  if (parameters <= 1.5) return t('models.speed.ultra');
  if (parameters <= 3) return t('models.speed.balanced');
  return t('models.speed.highQuality');
}

function toSttOption(
  model: STTModel,
  t: TFunction,
  recommendedId?: string,
): RichModelOption {
  const profile = sttProfile(model, t);
  return {
    value: model.id,
    name: model.name,
    downloaded: model.downloaded,
    current: model.activated,
    recommended: model.id === recommendedId,
    metadata: [
      { kind: 'size', label: t('models.meta.size'), value: model.size },
      {
        kind: 'language',
        label: t('models.meta.language'),
        value: languageLabel(model.language, t),
      },
      { kind: 'engine', label: t('models.meta.engine'), value: model.engine },
      {
        kind: 'format',
        label: t('models.meta.format'),
        value: sttFormat(model),
      },
      {
        kind: 'parameters',
        label: t('models.meta.scale'),
        value: profile.tier,
      },
      { kind: 'speed', label: t('models.meta.speed'), value: profile.speed },
    ],
  };
}

function toLlmOption(
  model: LLMModel,
  t: TFunction,
  recommendedId?: string,
): RichModelOption {
  const parameters = llmParameters(model);
  return {
    value: model.id,
    name: model.name,
    downloaded: model.downloaded,
    current: model.activated,
    recommended: model.id === recommendedId,
    metadata: [
      { kind: 'size', label: t('models.meta.size'), value: model.size },
      {
        kind: 'language',
        label: t('models.meta.language'),
        value: languageLabel(model.language, t),
      },
      { kind: 'engine', label: t('models.meta.engine'), value: model.engine },
      {
        kind: 'format',
        label: t('models.meta.quantization'),
        value: model.quantization || model.format.toUpperCase(),
      },
      {
        kind: 'parameters',
        label: t('models.meta.parameters'),
        value: parameters === null ? '—' : `${parameters}B`,
      },
      {
        kind: 'speed',
        label: t('models.meta.speed'),
        value: llmSpeed(parameters, t),
      },
    ],
  };
}

// Keep the named export because the router imports this page by name.
// eslint-disable-next-line import/prefer-default-export
export function ModelManagerPage() {
  const { t } = useTranslation();
  const [sttModels, setSttModels] = useState<STTModel[]>([]);
  const [llmModels, setLlmModels] = useState<LLMModel[]>([]);
  const [runtime, setRuntime] = useState<RuntimeStatusSummary | null>(null);
  const [embedding, setEmbedding] = useState<EmbeddingModelStatus | null>(null);
  const [recommendation, setRecommendation] =
    useState<ModelRecommendation | null>(null);
  const [selectedSttId, setSelectedSttId] = useState('');
  const [selectedLlmId, setSelectedLlmId] = useState('');
  const [pending, setPending] = useState<PendingOperation | null>(null);
  const [errors, setErrors] = useState<Partial<Record<ModuleId, string>>>({});
  const [pageError, setPageError] = useState('');

  const loadPageData = useCallback(async () => {
    const [nextStt, nextLlm, nextRuntime, nextEmbedding] = await Promise.all([
      window.electron.modelManagement.getModelList('stt') as Promise<
        STTModel[]
      >,
      window.electron.modelManagement.getModelList('llm') as Promise<
        LLMModel[]
      >,
      window.electron.runtime.getStatus() as Promise<RuntimeStatusSummary>,
      window.electron.semantic.getStatus() as Promise<EmbeddingModelStatus>,
    ]);

    setSttModels(nextStt);
    setLlmModels(nextLlm);
    setRuntime(nextRuntime);
    setEmbedding(nextEmbedding);
    setPageError('');

    let nextRecommendation: ModelRecommendation | null = null;
    try {
      nextRecommendation =
        await new ModelRecommendationController().getRecommendation(
          nextStt,
          nextLlm,
        );
      setRecommendation(nextRecommendation);
    } catch {
      setRecommendation(null);
    }

    setSelectedSttId((current) =>
      nextStt.some((model) => model.id === current)
        ? current
        : selectDefaultModel(nextStt, nextRecommendation?.stt?.id),
    );
    setSelectedLlmId((current) =>
      nextLlm.some((model) => model.id === current)
        ? current
        : selectDefaultModel(nextLlm, nextRecommendation?.llm?.id),
    );
  }, []);

  useEffect(() => {
    loadPageData().catch((reason: unknown) => {
      setPageError(
        reason instanceof Error ? reason.message : t('models.error.load'),
      );
    });
  }, [loadPageData, t]);

  const sttOptions = useMemo(
    () =>
      sttModels.map((model) => toSttOption(model, t, recommendation?.stt?.id)),
    [recommendation?.stt?.id, sttModels, t],
  );
  const llmOptions = useMemo(
    () =>
      llmModels.map((model) => toLlmOption(model, t, recommendation?.llm?.id)),
    [llmModels, recommendation?.llm?.id, t],
  );
  const ttsOptions = useMemo<RichModelOption[]>(
    () => [
      {
        value: 'kokoro',
        name: runtime?.speechSynthesis.modelName || 'Kokoro 82M',
        downloaded: Boolean(runtime?.speechSynthesis.modelReady),
        current: Boolean(runtime?.speechSynthesis.runtimeReady),
        recommended: true,
        metadata: [
          { kind: 'size', label: t('models.meta.parameters'), value: '82M' },
          {
            kind: 'language',
            label: t('models.meta.language'),
            value: t('models.value.zhEn'),
          },
          {
            kind: 'engine',
            label: t('models.meta.engine'),
            value: 'sherpa-onnx',
          },
          {
            kind: 'parameters',
            label: t('models.meta.sampleRate'),
            value: `${Math.round(
              (runtime?.speechSynthesis.sampleRate ?? 24_000) / 1000,
            )}kHz`,
          },
          {
            kind: 'speed',
            label: t('models.meta.speed'),
            value: t('models.value.realtime'),
          },
        ],
      },
    ],
    [runtime?.speechSynthesis, t],
  );
  const embeddingOptions = useMemo<RichModelOption[]>(
    () => [
      {
        value: 'bge-m3',
        name: embedding?.modelName || 'bge-m3',
        downloaded: Boolean(embedding?.installed),
        current: Boolean(embedding?.installed && embedding.serverAvailable),
        recommended: true,
        metadata: [
          {
            kind: 'language',
            label: t('models.meta.language'),
            value: t('models.value.multilingual'),
          },
          { kind: 'engine', label: t('models.meta.engine'), value: 'Ollama' },
          {
            kind: 'format',
            label: t('models.meta.type'),
            value: t('models.value.vector'),
          },
          {
            kind: 'parameters',
            label: t('models.meta.purpose'),
            value: t('models.value.retrieval'),
          },
          {
            kind: 'speed',
            label: t('models.meta.runtime'),
            value: t('models.value.local'),
          },
        ],
      },
    ],
    [embedding, t],
  );

  const setModuleError = (module: ModuleId, message: string) => {
    setErrors((current) => ({ ...current, [module]: message }));
  };

  const runOptionAction = async (
    module: ModuleId,
    value: string,
    operation: () => Promise<void>,
  ) => {
    if (pending) return;
    setPending({ module, value });
    setModuleError(module, '');
    try {
      await operation();
      await loadPageData();
    } catch (reason) {
      setModuleError(
        module,
        reason instanceof Error ? reason.message : t('models.error.operation'),
      );
    } finally {
      setPending(null);
    }
  };

  const ensureSttRuntime = async (model: STTModel) => {
    if (!runtime) return;
    if (
      model.engine === 'whisper.cpp' &&
      !runtime.transcription.whisperCliPresent
    ) {
      await window.electron.runtime.installWhisper();
    }
    if (!runtime.transcription.ffmpegPresent) {
      await window.electron.runtime.installFfmpeg();
    }
  };

  const activateStt = (modelId: string, allowDownload: boolean) => {
    setSelectedSttId(modelId);
    const model = sttModels.find((candidate) => candidate.id === modelId);
    if (!model || (!allowDownload && !model.downloaded)) return;
    runOptionAction('stt', modelId, async () => {
      await ensureSttRuntime(model);
      if (!model.downloaded) {
        await window.electron.modelManagement.downloadModel('stt', model.id);
      }
      await window.electron.modelManagement.activateModel('stt', model.id);
    }).catch(() => undefined);
  };

  const activateLlm = (modelId: string, allowDownload: boolean) => {
    setSelectedLlmId(modelId);
    const model = llmModels.find((candidate) => candidate.id === modelId);
    if (!model || (!allowDownload && !model.downloaded)) return;
    runOptionAction('lm', modelId, async () => {
      if (runtime && !runtime.languageModel.binaryPresent) {
        await window.electron.runtime.installOllama();
      }
      if (!model.downloaded) {
        await window.electron.modelManagement.downloadModel('llm', model.id);
      }
      await window.electron.modelManagement.activateModel('llm', model.id);
    }).catch(() => undefined);
  };

  const deleteCatalogModel = (
    module: 'stt' | 'lm',
    modelType: 'stt' | 'llm',
    modelId: string,
  ) => {
    const models = module === 'stt' ? sttModels : llmModels;
    const model = models.find((candidate) => candidate.id === modelId);
    if (!model) return;
    // Native confirmation keeps destructive model removal explicit.
    // eslint-disable-next-line no-alert
    if (!window.confirm(t('models.confirm.catalog', { name: model.name })))
      return;
    runOptionAction(module, modelId, async () => {
      await window.electron.modelManagement.deleteModel(modelType, modelId);
    }).catch(() => undefined);
  };

  const installTts = () => {
    runOptionAction('tts', 'kokoro', async () => {
      await window.electron.runtime.installTTS();
    }).catch(() => undefined);
  };
  const deleteTts = () => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(t('models.confirm.tts'))) return;
    runOptionAction('tts', 'kokoro', async () => {
      await window.electron.runtime.removeTTS();
    }).catch(() => undefined);
  };
  const installEmbedding = () => {
    runOptionAction('embedding', 'bge-m3', async () => {
      if (runtime && !runtime.languageModel.binaryPresent) {
        await window.electron.runtime.installOllama();
      }
      await window.electron.semantic.installModel();
    }).catch(() => undefined);
  };
  const deleteEmbedding = () => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(t('models.confirm.embedding'))) return;
    runOptionAction('embedding', 'bge-m3', async () => {
      await window.electron.semantic.removeModel();
    }).catch(() => undefined);
  };

  const pendingValue = (module: ModuleId): string | null =>
    pending?.module === module ? pending.value : null;

  return (
    <div className="model-manager-page">
      <header className="model-manager-header">
        <div>
          <span className="model-manager-eyebrow">LOCAL MODELS</span>
          <h1>{t('models.title')}</h1>
        </div>
        <span className="model-manager-local-badge">{t('models.local')}</span>
      </header>

      {pageError && (
        <p className="model-manager-error" role="alert">
          {pageError}
        </p>
      )}

      <main className="model-module-grid">
        <ModelModuleCard
          kind="stt"
          title="STT"
          subtitle={t('models.subtitle.stt')}
          value={selectedSttId}
          options={sttOptions}
          pendingValue={pendingValue('stt')}
          error={errors.stt ?? ''}
          onChange={(modelId) => activateStt(modelId, false)}
          onDownload={(modelId) => activateStt(modelId, true)}
          onDelete={(modelId) => deleteCatalogModel('stt', 'stt', modelId)}
        />

        <ModelModuleCard
          kind="tts"
          title="TTS"
          subtitle={t('models.subtitle.tts')}
          value="kokoro"
          options={ttsOptions}
          pendingValue={pendingValue('tts')}
          error={errors.tts ?? ''}
          onChange={() => undefined}
          onDownload={installTts}
          onDelete={deleteTts}
        />

        <ModelModuleCard
          kind="embedding"
          title="Embedding"
          subtitle={t('models.subtitle.embedding')}
          value="bge-m3"
          options={embeddingOptions}
          pendingValue={pendingValue('embedding')}
          error={errors.embedding ?? ''}
          onChange={() => undefined}
          onDownload={installEmbedding}
          onDelete={deleteEmbedding}
        />

        <ModelModuleCard
          kind="lm"
          title="LM"
          subtitle={t('models.subtitle.lm')}
          value={selectedLlmId}
          options={llmOptions}
          pendingValue={pendingValue('lm')}
          error={errors.lm ?? ''}
          onChange={(modelId) => activateLlm(modelId, false)}
          onDownload={(modelId) => activateLlm(modelId, true)}
          onDelete={(modelId) => deleteCatalogModel('lm', 'llm', modelId)}
        />
      </main>
    </div>
  );
}
